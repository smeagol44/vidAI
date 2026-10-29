import assert from 'node:assert/strict';
import {test} from 'node:test';
import {selfTubeFixture, tubeSettings} from './support/self-tubes';
import {tubeGeometry, tubeWallContact, tubeContainsBox, transferSelfOrganisms, translateLiveOrganism,
  setSelfTubes, moveTubeParticle, tubeFade, validateSelfTubes} from '../selfTubes';
import {createSnapshot, restoreSnapshot, totalAccountedEnergy, resizeWorld} from '../persistence';
import {stepSimulation, addNutrients, evaluateEggHatchStatus, type Egg} from '../simulation';
import {SimulationHost} from '../simulationHost';

const config = {worldWidth: 1800, worldHeight: 900};
const geometry = (accepted: number[]) => tubeGeometry(config, {version: 1, connected: true, accepted})!;

test('physical union opens only selected sections, merges contiguous roofs and never caps exits', () => {
  const g = geometry([0, 1]);
  assert.deepEqual(g.runs, [{top: 300, bottom: 900}]);
  assert.equal(tubeWallContact(g, -10, 600), undefined);
  assert.equal(tubeWallContact(g, -450, 600), undefined, 'no invisible distal organism wall');
  assert.ok(tubeWallContact(g, -20, 200)!.dx > 0, 'closed upper window retains its wall');
  const roof = tubeWallContact(g, -100, 295)!;
  assert.equal(roof.dx, 0); assert.equal(roof.dy, 5);
  assert.equal(tubeWallContact(g, 1900, 295)!.dy, 5, 'same physical roof on right');
  assert.equal(tubeWallContact(g, -40, 901)!.dy, -1);
  assert.ok(tubeContainsBox(g, {left: -200, right: 20, top: 400, bottom: 800}));
  assert.equal(tubeContainsBox(geometry([0, 2]), {left: -200, right: 20, top: 100, bottom: 800}), false);
  assert.equal(tubeGeometry(config, {version: 1, connected: false, accepted: [0]}), undefined);
  assert.equal(tubeGeometry(config, {version: 1, connected: true, accepted: [9]}), undefined);
});

test('whole live records transfer atomically both ways with unchanged identity, acquired state and energy', () => {
  for (const side of ['L', 'R'] as const) {
    const {state, settings} = selfTubeFixture(side), org = state.organisms[0], root = org.segments[0];
    const before = new Map([[org.id, root.x]]), previousId = org.id, genome = org.genome;
    translateLiveOrganism(org, side === 'L' ? -.2 : .2);
    org.neuralHidden[0] = .123; org.learnedMotorWeights = [{edge: 'sentinel', delta: .1, eligibility: .2}];
    const original = structuredClone(org), expected = structuredClone(org), rng = state.prng.getState();
    const energy = totalAccountedEnergy(state), births = state.totalBirths, lineage = state.lineage;
    translateLiveOrganism(expected, (side === 'L' ? settings.worldWidth + 200 : -200) - root.x);
    assert.equal(transferSelfOrganisms(state, settings, before), 1);
    assert.deepEqual(state.organisms[0], expected);
    assert.deepEqual(org, original, 'the old captured record is not partly mutated');
    assert.equal(state.organisms.length, 1); assert.equal(state.organisms[0].id, previousId);
    assert.equal(state.organisms[0].genome, genome); assert.equal(state.lineage, lineage);
    assert.equal(state.totalBirths, births); assert.equal(totalAccountedEnergy(state), energy);
    assert.deepEqual(state.prng.getState(), rng);
  }
});

