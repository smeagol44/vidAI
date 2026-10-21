import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createInitialWorld, addExternalOrganism, collectWorldStats} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy, clearFreeNutrients} from '../persistence';

const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0, kinshipProtection: false};
function genome(type?: sim.MouthType) {
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(7));
  g.parts = [g.parts[0]]; g.motorForce = 0; g.eyes = [];
  g.mouths = type ? [{id: 'mouth', partIndex: 0, direction: 'EAST', intakeWidth: 12, mouthType: type}] : [];
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier);
  sim.remapBrain(g);
  return g;
}
function setup(type: sim.MouthType = 'herbivore') {
  const s = createInitialWorld(settings, 7, 'unbiased', 'standard', 0);
  const g = genome(type), org = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
  const x = 1200 + g.parts[0].width / 2;
  return {s, org, x};
}
function food(x: number, kind: 'nutrient' | 'carrion' = 'nutrient', energyValue = 3000): sim.Nutrient {
  return {id: 'food', x, y: 750, vx: 0, vy: 0, energyValue, radius: sim.getNutrientRadius(energyValue),
    bottomTimer: 0, pulseTimer: 0, kind, ...(kind === 'carrion' ? {decayTimeRemaining: sim.CARRION_DECAY_SECONDS} : {})};
}
function conserved(s: sim.SimulationState, before: number) {
  assert.ok(Math.abs(totalAccountedEnergy(s) - before) < 1e-6);
}

for (const dt of [1 / 30, 1 / 60, 1 / 120]) test(`one mouth shares its intake limit across six particles, dt=${dt}`, () => {
  const {s, x} = setup(); s.nutrients = Array.from({length: 6}, (_, i) => ({...food(x), id: `food${i}`}));
  const before = totalAccountedEnergy(s);
  for (let t = 0; t < Math.round(1 / dt); t++) sim.stepSimulation(s, settings, dt);
  const removed = 18000 - s.nutrients.reduce((sum, n) => sum + n.energyValue, 0);
  assert.ok(Math.abs(removed - sim.CONTINUOUS_EAT_RATE) < 1e-6, `${removed} J in one second`);
  conserved(s, before);
});

test('omnivore mouth shares one budget across living prey, eggs and free food', () => {
  const {s, org, x} = setup('omnivore');
  const prey = addExternalOrganism(s, genome(), settings, x + org.genome.parts[0].width / 2, 750, 0)!;
  prey.energy = 3;
  const eggG = genome();
  s.eggs.push({id: 'egg', clutchId: 'c', parentOrgId: 'foreign', x, y: 750, vx: 0, vy: 0,
    genome: eggG, fundedReserve: 4, fundedStructural: 0, incubationProgress: 0, totalIncubationTime: 100,
    pulseTimer: 0, colorHue: 40, readyToHatch: false});
  s.nutrients = [food(x)];
  const before = totalAccountedEnergy(s);
  sim.stepSimulation(s, settings, 1 / 60);
  const events = org.recentFeedings!;
  assert.deepEqual(events.map(e => e.foodCategory), ['Prey', 'Egg', 'Nutrient']);
  assert.ok(Math.abs(events.reduce((sum, e) => sum + e.energyTransferred, 0) - sim.OMNIVORE_EAT_RATE / 60 * sim.MOUTH_ASSIMILATION) < 1e-6);
  conserved(s, before);
});

for (const type of ['herbivore', 'carnivore', 'omnivore'] as const) {
  for (const kind of ['nutrient', 'carrion'] as const) test(`${type} permissions for ${kind}`, () => {
    const {s, org, x} = setup(type); s.nutrients = [food(x, kind)];
    const before = totalAccountedEnergy(s);
    sim.stepSimulation(s, settings, 1 / 60);
    const allowed = type === 'omnivore' || (kind === 'nutrient' ? type === 'herbivore' : type === 'carnivore');
    assert.equal(s.nutrients[0].energyValue < 3000, allowed);
    assert.equal(Boolean(org.recentFeedings?.length), allowed);
    if (allowed) assert.equal(org.recentFeedings![0].foodCategory, kind === 'carrion' ? 'Carrion' : 'Nutrient');
    conserved(s, before);
  });
}

