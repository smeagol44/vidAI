import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy, clearFreeNutrients} from '../persistence';
import {embodiedEnergy, enableClosedEconomy, setWorldEnergy, fundIncubatingEggs, occupiedPopulation} from '../energyEconomy';
import {SimulationHost} from '../simulationHost';

const settings: sim.SimulationSettings = {...DEFAULT_SETTINGS, ecologyRegime: 'closed-v1', nutrientLimit: 0,
  targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
const open = {...settings, ecologyRegime: undefined};
function world() {return createInitialWorld(open, 711, 'balanced', 'standard', 0);}
function seal(s: sim.SimulationState, reserve = 0) {
  delete s.energyPool; enableClosedEconomy(s);
  setWorldEnergy(s, s.energyPool!.budget + reserve);
}
function close(a: number, b: number) {assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);}
function conserved(s: sim.SimulationState) {close(totalAccountedEnergy(s), s.energyPool!.budget);}
function egg(x = 400): sim.Egg {
  const g = createFounderGenome('CUR-001');
  return {id: `egg-${x}`, clutchId: 'clutch', parentOrgId: 'parent', x, y: 500, vx: 0, vy: 0,
    genome: g, fundedStructural: g.bodyCost, fundedReserve: 4000, incubationProgress: 0,
    totalIncubationTime: 10, pulseTimer: 0, colorHue: 120, readyToHatch: false};
}

test('conversion excludes historical heat, retains exact organisms/PRNG and never changes physics', () => {
  const s = createInitialWorld(open, 711, 'balanced', 'standard', 1);
  for (let i = 0; i < 30; i++) sim.stepSimulation(s, open, 1 / 60);
  const bodies = structuredClone(s.organisms), rng = s.prng.getState(), energy = embodiedEnergy(s);
  s.ledger.recordedLosses += 1e8;
  enableClosedEconomy(s); close(s.energyPool!.budget, energy); close(s.energyPool!.reserve, 0);
  assert.deepEqual(structuredClone(s.organisms), bodies); assert.deepEqual(s.prng.getState(), rng);
  const restored = restoreSnapshot(createSnapshot(s, settings));
  assert.equal(restored.settings.physicsRegime, 'paid-work-v2'); conserved(s);
});

test('funded nutrient spawning, caps, manual clearing and spawning life conserve the same pool', () => {
  const s = world(); seal(s, 30000);
  const cfg = {...settings, nutrientLimit: null};
  assert.equal(sim.addNutrients(s, {...cfg, nutrientLimit: 2}, 50), 2);
  close(s.energyPool!.reserve, 24000); conserved(s);
  assert.equal(sim.addNutrients(s, {...cfg, nutrientLimit: 1}, 50), 0);
  assert.equal(s.nutrients.length, 2);
  clearFreeNutrients(s); close(s.energyPool!.reserve, 30000); conserved(s);
  const org = addExternalOrganism(s, createFounderGenome('CUR-001'), cfg, 1200, 750, 0);
  assert.ok(org); close(s.ledger.externalInflow, 0); conserved(s);
  setWorldEnergy(s, 0);
  assert.equal(addExternalOrganism(s, createFounderGenome('CUR-001'), cfg, 800, 400, 0), null);
  assert.equal(sim.addNutrients(s, cfg, 1), 0); conserved(s);
});

test('budget cuts create debt; carrion repays only debt and preserves its surplus for a funded nutrient', () => {
  const s = world(); s.nutrients.push({id: 'rem', kind: 'carrion', decayTimeRemaining: 0,
    x: 300, y: 300, vx: 0, vy: 0, energyValue: 5000, radius: 20, bottomTimer: 0});
  seal(s); setWorldEnergy(s, 3000); close(s.energyPool!.reserve, -2000);
  const cfg = {...settings, nutrientLimit: null, inflowRate: 60};
  sim.stepSimulation(s, cfg, 1 / 60);
  assert.equal(s.nutrients.length, 0); close(s.energyPool!.reserve, 3000); conserved(s);
  sim.stepSimulation(s, cfg, 1 / 60);
  assert.equal(s.nutrients.length, 1); close(s.nutrients[0].energyValue, 3000);
  close(s.energyPool!.reserve, 0); conserved(s);
});

test('blocked nutrient conversion banks reserve without building a catch-up burst', () => {
  const s = world(); seal(s, 30000);
  for (let i = 0; i < 120; i++) sim.stepSimulation(s, {...settings, inflowRate: 150}, 1 / 60);
  close(s.energyPool!.reserve, 30000); close(s.nutrientAccumulator, 0);
  sim.stepSimulation(s, {...settings, nutrientLimit: null, inflowRate: 1}, 1 / 60);
  assert.equal(s.nutrients.length, 0); conserved(s);
});

