import assert from 'node:assert/strict';
import {test} from 'node:test';
import {stepSimulation, getNutrientRadius, NUTRIENT_ENERGY_VALUE, type SimulationState} from '../simulation';
import {createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {FOOD_SAFETY_LIMIT, enableClosedEconomy, embodiedEnergy} from '../energyEconomy';
import {tubeGeometry, tubeContainsBox} from '../selfTubes';
import {createScenarioWorld} from '../environmentScenarios';
import {cycleFixture, cycleSettings, food} from './support/nutrient-cycle';
import {energyActivityFixture} from './support/energy-activity';
function near(a: number, b: number, tolerance = 1e-6) {assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);}
function conserved(state: SimulationState) {near(totalAccountedEnergy(state), state.energyPool!.budget);}
function ticks(f: ReturnType<typeof cycleFixture>, count: number) {
  for (let i = 0; i < count; i++) stepSimulation(f.state, f.settings, 1 / 60);
}

test('3000 J food loses 30 J/s, shrinks below legacy minima and disappears at 100 simulated seconds', () => {
  const f = cycleFixture(); ticks(f, 60); near(f.state.nutrients[0].energyValue, 2970);
  ticks(f, 60 * 98); near(f.state.nutrients[0].energyValue, 30);
  near(f.state.nutrients[0].radius, 1.8); assert.equal(getNutrientRadius(30), 8);
  ticks(f, 60); assert.equal(f.state.nutrients.length, 0);
  near(f.state.energyPool!.reserve, 3000); near(f.state.ledger.recordedLosses, 3000); conserved(f.state);
  const partial = cycleFixture([food(75)]); ticks(partial, 120); near(partial.state.nutrients[0].energyValue, 15);
  ticks(partial, 30); assert.equal(partial.state.nutrients.length, 0); conserved(partial.state);
});

test('natural degradation adds to actual physical consumption without changing absorption rates', () => {
  const baseline = energyActivityFixture();
  enableClosedEconomy(baseline.state); baseline.config.ecologyRegime = 'closed-v1'; baseline.config.nutrientLimit = null;
  const cycling = restoreSnapshot(createSnapshot(baseline.state, baseline.config));
  cycling.settings.nutrientCycle = 'decay-v1';
  const before = cycling.state.nutrients.reduce((v, n) => v + n.energyValue, 0);
  stepSimulation(baseline.state, baseline.config, 1 / 60);
  stepSimulation(cycling.state, cycling.settings, 1 / 60);
  assert.deepEqual(cycling.state.organisms[0].recentFeedings, baseline.state.organisms[0].recentFeedings);
  const intake = (cycling.state.organisms[0].recentFeedings ?? []).reduce((v, n) => v + n.energyTransferred, 0);
  assert.ok(intake > 0);
  near(before - cycling.state.nutrients.reduce((v, n) => v + n.energyValue, 0), before - baseline.state.nutrients.reduce((v, n) => v + n.energyValue, 0) + .5);
  const remaining = cycling.state.nutrients[0].energyValue;
  cycling.state.organisms = []; stepSimulation(cycling.state, cycling.settings, 1 / 60);
  near(cycling.state.nutrients[0].energyValue, remaining - .5);
});

test('60-second carrion uses only its remaining energy, even with no organisms', () => {
  const f = cycleFixture([food(9300, true)]); ticks(f, 3599);
  assert.equal(f.state.nutrients[0].kind, 'carrion'); near(f.state.nutrients[0].energyValue, 7500.5);
  ticks(f, 1); assert.equal(f.state.nutrients.length, 3);
  assert.ok(f.state.nutrients.every(n => n.kind === 'nutrient' && n.decayTimeRemaining === undefined));
  near(f.state.nutrients.reduce((v, n) => v + n.energyValue, 0), 7500);
  near(f.state.energyPool!.reserve, 1800); conserved(f.state);
  const exhausted = cycleFixture([food(1200, true)]); ticks(exhausted, 3600);
  assert.equal(exhausted.state.nutrients.length, 0); near(exhausted.state.energyPool!.reserve, 1200); conserved(exhausted.state);
});