for (const reverse of [false, true]) test(`a reserve-exhausting bite records predation in either organism order (${reverse})`, () => {
  const {s, org, x} = setup('carnivore');
  const prey = addExternalOrganism(s, genome(), settings, x + org.genome.parts[0].width / 2, 750, 0)!;
  prey.energy = 10;
  if (reverse) s.organisms.reverse();
  const before = totalAccountedEnergy(s);
  sim.stepSimulation(s, settings, 1 / 60);
  assert.equal(prey.deathCause, 'Predation'); assert.equal(prey.dissolving, true);
  assert.ok(prey.structuralBiomass > 0); assert.equal(org.preyEaten, 1);
  for (let i = 0; i < 45; i++) sim.stepSimulation(s, settings, 1 / 60);
  assert.equal(s.recentDeaths[0].cause, 'Predation');
  assert.equal(s.totalDeaths, 1); assert.ok(s.nutrients.some(n => n.kind === 'carrion'));
  conserved(s, before);
});

test('full storage limits removal to the energy just spent and never destroys surplus food', () => {
  const {s, org, x} = setup(); org.energy = org.genome.maxEnergyCapacity;
  s.nutrients = Array.from({length: 6}, () => food(x));
  const before = totalAccountedEnergy(s);
  sim.stepSimulation(s, settings, 1 / 60);
  const removed = 18000 - s.nutrients.reduce((sum, n) => sum + n.energyValue, 0);
  assert.ok(removed <= org.totalEnergyRate! / 60 / sim.MOUTH_ASSIMILATION + 1e-6);
  assert.ok(Math.abs(org.energy - org.genome.maxEnergyCapacity) < 1e-6);
  assert.equal(s.ledger.recordedLosses, 0); conserved(s, before);
});

test('remains preserve all body energy, survive clearing plant food, and decay without new energy', () => {
  const {s, org, x} = setup();
  const bodyEnergy = org.energy + org.structuralBiomass;
  org.dissolving = true; org.dissolveAlpha = .001;
  const before = totalAccountedEnergy(s);
  sim.stepSimulation(s, settings, 1 / 60);
  assert.ok(s.nutrients.every(n => n.kind === 'carrion'));
  assert.equal(s.nutrients.reduce((sum, n) => sum + n.energyValue, 0), bodyEnergy);
  const count = s.nutrients.length;
  s.nutrients.push(food(x)); clearFreeNutrients(s);
  assert.equal(s.nutrients.length, count);
  s.nutrients.forEach(n => { n.decayTimeRemaining = 1 / 60; });
  sim.stepSimulation(s, {...settings, targetNutrients: count}, 1 / 60);
  assert.ok(s.nutrients.every(n => n.kind === 'nutrient'));
  conserved(s, before + 3000);
});

test('carrion does not fill the environmental plant-food target', () => {
  const {s, x} = setup(); s.nutrients = [food(x + 200, 'carrion')];
  sim.stepSimulation(s, {...settings, targetNutrients: 1, inflowRate: 60}, 1 / 60);
  const stats = collectWorldStats(s, 1);
  assert.equal(stats.nutrientCount, 1); assert.equal(stats.carrionCount, 1);
});

test('body pigment is independent of mouth types and inherited variability can preserve all color channels', () => {
  for (const type of ['herbivore', 'carnivore', 'omnivore'] as const) {
    const g = genome(type); g.hue = 120; g.saturation = 32; g.lightness = 76; g.colorMutationRate = 0;
    const rng = new sim.XoshiroPRNG(37);
    for (let i = 0; i < 100; i++) {
      const child = sim.mutateGenome(g, 1, rng);
      assert.deepEqual([child.hue, child.saturation, child.lightness], [120, 32, 76]);
    }
  }
  assert.equal(sim.sanitizeCreatureHue(120), 120);
  assert.equal(sim.sanitizeCreatureHue(-10), 350);
});