test('a clutch fills only remaining population slots; debt does not prohibit parent-funded laying', () => {
  const s = world(), g = createFounderGenome('CUR-001');
  const o = addExternalOrganism(s, g, open, 1200, 750, 0)!;
  o.age = 50; s.simTime = 100; o.energy = g.maxEnergyCapacity;
  s.eggs.push(egg()); seal(s); setWorldEnergy(s, s.energyPool!.budget - 1000);
  assert.equal(sim.evaluateReproductionAffordability(o, s.simTime, 1, 1, 3, 75, true).actualClutchSize, 1);
  sim.stepSimulation(s, {...settings, maxOrganisms: 3}, 1 / 60);
  assert.equal(s.eggs.length, 2); assert.equal(occupiedPopulation(s), 3);
  const offspring = o.offspringCount;
  o.lastReproductionTime = -100;
  sim.stepSimulation(s, {...settings, maxOrganisms: 3}, 1 / 60);
  assert.equal(o.offspringCount, offspring); conserved(s);
  assert.equal(addExternalOrganism(s, g, {...settings, maxOrganisms: 3}, 600, 600), null);
});

test('funded hatching replaces a reserved slot even above a lowered cap, including at zero reserve', () => {
  const s = world(); addExternalOrganism(s, createFounderGenome('CUR-001'), open, 1400, 900, 0);
  const e = egg(); e.incubationProgress = 1; e.hatchHeading = 0; s.eggs.push(e); seal(s);
  e.fundedReserve = e.hatchReserveTarget!;
  s.energyPool!.budget = embodiedEnergy(s);
  assert.equal(sim.evaluateEggHatchStatus(e, {...settings, maxOrganisms: 1}, s.organisms, s.energyPool).status, 'clear');
  sim.stepSimulation(s, {...settings, maxOrganisms: 1}, 1 / 60);
  assert.equal(s.eggs.length, 0); assert.equal(s.organisms.length, 2); conserved(s);
});

test('uptake is funded, rate-limited and shared proportionally rather than monopolized by one egg', () => {
  const s = world(); s.eggs.push(egg(400), egg(800)); seal(s, 1);
  const before = s.eggs.map(e => e.fundedReserve);
  fundIncubatingEggs(s, 1);
  close(s.eggs[0].fundedReserve - before[0], .5);
  close(s.eggs[1].fundedReserve - before[1], .5);
  close(s.energyPool!.reserve, 0); conserved(s);
  fundIncubatingEggs(s, 1); close(s.eggs[0].fundedReserve - before[0], .5);
});

test('debt blocks ready eggs; debt recovery permits hatching before a simulation-time deadline', () => {
  const s = world(), e = egg(); e.incubationProgress = 1; s.eggs.push(e); seal(s);
  e.fundedReserve = e.hatchReserveTarget!; s.energyPool!.budget = embodiedEnergy(s);
  setWorldEnergy(s, s.energyPool!.budget - 100);
  assert.equal(sim.evaluateEggHatchStatus(e, settings, [], s.energyPool).status, 'world-debt');
  sim.stepSimulation(s, settings, 1 / 60); assert.equal(s.eggs.length, 1);
  setWorldEnergy(s, s.energyPool!.budget + 100);
  sim.stepSimulation(s, settings, 1 / 60); assert.equal(s.eggs.length, 0); conserved(s);
});

test('damaged eggs can regain their hatching threshold; unfunded eggs expire into exact carrion', () => {
  const s = world(), e = egg(); e.incubationProgress = 1; s.eggs.push(e); seal(s);
  const target = e.hatchReserveTarget!; e.fundedReserve = target - 10;
  s.energyPool!.budget = embodiedEnergy(s); setWorldEnergy(s, s.energyPool!.budget + 20);
  sim.stepSimulation(s, settings, 1); assert.equal(s.eggs.length, 0); conserved(s);
  const failed = world(), damaged = egg(); damaged.incubationProgress = 1; failed.eggs.push(damaged); seal(failed);
  damaged.fundedStructural = 1; damaged.fundedReserve = 7; damaged.ageSeconds = 29.99;
  failed.energyPool!.budget = embodiedEnergy(failed);
  sim.stepSimulation(failed, settings, 1 / 60);
  assert.equal(failed.eggs.length, 0); assert.equal(failed.nutrients[0].kind, 'carrion');
  close(failed.nutrients[0].energyValue, 8); conserved(failed);
});

