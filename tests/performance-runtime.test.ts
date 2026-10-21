import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {LEGACY_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {compiledBrain, compiledDeltas, invalidateCompiledBrain, alignPlasticRecords} from '../neuralRuntime';
import {rectangleContact} from '../contacts';
import {referenceContact} from './support/reference-contact';
import {watchLineage, markLineageChanged} from '../lineageChanges';
import {SimulationHost, RenderReplica} from '../simulationHost';

const config = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
function fixture(mode = 'masked-learned') {
  const state = createInitialWorld(config, 711, 'balanced', 'standard', 0);
  const g = createFounderGenome('FND-001');
  if (mode.includes('learned')) {
    g.plasticityRate = .8; g.sensoryPlasticityRate = .8;
    g.memoryConsolidationRate = 2; g.plasticMotorScope = 'all';
  }
  if (mode.includes('masked')) sim.mutateBrainTopology(g, 'wire-retinal-turn', new sim.XoshiroPRNG(13));
  addExternalOrganism(state, g, config, 1200, 750, 0);
  state.nutrients.push({id: 'meal', x: 1280, y: 750, vx: 0, vy: 0, kind: 'nutrient',
    energyValue: 3000, radius: 18, bottomTimer: 0, pulseTimer: 0});
  state.ledger.externalInflow += 3000;
  return state;
}

// Golden complete-state hashes measured from main d3d7465 BEFORE optimization.
// They cover original arithmetic order, all PRNG state, live learned memory,
// energy and actual motion; they deliberately precede any corpse creation.
const golden = {
  plain: '2beee8151de15d2ea1210b79a19357963607a93e817fa54685fa9a05f4dec929',
  masked: '6372ca22403f848c5f0a0cf29acd9279327a46accf5c8d091a94b11c13465349',
  learned: '4976dca352dd53a031b3e6ba8dfe4716cfa6cd264e1a8f06252afee1e929c7f2',
  'masked-learned': '2aef53858afe0bb292dd70fe081707fdbbb85fe9dd7492652ebf03c6c28e3337',
};
for (const [mode, expected] of Object.entries(golden)) test(`cached runtime preserves v0.30 complete continuation: ${mode}`, () => {
  const state = fixture(mode);
  for (let i = 0; i < 120; i++) sim.stepSimulation(state, config, 1 / 60);
  const hash = createHash('sha256').update(JSON.stringify(createSnapshot(state, config).state)).digest('hex');
  assert.equal(hash, expected);
});

test('topology edits invalidate masks; changing weights does not cache stale values', () => {
  const state = fixture('plain'), g = state.organisms[0].genome;
  const initial = compiledBrain(g);
  g.weightsIH[0][0] += .1;
  assert.equal(compiledBrain(g), initial);
  g.disabledConnections!.push(sim.brainEdgeKey('ih', g.hiddenIds![0], g.inputKeys![0]));
  const masked = compiledBrain(g);
  assert.notEqual(masked, initial); assert.equal(masked.ih[0], 1);
  assert.ok(sim.mutateBrainTopology(g, 'add-neuron', new sim.XoshiroPRNG(81)));
  assert.notEqual(compiledBrain(g), masked);
});

test('learning reuses ID-keyed records and exact saves do not depend on warm caches', () => {
  const state = fixture();
  sim.stepSimulation(state, config, 1 / 60);
  const org = state.organisms[0], motor = org.learnedMotorWeights!, retina = org.learnedSensoryWeights!;
  const record = motor[0];
  sim.stepSimulation(state, config, 1 / 60);
  assert.equal(org.learnedMotorWeights, motor); assert.equal(org.learnedSensoryWeights, retina);
  assert.equal(org.learnedMotorWeights![0], record);
  const restored = restoreSnapshot(createSnapshot(state, config));
  for (let i = 0; i < 8; i++) {
    sim.stepSimulation(state, config, 1 / 60); sim.stepSimulation(restored.state, config, 1 / 60);
  }
  assert.deepEqual(createSnapshot(restored.state, config), createSnapshot(state, config));
});

test('one death leaves exactly one larger edible circle containing all remaining chemical energy', () => {
  const state = fixture('plain'); state.nutrients = [];
  state.ledger.recordedLosses += 3000;
  const org = state.organisms[0]; org.energy = 34000;
  state.ledger.externalInflow += 24000;
  const energy = org.energy + org.structuralBiomass, before = totalAccountedEnergy(state);
  org.dissolving = true; org.dissolveAlpha = .001;
  sim.stepSimulation(state, config, 1 / 60);
  assert.equal(state.nutrients.length, 1);
  const food = state.nutrients[0];
  assert.equal(food.kind, 'carrion'); assert.equal(food.energyValue, energy);
  assert.ok(food.radius > sim.BASE_NUTRIENT_RADIUS);
  assert.equal(totalAccountedEnergy(state), before);
  assert.deepEqual(createSnapshot(restoreSnapshot(createSnapshot(state, config)).state, config), createSnapshot(state, config));
});

test('worker host and render transport preserve exact state while omitting repeated genomes', () => {
  const initial = createSnapshot(fixture(), config), direct = restoreSnapshot(initial).state;
  const host = new SimulationHost(); host.reset(initial, 1);
  const replica = new RenderReplica();
  let view = replica.apply(structuredClone(host.frame()), direct);
  for (let i = 0; i < 12; i++) {
    host.tick(); sim.stepSimulation(direct, config, 1 / 60);
  }
  const frame = structuredClone(host.frame());
  assert.equal(frame.steps, 12); assert.equal(frame.genomes.length, 0); assert.equal(frame.lineage.length, 0);
  view = replica.apply(frame, view);
  assert.deepEqual(view.organisms[0].segments, direct.organisms[0].segments);
  assert.equal(view.organisms[0].neuralHidden.length, 0);
  assert.deepEqual(host.snapshot().state, createSnapshot(direct, config).state);
  host.selected = direct.organisms[0].id;
  view = replica.apply(structuredClone(host.frame()), view);
  assert.deepEqual(view.organisms[0].learnedSensoryWeights, direct.organisms[0].learnedSensoryWeights);
  host.reset(initial, 2);
  view = replica.apply(structuredClone(host.frame()), view);
  assert.equal(view.simTime, initial.state.simTime);
});

test('worker commands honor nutrient caps, accounting, resize and exact authoritative export', () => {
  const settings = {...config, targetNutrients: 5};
  const state = createInitialWorld({...settings, targetNutrients: 0}, 81, 'balanced', 'standard', 0);
  const host = new SimulationHost(); host.reset(createSnapshot(state, settings), 1);
  assert.equal(host.action({kind: 'feed', count: 20, x: 800, y: 600}), 5);
  assert.equal(host.action({kind: 'feed-all'}), 0);
  host.action({kind: 'resize', width: 2000, height: 1200});
  assert.equal(host.settings.worldWidth, 2000);
  host.action({kind: 'clear-food'});
  assert.equal(host.state.nutrients.length, 0);
  const id = host.action({kind: 'spawn', x: 800, y: 600, archetype: 'eel'});
  assert.equal(typeof id, 'string');
  assert.ok(Math.abs(totalAccountedEnergy(host.state) - host.state.ledger.externalInflow) < 1e-5);
  const snapshot = host.snapshot({test: true});
  assert.deepEqual(createSnapshot(restoreSnapshot(snapshot).state, host.settings, {test: true}), snapshot);
});

test('pooled collision clipping exactly matches v0.32 geometry across rotations and boundaries', () => {
  const random = new sim.XoshiroPRNG(917), org = fixture('plain').organisms[0];
  for (let i = 0; i < 4000; i++) {
    const a = {...org.segments[0], x: random.range(-100, 100), y: random.range(-100, 100), angle: random.range(-Math.PI, Math.PI)};
    const b = {...a, x: a.x + random.range(-90, 90), y: a.y + random.range(-90, 90), angle: random.range(-Math.PI, Math.PI)};
    const ad = {...org.genome.parts[0], width: random.range(.01, 160), height: random.range(.01, 160)};
    const bd = {...ad, width: random.range(.01, 160), height: random.range(.01, 160)};
    assert.deepEqual(rectangleContact(a, ad, b, bd), referenceContact(a, ad, b, bd));
  }
  const a = {...org.segments[0], x: 0, y: 0, angle: 0}, def = {...org.genome.parts[0], width: 20, height: 20};
  for (const x of [0, 20, 20 - 1e-12, 20 + 1e-12])
    assert.deepEqual(rectangleContact(a, def, {...a, x}, def), referenceContact(a, def, {...a, x}, def));
  const retained = rectangleContact(a, def, a, def), copy = structuredClone(retained);
  rectangleContact({...a, angle: .7}, def, a, def);
  assert.deepEqual(retained, copy, 'returned contact must not alias reusable scratch');
});

test('sparse learning clears removed records and invalidates all old slots after topology edits', () => {
  const org = fixture().organisms[0];
  let plan = compiledBrain(org.genome);
  const check = () => {
    const actual = compiledDeltas(org, plan), motor = new Float64Array(plan.ho.length), sensory = new Float64Array(plan.ih.length);
    for (const r of org.learnedMotorWeights ?? []) {const slot = plan.motorSlots.get(r.edge); if (slot !== undefined) motor[slot] = r.delta;}
    for (const r of org.learnedSensoryWeights ?? []) {const slot = plan.sensorySlots.get(r.edge); if (slot !== undefined) sensory[slot] = r.delta;}
    assert.deepEqual(actual.motor, motor); assert.deepEqual(actual.sensory, sensory);
    return actual;
  };
  org.learnedMotorWeights = plan.motor.map(({edge}, i) => ({edge, delta: i % 2 ? -.3 : .2, eligibility: 0}));
  org.learnedSensoryWeights = plan.sensory.map(({edge}) => ({edge, delta: .1, eligibility: 0}));
  const first = check();
  org.learnedMotorWeights = alignPlasticRecords(org.learnedMotorWeights, plan.motor);
  org.learnedSensoryWeights = alignPlasticRecords(org.learnedSensoryWeights, plan.sensory);
  check();
  org.learnedMotorWeights.reverse(); check();
  org.learnedMotorWeights.length = 1;
  delete org.learnedSensoryWeights; assert.equal(check(), first);
  org.genome.disabledConnections!.push(plan.motor[0].edge);
  invalidateCompiledBrain(org.genome); plan = compiledBrain(org.genome);
  assert.notEqual(check(), first);
  org.genome.plasticityRate = 0; plan = compiledBrain(org.genome); check();
});

test('lineage transport tracks real spawning, laying, hatching, death and epoch reset', () => {
  const state = fixture('plain'); state.nutrients = [];
  const parent = state.organisms[0]; parent.age = 40; state.simTime = 50;
  parent.genome.targetClutchSize = 1; parent.genome.motorForce = 0;
  parent.energy = sim.evaluateReproductionAffordability(parent, state.simTime, 1, 0).requiredForOneEgg + 100;
  const host = new SimulationHost(); host.reset(createSnapshot(state, config), 1);
  const replica = new RenderReplica(); let view = replica.apply(structuredClone(host.frame()), state);
  const apply = () => {const frame = structuredClone(host.frame()); view = replica.apply(frame, view);
    assert.deepEqual([...view.lineage], [...host.state.lineage]); return frame;};
  assert.equal(apply().lineage.length, 0);
  host.tick(); assert.equal(host.state.eggs.length, 1);
  assert.equal(apply().lineage.length, 1);
  const egg = host.state.eggs[0]; egg.x = 400; egg.y = 400; egg.incubationProgress = 1; egg.readyToHatch = true;
  host.tick(); assert.equal(host.state.eggs.length, 0);
  assert.equal(apply().lineage.length, 1);
  const doomed = host.state.organisms[0]; doomed.dissolving = true; doomed.dissolveAlpha = .001;
  host.tick(); const death = apply(); assert.equal(death.lineage.length, 1);
  assert.equal(view.lineage.get(doomed.id)!.deathTime, host.state.simTime);
  host.action({kind: 'spawn', archetype: 'eel', x: 1800, y: 1000});
  assert.equal(apply().lineage.length, 1); assert.equal(apply().lineage.length, 0);
  const saved = host.snapshot(); host.reset(saved, 2);
  assert.equal(apply().lineage.length, saved.state.lineage.length);
  assert.deepEqual(host.snapshot(), saved);
});

test('lineage subscriptions coalesce changes, detach and avoid scanning unchanged history', () => {
  const state = fixture('plain'), id = state.organisms[0].id;
  const a = watchLineage(state.lineage), b = watchLineage(state.lineage);
  a.pending.clear(); b.pending.clear();
  markLineageChanged(state.lineage, id); markLineageChanged(state.lineage, id);
  assert.deepEqual([...a.pending], [id]); assert.deepEqual([...b.pending], [id]);
  a.pending.clear(); a.dispose(); markLineageChanged(state.lineage, id);
  assert.equal(a.pending.size, 0); b.dispose();
  const host = new SimulationHost(); host.reset(createSnapshot(state, config), 1); host.frame();
  host.state.lineage[Symbol.iterator] = () => {throw new Error('unchanged lineage was scanned');};
  assert.equal(host.frame().lineage.length, 0);
});
