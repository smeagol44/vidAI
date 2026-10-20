// Bounded component timings complement full-kernel profiles, not browser FPS.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const baseline = process.argv[2];
if (!baseline) throw new Error('Usage: node --import tsx scripts/benchmark-runtime-components.mjs <baseline-checkout>');
const load = async root => {
  const read = file => import(pathToFileURL(resolve(root, file)).href);
  return {root, ...await read('contacts.ts'), ...await read('neuralRuntime.ts'),
    ...await read('simulationHost.ts'), ...await read('persistence.ts')};
};
const {createInitialWorld} = await import('../world.ts');
const {createFounderGenome} = await import('../founders.ts');
const {markLineageChanged} = await import('../lineageChanges.ts');
const {spawnOrganism, remapBrain} = await import('../simulation.ts');
const implementations = [await load(baseline), await load('.')];
const settings = {...implementations[1].DEFAULT_SETTINGS, targetNutrients: 0};
const state = createInitialWorld(settings, 19, 'balanced', 'standard', 0);
const genome = createFounderGenome('FND-001');
genome.hiddenIds = Array.from({length: 96}, (_, i) => `component-neuron-${i}`);
genome.plasticityRate = .8; genome.sensoryPlasticityRate = .8; genome.plasticMotorScope = 'all';
remapBrain(genome);
const org = spawnOrganism(genome, 1000, 700, 0, undefined, undefined, state.prng);
const record = {id: 'ancestor', parentIds: [], generation: 1, birthTime: 0,
  offspringCount: 0, archetype: 'Component', hue: genome.hue, diet: 'Herbivore', genome};
const snapshot = implementations[1].createSnapshot(state, settings);
let expectedDeltas, expectedContact;
for (let round = 0; round < 3; round++) for (const impl of round % 2 ? [...implementations].reverse() : implementations) {
  const plan = impl.compiledBrain(genome);
  org.learnedMotorWeights = impl.alignPlasticRecords(undefined, plan.motor);
  for (const r of org.learnedMotorWeights) r.delta = .2;
  org.learnedSensoryWeights = impl.alignPlasticRecords(undefined, plan.sensory);
  for (const r of org.learnedSensoryWeights) r.delta = -.1;
  const host = new impl.SimulationHost(); host.reset(snapshot, round + 1);
  for (let i = 0; i < 10000; i++) {
    const id = `ancestor-${i}`; host.state.lineage.set(id, {...record, id}); markLineageChanged(host.state.lineage, id);
  }
  assert.equal(host.frame().lineage.length, 10000);
  const a = org.segments[0], b = {...a, x: a.x + 5, angle: a.angle + .4}, def = genome.parts[0];
  const contact = impl.rectangleContact(a, def, b, def);
  const deltas = impl.compiledDeltas(org, plan);
  const values = {motor: [...deltas.motor], sensory: [...deltas.sensory]};
  if (expectedDeltas) {assert.deepEqual(values, expectedDeltas); assert.deepEqual(contact, expectedContact);}
  else {expectedDeltas = values; expectedContact = contact;}
  const run = (count, fn) => {for (let i = 0; i < 2000; i++) fn(); const start = performance.now();
    for (let i = 0; i < count; i++) fn(); return Math.round((performance.now() - start) * 100) / 100;};
  // Fewer warm-up frames: a full old-history scan is intentionally expensive.
  for (let i = 0; i < 20; i++) host.frame();
  const start = performance.now();
  for (let i = 0; i < 300; i++) assert.equal(host.frame().lineage.length, 0);
  const lineageMs = Math.round((performance.now() - start) * 100) / 100;
  console.log(JSON.stringify({root: impl.root, round: round + 1,
    contact100kMs: run(100000, () => impl.rectangleContact(a, def, b, def)),
    learning100kMs: run(100000, () => impl.compiledDeltas(org, plan)),
    unchanged10kLineage300FramesMs: lineageMs, exactComponentMatch: true}));
}