test('partial physical egg predation can leave a living egg below its hatch threshold', () => {
  const s = world(), g = createFounderGenome('CUR-001');
  g.parts = [g.parts[0]]; g.eyes = []; g.mouths = [{...g.mouths[0], partIndex: 0, direction: 'EAST', mouthType: 'carnivore'}];
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths); sim.remapBrain(g);
  const o = addExternalOrganism(s, g, open, 1200, 750, 0)!;
  const anchor = sim.getOrganAnchor(g.mouths[0], g.parts[0].width, g.parts[0].height);
  const e = egg(); e.x = 1200 + anchor.x; e.y = 750 + anchor.y; e.incubationProgress = .2;
  s.eggs.push(e); seal(s); const before = e.fundedReserve;
  sim.stepSimulation(s, settings, 1 / 60);
  assert.ok(e.fundedReserve < before); assert.equal(s.eggs.length, 1);
  assert.ok(e.fundedStructural + e.fundedReserve < sim.calculateBodyCost(e.genome.parts, e.genome.eyes, e.genome.mouths) + e.hatchReserveTarget!);
  assert.ok(o.recentFeedings?.some(f => f.foodCategory === 'Egg')); conserved(s);
});

test('full food buffers retain all egg/death carrion and remain saveable', () => {
  const s = world();
  for (let i = 0; i < 2200; i++) s.nutrients.push({id: `p${i}`, x: 50, y: 50, vx: 0, vy: 0, energyValue: 3000, radius: 18, bottomTimer: 0});
  s.eggs.push(egg(300), egg(700)); seal(s);
  for (const e of s.eggs) e.ageSeconds = 30;
  const funds = s.eggs.reduce((n, e) => n + e.fundedReserve + e.fundedStructural, 0);
  sim.stepSimulation(s, settings, 1 / 60);
  assert.equal(s.nutrients.length, 2201);
  close(s.nutrients.find(n => n.kind === 'carrion')!.energyValue, funds); conserved(s);
  restoreSnapshot(createSnapshot(s, settings));
});

test('closed timers, debt and transfers resume exactly; Worker host matches direct stepping and commands', () => {
  const s = world(); s.eggs.push(egg()); seal(s, 200);
  const source = createSnapshot(s, settings), direct = restoreSnapshot(source).state;
  const host = new SimulationHost(); host.reset(source, 1);
  for (let i = 0; i < 120; i++) {host.tick(); sim.stepSimulation(direct, settings, 1 / 60);}
  assert.deepEqual(host.snapshot(), createSnapshot(direct, settings)); conserved(host.state);
  host.action({kind: 'energy-budget', joules: 0}); conserved(host.state);
  const copy = restoreSnapshot(host.snapshot());
  assert.deepEqual(createSnapshot(copy.state, copy.settings), host.snapshot());
  const bad = host.snapshot(); bad.state.energyPool!.reserve += 1;
  assert.throws(() => restoreSnapshot(bad), /conservation/);
  const timer = host.snapshot(); timer.state.eggs[0].ageSeconds = -1;
  assert.throws(() => restoreSnapshot(timer), /egg state/);
});

test('all frozen starters retain identical five-second movement and expenditure with closed recycling', () => {
  for (let i = 1; i <= 9; i++) {
    const s = world(); addExternalOrganism(s, createFounderGenome(`CUR-00${i}`), open, 1200, 750, .37);
    const closed = restoreSnapshot(createSnapshot(s, open)).state; seal(closed);
    for (let j = 0; j < 300; j++) {sim.stepSimulation(s, open, 1 / 60); sim.stepSimulation(closed, settings, 1 / 60);}
    assert.equal(JSON.stringify(closed.organisms), JSON.stringify(s.organisms)); conserved(closed);
    assert.ok(closed.energyPool!.reserve > 0);
  }
});

test('historical diagnostic magnitude cannot erase new recycled expenditure', () => {
  const s = world(); addExternalOrganism(s, createFounderGenome('CUR-001'), open, 1200, 750, 0);
  seal(s); s.ledger.metabolicDissipation = 1e20; s.ledger.mechanicalWorkHeat = 1e20;
  const before = s.organisms[0].energy;
  for (let i = 0; i < 60; i++) sim.stepSimulation(s, settings, 1 / 60);
  close(s.energyPool!.reserve, before - s.organisms[0].energy); conserved(s);
});

test('reserve comparison tolerance cannot admit an egg whose structural funding is short', () => {
  const s = world(), e = egg(); e.incubationProgress = 1; e.fundedReserve = 0;
  e.fundedStructural = e.genome.bodyCost - 5e-8; s.eggs.push(e); seal(s);
  assert.equal(sim.evaluateEggHatchStatus(e, settings, [], s.energyPool).status, 'funding');
  sim.stepSimulation(s, settings, 1 / 60);
  assert.equal(s.organisms.length, 0); assert.equal(s.eggs.length, 1); conserved(s);
});