for (const remaining of [1200, 3000, 6000, 7500, 15000]) test(`mineralization fragments exactly ${remaining} J without giant food`, () => {
  const f = cycleFixture([food(remaining + .5, true)]); f.state.nutrients[0].decayTimeRemaining = 1 / 60;
  ticks(f, 1); assert.equal(f.state.nutrients.length, Math.ceil(remaining / 3000));
  assert.ok(f.state.nutrients.every(n => n.energyValue <= NUTRIENT_ENERGY_VALUE));
  assert.equal(f.state.nutrients.reduce((v, n) => v + n.energyValue, 0), remaining);
  assert.equal(new Set(f.state.nutrients.map(n => `${n.x},${n.y}`)).size, f.state.nutrients.length); conserved(f.state);
});

for (const tubes of [false, true]) test(`fragment clouds remain distinct inside valid water, including corners (${tubes ? 'tubes' : 'tank'})`, () => {
  for (const point of tubes ? [{x: -299, y: 335}, {x: 2699, y: 565}, {x: 0, y: 300}] : [{x: 35, y: 35}, {x: 2365, y: 1465}]) {
    const f = cycleFixture([food(150000.5, true, point.x, point.y)]);
    if (tubes) {f.settings.worldHeight = 600; f.state.selfTubes = {version: 1, connected: true, accepted: [0]};}
    f.state.nutrients[0].decayTimeRemaining = 0; ticks(f, 1);
    const g = tubeGeometry(f.settings, f.state.selfTubes);
    assert.equal(f.state.nutrients.length, 50);
    assert.equal(new Set(f.state.nutrients.map(n => `${n.x},${n.y}`)).size, 50);
    for (const n of f.state.nutrients) {
      assert.ok(Math.hypot(n.x - point.x, n.y - point.y) < 110);
      if (g) assert.ok(tubeContainsBox(g, {left: n.x - n.radius, right: n.x + n.radius, top: n.y - n.radius, bottom: n.y + n.radius}));
      else assert.ok(n.x >= n.radius && n.x <= f.settings.worldWidth - n.radius && n.y >= n.radius && n.y <= f.settings.worldHeight - n.radius);
    }
    conserved(f.state);
  }
});

test('count caps and safety limit bank unmaterialized energy; enormous remnants never produce enormous loops', () => {
  for (const cap of [0, 1, 2]) {
    const f = cycleFixture([food(15000.5, true)]); f.settings.nutrientLimit = cap;
    f.state.nutrients[0].decayTimeRemaining = 0; ticks(f, 1);
    assert.equal(f.state.nutrients.length, cap); near(f.state.energyPool!.reserve, 15000.5 - cap * 3000); conserved(f.state);
  }
  const target = cycleFixture([food(15000.5, true)]); target.settings.targetNutrients = 1;
  target.state.nutrients[0].decayTimeRemaining = 0; ticks(target, 1); assert.equal(target.state.nutrients.length, 1); conserved(target.state);
  const f = cycleFixture([food(1e9, true)]); f.settings.targetNutrients = 800;
  f.state.nutrients[0].decayTimeRemaining = 0; ticks(f, 1); assert.equal(f.state.nutrients.length, 800); conserved(f.state);
  const full = cycleFixture(Array.from({length: FOOD_SAFETY_LIMIT}, (_, i) => ({...food(), id: `plant-${i}`})));
  full.state.nutrients.push({...food(1e6, true), decayTimeRemaining: 0});
  full.state.energyPool!.budget = embodiedEnergy(full.state); ticks(full, 1);
  assert.equal(full.state.nutrients.length, FOOD_SAFETY_LIMIT); conserved(full.state);
});

test('degradation releases slots and recycles at unchanged Default/Harsh rates without living organisms', () => {
  for (const scenario of ['default', 'harsh-world'] as const) {
    const f = createScenarioWorld({...cycleSettings, targetNutrients: 1, nutrientLimit: 1, inflowRate: 15}, scenario, 17, 'balanced', 'standard', 0);
    const budget = f.state.energyPool!.budget;
    let generated = 0;
    for (let i = 0; i < 7200; i++) {
      const ids = new Set(f.state.nutrients.map(n => n.id)); stepSimulation(f.state, f.settings, 1 / 60);
      generated += f.state.nutrients.filter(n => !ids.has(n.id)).length;
      assert.ok(f.state.nutrients.length <= (scenario === 'default' ? 1 : 200));
    }
    assert.equal(f.settings.inflowRate, scenario === 'default' ? 15 : 1);
    assert.ok(generated >= 1); near(totalAccountedEnergy(f.state), budget); assert.equal(f.state.organisms.length, 0);
  }
});

