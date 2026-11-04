import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as sim from '../simulation';
import {FOUNDER_BLUEPRINTS, createFounderGenome, sampleFounderGenomes} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, validateGenome, totalAccountedEnergy} from '../persistence';
const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, waterViscosity: 0, mutationSeverity: 0};
function single(): sim.Genome {
  const g = createFounderGenome('FND-001');
  g.parts = [{...g.parts[0], dimN: 10, dimM: 10, width: 70, height: 70}];
  g.eyes = []; g.mouths = []; g.motorForce = 0;
  sim.remapBrain(g); return g;
}
function finish(g: sim.Genome) {
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier);
  sim.remapBrain(g); return validateGenome(g);
}
function world(g: sim.Genome, heading = 0) {
  const s = createInitialWorld(settings, 11, 'unbiased', 'standard', 0);
  const org = addExternalOrganism(s, finish(g), settings, 1200, 750, heading)!;
  return {s, org};
}
function close(a: number, b: number) { assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`); }

test('three shared organ slots support two eyes and one mouth on a single face', () => {
  const g = single();
  g.eyes = [1, 2].map(slot => ({id: `eye-${slot}`, partIndex: 0, direction: 'EAST', slot: slot as 1 | 2, range: 500, fov: 1}));
  g.mouths = [{id: 'mouth', partIndex: 0, direction: 'EAST', slot: 0, intakeWidth: 10, mouthType: 'herbivore'}];
  finish(g); assert.deepEqual(sim.surfacePlacementProblems(g), []);
  assert.equal(sim.availableOrganSlots(g).filter(p => p.direction === 'EAST').length, 0);
  const anchors = [...g.eyes, ...g.mouths].map(o => sim.getOrganAnchor(o, 70, 70));
  assert.equal(new Set(anchors.map(a => a.y)).size, 3);
  close(anchors[0].y, -anchors[1].y); close(anchors[2].y, 0);
});

test('hinges occupy both the parent face and the mating face of the child', () => {
  const g = createFounderGenome('FND-001');
  const physical = sim.physicalFaces(g.parts);
  assert.ok(physical.has('0:WEST')); assert.ok(physical.has('1:EAST'));
  for (const [partIndex, direction] of [[0, 'WEST'], [1, 'EAST']] as const) {
    const bad = structuredClone(g); bad.eyes[0] = {...bad.eyes[0], partIndex, direction, slot: 0};
    assert.throws(() => validateGenome(bad), /exclusive face/);
  }
});

for (const slot of [undefined, -1, 3, .5]) test(`new anatomy rejects invalid/missing slot ${slot}`, () => {
  const g = createFounderGenome('FND-001'); (g.eyes[0] as any).slot = slot;
  assert.throws(() => validateGenome(g));
});

test('eye and mouth cannot share a slot; invalid import leaves the source world unchanged', () => {
  const s = createInitialWorld({...DEFAULT_SETTINGS, targetNutrients: 0});
  const before = JSON.stringify(createSnapshot(s, {...DEFAULT_SETTINGS, targetNutrients: 0}));
  const bad = JSON.parse(before), g = bad.state.organisms[0].genome;
  g.eyes[0] = {...g.eyes[0], partIndex: g.mouths[0].partIndex, direction: g.mouths[0].direction, slot: g.mouths[0].slot};
  assert.throws(() => restoreSnapshot(bad));
  assert.equal(JSON.stringify(createSnapshot(s, {...DEFAULT_SETTINGS, targetNutrients: 0})), before);
});

test('organ capacity is per face, not a global five-eye/three-mouth restriction', () => {
  const g = single(); let i = 0;
  for (const direction of sim.CARDINAL_DIRS) for (const slot of [0, 1, 2] as const) {
    if (i++ < 6) g.eyes.push({id: `eye-${i}`, partIndex: 0, direction, slot, fov: 1, range: 500});
    else g.mouths.push({id: `mouth-${i}`, partIndex: 0, direction, slot, intakeWidth: 5, mouthType: 'omnivore'});
  }
  const {s, org} = world(g); assert.equal(sim.availableOrganSlots(g).length, 0);
  assert.ok(g.inputKeys!.length > 128);
  const restored = restoreSnapshot(createSnapshot(s, settings));
  for (let i = 0; i < 5; i++) {sim.stepSimulation(s, settings, 1 / 60); sim.stepSimulation(restored.state, settings, 1 / 60);}
  assert.equal(org.rayHits.length, 30);
  assert.deepEqual(createSnapshot(s, settings), createSnapshot(restored.state, settings));
});

test('slot position controls actual feeding contact rather than the old face center', () => {
  for (const onSlot of [true, false]) {
    const g = single(); g.mouths = [{id: 'mouth', partIndex: 0, direction: 'EAST', slot: 1, intakeWidth: 1, mouthType: 'herbivore'}];
    const {s, org} = world(g), a = sim.getOrganAnchor(g.mouths[0], 70, 70);
    s.nutrients = [{id: 'food', x: 1200 + a.x, y: 750 + (onSlot ? a.y : 0), vx: 0, vy: 0, radius: 1, energyValue: 3000, bottomTimer: 0}];
    const before = totalAccountedEnergy(s); sim.stepSimulation(s, settings, 1 / 60);
    assert.equal(org.recentFeedings!.length > 0, onSlot);
    close(totalAccountedEnergy(s), before);
  }
});

test('slotted eyes cast from their exact anchors after host rotation', () => {
  const g = single(); g.eyes = [{id: 'eye', partIndex: 0, direction: 'EAST', slot: 2, range: 500, fov: 1}];
  const {s, org} = world(g, Math.PI / 2), a = sim.getOrganAnchor(g.eyes[0], 70, 70);
  sim.stepSimulation(s, settings, 1 / 60);
  const hit = org.rayHits[2]; close(hit.pointX, 1200 - a.y); close(hit.pointY, 750 + a.x + 500);
});

test('all built-in organs obey exclusive faces and their declared stable slots', () => {
  for (const d of FOUNDER_BLUEPRINTS) {
    const g = createFounderGenome(d.id); assert.deepEqual(sim.surfacePlacementProblems(g), [], d.id);
    validateGenome(g); assert.deepEqual(g.eyes, d.morphology.eyes); assert.deepEqual(g.mouths, d.morphology.mouths);
  }
});

test('mutations keep valid surface slots after additions, pruning and branch changes', () => {
  let g = createFounderGenome('FND-036'); const prng = new sim.XoshiroPRNG(1801);
  let increasedEyes = false, increasedMouths = false;
  for (let i = 0; i < 700; i++) {
    g = sim.mutateGenome(g, .8, prng);
    assert.deepEqual(sim.surfacePlacementProblems(g), [], `generation ${i}`); validateGenome(g);
    increasedEyes ||= g.eyes.length > 5; increasedMouths ||= g.mouths.length > 3;
  }
  assert.ok(increasedEyes); assert.ok(increasedMouths);
});

test('normalization preserves organ identities and finds open slots deterministically', () => {
  const g = createFounderGenome('FND-011'); const original = [...g.eyes, ...g.mouths].map(o => o.id);
  for (const o of [...g.eyes, ...g.mouths]) {o.partIndex = 0; o.direction = 'WEST'; o.slot = 0;}
  const other = structuredClone(g); sim.normalizeSurfaceOrgans(g); sim.normalizeSurfaceOrgans(other);
  assert.deepEqual(g, other); assert.deepEqual(sim.surfacePlacementProblems(g), []);
  assert.deepEqual([...g.eyes, ...g.mouths].map(o => o.id), original);
});

for (const count of [0, 1, 3, 18, 50]) test(`startup samples at most five designs for ${count} independent organisms`, () => {
  const a = sampleFounderGenomes(new sim.XoshiroPRNG(71), count);
  assert.equal(a.length, count); assert.equal(new Set(a.map(g => g.id)).size, Math.min(count, 5));
  assert.deepEqual(a, sampleFounderGenomes(new sim.XoshiroPRNG(71), count));
  if (count > 5) {
    const clone = a[5].weightsIH[0][0]; a[0].weightsIH[0][0] += 1; assert.equal(a[5].weightsIH[0][0], clone);
    const sizes = [...new Set(a.map(g => g.id))].map(id => a.filter(g => g.id === id).length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  }
});

test('fresh startup honors the configured nutrient target, seed-varying designs and population cap', () => {
  const designs = new Set<string>();
  for (const seed of [71, 81, 4242]) {
    const s = createInitialWorld(DEFAULT_SETTINGS, seed); assert.equal(s.organisms.length, 18); assert.equal(s.nutrients.length, DEFAULT_SETTINGS.targetNutrients);
    designs.add(JSON.stringify([...new Set(s.organisms.map(o => o.genome.id))]));
    const small = createInitialWorld({...DEFAULT_SETTINGS, maxOrganisms: 3}, seed); assert.equal(small.organisms.length, 3);
    assert.equal(new Set(small.organisms.map(o => o.genome.id)).size, 3);
  }
  assert.equal(designs.size, 3);
});

test('legacy v6 layout, memory and organ IDs survive import without forced relocation', () => {
  const legacy = JSON.parse(readFileSync(new URL('./fixtures/v5-motor-world.json', import.meta.url), 'utf8'));
  const migrated = restoreSnapshot(legacy), snapshot = createSnapshot(migrated.state, migrated.settings);
  snapshot.schemaVersion = '6.0.0';
  const before = structuredClone(snapshot.state.organisms[0]);
  const restored = restoreSnapshot(snapshot), org = restored.state.organisms[0];
  assert.deepEqual(org.genome.eyes, before.genome.eyes); assert.deepEqual(org.genome.mouths, before.genome.mouths);
  assert.deepEqual(org.neuralHidden, before.neuralHidden); assert.deepEqual(org.segments, before.segments);
  assert.equal(org.genome.anatomyVersion, undefined);
  const child = sim.mutateGenome(org.genome, .4, new sim.XoshiroPRNG(9));
  assert.equal(child.anatomyVersion, 1); assert.deepEqual(sim.surfacePlacementProblems(child), []);
});

test('compact jellyfish swims in both brain modes with no passive propulsion', () => {
  const measurements = [];
  for (const mode of ['balanced', 'unbiased'] as const) for (const motors of [true, false]) {
    const g = createFounderGenome('FND-051', mode); assert.equal(g.parts.length, 5);
    if (!motors) g.motorForce = 0;
    const opts = {...settings, waterViscosity: .18};
    const s = createInitialWorld(opts, 7, 'unbiased', 'standard', 0);
    const org = addExternalOrganism(s, g, opts, 1200, 750, 0)!, start = sim.calculateOrganismCOM(org);
    for (let i = 0; i < 900; i++) sim.stepSimulation(s, opts, 1 / 60);
    const end = sim.calculateOrganismCOM(org), distance = Math.hypot(end.x - start.x, end.y - start.y);
    assert.ok(org.segments.every(p => Object.values(p).every(Number.isFinite))); assert.ok(org.energy > 0);
    assert.ok(motors ? distance > 50 : distance < 1e-6, `${mode}, motors ${motors}, ${distance}px`);
    close(totalAccountedEnergy(s), s.ledger.externalInflow);
    measurements.push({mode, motors, distance, energy: org.energy});
  }
  console.log('JELLYFISH', JSON.stringify(measurements));
});

test('preset factories create valid bodies and exclusive organ faces, including old rotated fins', () => {
  for (const id of ['eel', 'flapper', 'tadpole', 'glider', 'predator', 'nematode', 'random'] as const) {
    const g = sim.createArchetypeGenome(id, 1, [], new sim.XoshiroPRNG(14));
    assert.deepEqual(sim.morphologyProblems(g.parts), [], id); assert.deepEqual(sim.surfacePlacementProblems(g), [], id);
    validateGenome(g);
  }
});

test('legacy overlapping fins are repaired in descendants without modifying the saved parent', () => {
  for (const make of [sim.createMantaFlapperGenome, sim.createHydrofoilGliderGenome]) {
    const parent = make(1, [], new sim.XoshiroPRNG(21)), before = structuredClone(parent);
    assert.ok(sim.morphologyProblems(parent.parts).length > 0);
    const child = sim.mutateGenome(parent, .000001, new sim.XoshiroPRNG(81));
    assert.deepEqual(parent.parts, before.parts); assert.equal(child.anatomyVersion, 1);
    assert.deepEqual(sim.morphologyProblems(child.parts), []); assert.deepEqual(sim.surfacePlacementProblems(child), []);
    validateGenome(child);
  }
});