test('arrival at 200 does not retransfer or jitter; returning requires a fresh outward 300 crossing', () => {
  const {state, settings} = selfTubeFixture(); const id = state.organisms[0].id;
  const before = new Map([[id, -299.9]]); translateLiveOrganism(state.organisms[0], -.2);
  transferSelfOrganisms(state, settings, before);
  let org = state.organisms[0]; assert.equal(org.segments[0].x, 2000);
  assert.equal(transferSelfOrganisms(state, settings, new Map([[id, 2000]])), 0);
  translateLiveOrganism(org, 99.9);
  assert.equal(transferSelfOrganisms(state, settings, new Map([[id, 2000]])), 0);
  translateLiveOrganism(org, .2);
  assert.equal(transferSelfOrganisms(state, settings, new Map([[id, 2099.9]])), 1);
  org = state.organisms[0]; assert.equal(org.segments[0].x, -200);
  assert.equal(transferSelfOrganisms(state, settings, new Map([[id, -200]])), 0);
});

test('a soft wall edge overshoot cannot strand a living record beyond an uncapped exit', () => {
  for (const side of ['L', 'R'] as const) {
    const {state, settings} = selfTubeFixture(side), org = state.organisms[0], root = org.segments[0];
    const direction = side === 'L' ? -1 : 1, before = new Map([[org.id, root.x]]);
    translateLiveOrganism(org, direction * 10, 299 - root.y);
    assert.equal(transferSelfOrganisms(state, settings, before), 0, 'closed side of the roof is not a transfer');
    const past = root.x; translateLiveOrganism(org, direction, 2);
    assert.equal(transferSelfOrganisms(state, settings, new Map([[org.id, past]])), 1);
    assert.equal(state.organisms.length, 1);
    assert.equal(state.organisms[0].segments[0].x, side === 'L' ? settings.worldWidth + 200 : -200);
    assert.equal(transferSelfOrganisms(state, settings, new Map([[org.id, state.organisms[0].segments[0].x]])), 0);
  }
});

test('normal kernel physics crosses the open exit; a closed index retains repulsion and cannot transfer', () => {
  const open = selfTubeFixture(), closed = selfTubeFixture();
  closed.state.selfTubes!.accepted = [1];
  const id = open.state.organisms[0].id, births = open.state.totalBirths, budget = open.state.energyPool!.budget;
  stepSimulation(open.state, open.settings, 1 / 60);
  stepSimulation(closed.state, closed.settings, 1 / 60);
  assert.equal(open.state.organisms[0].segments[0].x, 2000);
  assert.equal(open.state.organisms[0].id, id); assert.equal(open.state.totalBirths, births);
  assert.ok(closed.state.organisms[0].segments[0].x < 0);
  assert.ok(closed.state.organisms[0].segments[0].vx > open.state.organisms[0].segments[0].vx);
  assert.ok(Math.abs(totalAccountedEnergy(open.state) - budget) < 1e-7);
});

test('food spawns throughout funded channel water with the same slots, IDs, stock and rate', () => {
  const {state, settings} = selfTubeFixture();
  const budget = totalAccountedEnergy(state), reserve = state.energyPool!.reserve;
  const count = addNutrients(state, {...settings, inflowRate: 0}, 300);
  assert.equal(count, 300); assert.ok(state.nutrients.some(n => n.x < 0));
  assert.ok(state.nutrients.some(n => n.x > settings.worldWidth));
  assert.ok(state.nutrients.every(n => n.x >= 0 && n.x <= 1800 || n.y > 300 && n.y < 600));
  assert.equal(new Set(state.nutrients.map(n => n.id)).size, count);
  assert.ok(Math.abs(totalAccountedEnergy(state) - budget) < 1e-7);
  assert.equal(reserve - state.energyPool!.reserve, state.nutrients.reduce((sum, n) => sum + n.energyValue, 0));
  const ids = state.nutrients.map(n => n.id);
  setSelfTubes(state, settings, {version: 1, connected: false, accepted: [0]});
  assert.deepEqual(state.nutrients.map(n => n.id), ids); assert.ok(state.nutrients.every(n => n.x >= 35 && n.x <= 1765));
  assert.equal(totalAccountedEnergy(state), budget);
});