test('near-zero world mutation no longer triggers forced predator recoloring', () => {
  const g = genome('carnivore'); g.hue = 200;
  const rng = new sim.XoshiroPRNG(37);
  for (let i = 0; i < 100; i++) assert.equal(sim.mutateGenome(g, 1e-7, rng).hue, 200);
});

test('eyes see the same unrestricted body pigment used for rendering', () => {
  const {s, org} = setup();
  org.genome.eyes = [{id: 'eye', partIndex: 0, direction: 'EAST', range: 500, fov: .8}];
  sim.remapBrain(org.genome);
  org.neuralInputs = new Array(org.genome.inputKeys!.length).fill(0);
  const targetG = genome(); targetG.hue = 120; targetG.saturation = 80; targetG.lightness = 60;
  const target = addExternalOrganism(s, targetG, settings, 1400, 750, 0)!;
  target.energy = targetG.maxEnergyCapacity;
  sim.stepSimulation(s, settings, 1 / 60);
  const hit = org.rayHits.find(r => r.rayIndex === 2)!;
  assert.equal(hit.objectType, 'creature');
  const pigment = sim.hslToRgb(...sim.getBodyPigment(target, 0));
  const visibility = Math.exp(-hit.dist / (500 * .55));
  const expected = pigment.map((c, i) => (1 - visibility) * sim.WATER_AMBIENT_RGB[i] + visibility * c);
  [hit.r, hit.g, hit.b].forEach((c, i) => assert.ok(Math.abs(c - expected[i]) < 1e-9));
});

test('mouth combinations classify by their edible categories without a fourth diet', () => {
  const mouths = (types: sim.MouthType[]) => types.map((mouthType, i) => ({...genome(mouthType).mouths[0], id: `m${i}`}));
  for (const types of [['omnivore'], ['herbivore', 'carnivore'], ['herbivore', 'omnivore'], ['carnivore', 'omnivore']] as sim.MouthType[][])
    assert.equal(sim.getDietClassification(mouths(types)).category, 'Omnivore');
  assert.equal(sim.getDietClassification(mouths(['carnivore', 'carnivore'])).category, 'Carnivore');
});

test('new saves continue exactly through carrion decay, and old v4 food remains plant food', () => {
  const {s, org, x} = setup(); org.genome.colorMutationRate = .4;
  s.nutrients = [food(x + 200, 'carrion')]; s.nutrients[0].decayTimeRemaining = .025;
  const snapshot = createSnapshot(s, settings), restored = restoreSnapshot(snapshot);
  assert.equal(snapshot.schemaVersion, '12.0.0');
  assert.deepEqual(createSnapshot(restored.state, restored.settings), snapshot);
  for (let i = 0; i < 3; i++) { sim.stepSimulation(s, settings, 1 / 60); sim.stepSimulation(restored.state, settings, 1 / 60); }
  assert.deepEqual(createSnapshot(s, settings), createSnapshot(restored.state, settings));
  const old = createSnapshot(s, settings); old.schemaVersion = '4.0.0';
  delete old.state.organisms[0].genome.colorMutationRate; delete old.state.nutrients[0].kind;
  const imported = restoreSnapshot(old);
  assert.equal(collectWorldStats(imported.state, 0).carrionCount, 0);
  const invalid = createSnapshot(s, settings); invalid.state.nutrients[0].kind = 'carrion'; invalid.state.nutrients[0].decayTimeRemaining = -1;
  assert.throws(() => restoreSnapshot(invalid));
  const invalidColor = createSnapshot(s, settings); invalidColor.state.organisms[0].genome.colorMutationRate = 2;
  assert.throws(() => restoreSnapshot(invalidColor));
});