test('schema 18 round trips both topologies; malformed or smuggled regimes are rejected', () => {
  for (const tubes of [false, true]) {
    const f = cycleFixture([food(9000, true), food(100)]);
    if (tubes) f.state.selfTubes = {version: 1, connected: true, accepted: [0]};
    ticks(f, 30); const saved = createSnapshot(f.state, f.settings); assert.equal(saved.schemaVersion, '18.0.0');
    const restored = restoreSnapshot(saved); ticks(f, 100);
    for (let i = 0; i < 100; i++) stepSimulation(restored.state, restored.settings, 1 / 60);
    assert.deepEqual(createSnapshot(restored.state, restored.settings), createSnapshot(f.state, f.settings));
    for (const change of [(s: any) => {delete s.settings.nutrientCycle;}, (s: any) => {s.settings.nutrientCycle = 'future';},
      (s: any) => {s.schemaVersion = tubes ? '17.0.0' : '16.0.0';}, (s: any) => {delete s.state.energyPool;}]) {
      const invalid = structuredClone(saved); change(invalid); assert.throws(() => restoreSnapshot(invalid));
    }
  }
});

test('omitted regime preserves historical unlimited plant lifetime and closed carrion-to-reserve behavior', () => {
  const f = cycleFixture([food(3000), {...food(9000, true), decayTimeRemaining: 0}]); delete f.settings.nutrientCycle;
  ticks(f, 7200); assert.equal(f.state.nutrients.length, 1); assert.equal(f.state.nutrients[0].energyValue, 3000);
  near(f.state.energyPool!.reserve, 9000); assert.equal(createSnapshot(f.state, f.settings).schemaVersion, '16.0.0');
  conserved(f.state);
});

test('decay-v2 loses 1 J/s, lasts 3000 seconds, and keeps a coherent radius floor of 6', () => {
  const f = cycleFixture(); f.settings.nutrientCycle = 'decay-v2';
  ticks(f, 60); near(f.state.nutrients[0].energyValue, 2999);
  // Exercise simulated time directly without coupling to playback or rendering.
  stepSimulation(f.state, f.settings, 2998);
  near(f.state.nutrients[0].energyValue, 1); near(f.state.nutrients[0].radius, 6);
  stepSimulation(f.state, f.settings, 1); assert.equal(f.state.nutrients.length, 0);
  near(f.state.energyPool!.reserve, 3000); conserved(f.state);
  for (const energy of [.001, 1, 30, 100, 300]) assert.equal(getNutrientRadius(energy, 'decay-v2'), 6);
  near(getNutrientRadius(750, 'decay-v2'), 9);
  near(getNutrientRadius(3000, 'decay-v2'), 18);
  assert.equal(getNutrientRadius(30), 8); near(getNutrientRadius(30, 'decay-v1'), 1.8);
});

test('decay-v2 partially eaten food and 60-second carrion use only actual remaining energy', () => {
  const f = cycleFixture([food(7560, true), food(61)]); f.settings.nutrientCycle = 'decay-v2';
  ticks(f, 3600); assert.ok(f.state.nutrients.every(n => n.kind !== 'carrion'));
  near(f.state.nutrients.reduce((v, n) => v + n.energyValue, 0), 7501);
  assert.equal(f.state.nutrients.length, 4); assert.ok(f.state.nutrients.every(n => n.energyValue <= 3000 && n.radius >= 6));
  conserved(f.state);
});

test('schema19 persists decay-v2 independently of tube/contact/physics settings and cannot be smuggled into schema18', () => {
  for (const tubes of [false, true]) {
    const f = cycleFixture([food(7560, true), food(75)]); f.settings.nutrientCycle = 'decay-v2';
    if (tubes) f.state.selfTubes = {version: 1, connected: true, accepted: [0]};
    ticks(f, 300); const source = createSnapshot(f.state, f.settings); assert.equal(source.schemaVersion, '19.0.0');
    const saved = restoreSnapshot(source); ticks(f, 3301);
    for (let i = 0; i < 3301; i++) stepSimulation(saved.state, saved.settings, 1 / 60);
    assert.deepEqual(createSnapshot(saved.state, saved.settings), createSnapshot(f.state, f.settings));
    const invalid = structuredClone(source); invalid.schemaVersion = '18.0.0'; assert.throws(() => restoreSnapshot(invalid), /nutrient cycle/);
    const missing = structuredClone(source); delete missing.settings.nutrientCycle; assert.throws(() => restoreSnapshot(missing), /nutrient cycle/);
  }
});