test('particles cross uncapped exits symmetrically without new IDs, energy or terminal clamps', () => {
  const g = geometry([0]);
  const particle = {id: 'food', x: -299, y: 750, vx: -80, vy: 0, energyValue: 3000};
  moveTubeParticle(particle, g); assert.equal(particle.x, -299, 'last 35 units are real water, not a hidden end wall');
  particle.x = -301; moveTubeParticle(particle, g); assert.equal(particle.x, 2000);
  assert.equal(particle.vx, -80); assert.equal(particle.energyValue, 3000); assert.equal(particle.id, 'food');
  particle.x = 2101; moveTubeParticle(particle, g); assert.equal(particle.x, -200);
});

test('closing an occupied tube moves the whole body horizontally, preserving pose, velocities, learned state and stock', () => {
  const {state, settings} = selfTubeFixture(); const org = state.organisms[0], before = structuredClone(org);
  const energy = totalAccountedEnergy(state), rng = state.prng.getState();
  setSelfTubes(state, settings, {version: 1, connected: false, accepted: [0]});
  const dx = org.segments[0].x - before.segments[0].x;
  assert.ok(dx > 0);
  for (let i = 0; i < org.segments.length; i++) {
    assert.deepEqual(org.segments[i], {...before.segments[i], x: before.segments[i].x + dx});
  }
  assert.deepEqual(org.joints, before.joints); assert.deepEqual(org.neuralHidden, before.neuralHidden);
  assert.deepEqual(state.prng.getState(), rng); assert.equal(totalAccountedEnergy(state), energy);
  resizeWorld(state, settings, 1200, 600); assert.deepEqual(state.selfTubes!.accepted, [0]);
});

test('active worlds round-trip schema 17 and continue exactly; historical files reject smuggled topology', () => {
  const {state, settings} = selfTubeFixture();
  const snapshot = createSnapshot(state, settings); assert.equal(snapshot.schemaVersion, '17.0.0');
  const restored = restoreSnapshot(snapshot); assert.deepEqual(createSnapshot(restored.state, restored.settings), snapshot);
  for (let i = 0; i < 15; i++) {stepSimulation(state, settings, 1 / 60); stepSimulation(restored.state, restored.settings, 1 / 60);}
  assert.deepEqual(createSnapshot(state, settings), createSnapshot(restored.state, restored.settings));
  const old = structuredClone(snapshot); old.schemaVersion = '15.0.0';
  assert.throws(() => restoreSnapshot(old), /schema 17/);
  for (const bad of [[1, 0], [0, 0], [-1], [1.5]]) assert.throws(() => validateSelfTubes({version: 1, connected: true, accepted: bad}));
});

test('absent, disconnected and zero-opening modes preserve exact historical kernel arithmetic', () => {
  const base = selfTubeFixture(); delete base.state.selfTubes;
  translateLiveOrganism(base.state.organisms[0], 900 - base.state.organisms[0].segments[0].x);
  const snapshot = createSnapshot(base.state, base.settings); assert.equal(snapshot.schemaVersion, '15.0.0');
  for (const topology of [{version: 1 as const, connected: false, accepted: [0]}, {version: 1 as const, connected: true, accepted: []}, {version: 1 as const, connected: true, accepted: [0]}]) {
    const a = restoreSnapshot(snapshot), b = restoreSnapshot(snapshot); b.state.selfTubes = topology;
    for (let i = 0; i < 60; i++) {stepSimulation(a.state, a.settings, 1 / 60); stepSimulation(b.state, b.settings, 1 / 60);}
    delete b.state.selfTubes;
    assert.deepEqual(createSnapshot(a.state, a.settings), createSnapshot(b.state, b.settings));
  }
});

test('hatching in channel water uses the same full-body clearance and genuine birth accounting', () => {
  const {state, settings} = selfTubeFixture(); const genome = state.organisms[0].genome;
  state.organisms = []; delete state.energyPool;
  const egg: Egg = {id: 'tube-egg', clutchId: 'clutch', parentOrgId: 'parent', x: -150, y: 450, vx: 0, vy: 0,
    genome, fundedStructural: genome.bodyCost, fundedReserve: 4000, incubationProgress: 1,
    totalIncubationTime: 10, pulseTimer: 0, colorHue: 120, readyToHatch: true, hatchHeading: 0};
  state.eggs = [egg]; const config = {...settings, ecologyRegime: undefined};
  assert.equal(evaluateEggHatchStatus(egg, config, [], undefined, state.selfTubes).status, 'clear');
  const births = state.totalBirths; stepSimulation(state, config, 1 / 60);
  assert.equal(state.eggs.length, 0); assert.equal(state.organisms.length, 1);
  assert.equal(state.totalBirths, births + 1); assert.ok(state.organisms[0].segments[0].x < 0);
});

test('paused host owns validated topology commands, snapshots and stale-world reset behavior', () => {
  const {source} = selfTubeFixture(), host = new SimulationHost(); host.reset(source, 3);
  const before = host.snapshot();
  host.action({kind: 'self-tubes', topology: {version: 1, connected: false, accepted: [0, 4]}});
  assert.equal(host.state.simTime, before.state.simTime); assert.equal(host.state.selfTubes!.connected, false);
  assert.deepEqual(host.snapshot().state.selfTubes!.accepted, [0, 4]);
  assert.throws(() => host.action({kind: 'self-tubes', topology: {version: 1, connected: true, accepted: [-1]}}));
});

test('observer-only fading reaches near invisibility at 200 and zero at 300 with no state mutation', () => {
  const g = geometry([0]);
  assert.equal(tubeFade(g, 0, 750), 1); assert.ok(tubeFade(g, -50, 750) < 1);
  assert.ok(tubeFade(g, -200, 750) < .04); assert.equal(tubeFade(g, -300, 750), 0);
  assert.equal(tubeFade(g, 2000, 750), tubeFade(g, -200, 750));
  assert.equal(tubeFade(undefined, -200, 750), 1); assert.equal(tubeFade(g, -200, 150), 1);
});


test('tube saves retain every canonical physics, mouth-contact and economy combination', () => {
  for (const physicsRegime of ['legacy-v0', 'surface-work-v1', 'paid-work-v2', 'passive-work-v3'] as const) {
    for (const closed of [false, true]) for (const capsule of [false, true]) {
      const fixture = selfTubeFixture();
      const settings = {...fixture.settings, physicsRegime,
        mouthContactModel: capsule ? 'capsule-v1' as const : undefined,
        ecologyRegime: closed ? 'closed-v1' as const : undefined};
      if (!closed) delete fixture.state.energyPool;
      const snapshot = createSnapshot(fixture.state, settings), copy = restoreSnapshot(snapshot);
      assert.equal(snapshot.schemaVersion, '17.0.0');
      assert.deepEqual(createSnapshot(copy.state, copy.settings), snapshot);
      for (let tick = 0; tick < 15; tick++) {
        stepSimulation(fixture.state, settings, 1 / 60); stepSimulation(copy.state, copy.settings, 1 / 60);
      }
      assert.deepEqual(createSnapshot(copy.state, copy.settings), createSnapshot(fixture.state, settings));
    }
  }
});

test('canonical tube imports reject unintegrated forward-mouth formats, including dormant genomes', () => {
  const {source} = selfTubeFixture();
  for (const location of ['organism', 'egg', 'lineage']) {
    const snapshot = structuredClone(source), organism = snapshot.state.organisms[0];
    const genome = structuredClone(organism.genome);
    Object.assign(genome.mouths[0], {intakeLength: 30});
    if (location === 'organism') organism.genome = genome;
    else if (location === 'lineage') snapshot.state.lineage[0][1].genome = genome;
    else snapshot.state.eggs = [{id: 'format-egg', clutchId: 'clutch', parentOrgId: organism.id,
      x: 900, y: 450, vx: 0, vy: 0, genome, fundedStructural: genome.bodyCost, fundedReserve: 500,
      ageSeconds: 0, hatchReserveTarget: 550, incubationProgress: 0,
      totalIncubationTime: 10, pulseTimer: 0, colorHue: 120, readyToHatch: false}];
    assert.throws(() => restoreSnapshot(snapshot), /forward-mouth tube snapshots/);
  }
});
