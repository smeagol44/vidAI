import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {FOUNDER_BLUEPRINTS, createFounderGenome, createFounderBankItems} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy, clearFreeNutrients, resizeWorld, diagnosticReport} from '../persistence';
import {runProductionChecks} from '../diagnostics';

const noFood = {...DEFAULT_SETTINGS, worldWidth: 12000, worldHeight: 12000, targetNutrients: 0, inflowRate: 0, waterViscosity: .22};
function isolated(g: sim.Genome) {
  const s = createInitialWorld({...noFood, maxOrganisms: 100}, 4242, 'unbiased', 'standard', 0);
  const org = addExternalOrganism(s, g, noFood, 6000, 6000, 0)!;
  s.caustics = [];
  return {s, org};
}

test('all 55 catalogue bodies are distinct, valid, finite and able to swim', () => {
  const fingerprints = new Set<string>();
  const measurements = [];
  assert.equal(FOUNDER_BLUEPRINTS.length, 55);
  for (const d of FOUNDER_BLUEPRINTS) {
    const g = createFounderGenome(d.id);
    assert.deepEqual(sim.morphologyProblems(g.parts), [], d.id);
    const fingerprint = JSON.stringify(g.parts.map(p => [p.parentIndex, p.attachmentPoint, p.dimN, p.dimM]));
    assert.ok(!fingerprints.has(fingerprint), `duplicate anatomy ${d.id}`); fingerprints.add(fingerprint);
    // Phase 5 intentionally corrects only FND-001's inherited joint wave
    // direction; all raw geometries, organs and remaining founders are exact.
    const expectedParts = structuredClone(d.morphology.parts);
    if (d.id === 'FND-001') for (const p of expectedParts.slice(1)) p.cpgPhaseOffset *= -1;
    assert.deepEqual(g.parts, expectedParts);
    const {s, org} = isolated(g), start = sim.calculateOrganismCOM(org);
    for (let i = 0; i < 900; i++) sim.stepSimulation(s, noFood, 1 / 60);
    const end = sim.calculateOrganismCOM(org);
    assert.ok(!org.dissolving && org.energy > 0, d.id);
    assert.ok(org.segments.every(p => Object.values(p).every(Number.isFinite)), d.id);
    assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-5, d.id);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    assert.ok(distance > 5, `${d.id} did not translate: ${distance}px`);
    measurements.push({id: d.id, displacementPx: Math.round(distance), energy: Math.round(org.energy)});
  }
  console.log('CATALOGUE', JSON.stringify(measurements));
  assert.equal(FOUNDER_BLUEPRINTS.filter(d => d.diet === 'herbivore').length, 32);
  assert.equal(FOUNDER_BLUEPRINTS.filter(d => d.diet === 'omnivore').length, 12);
  assert.equal(FOUNDER_BLUEPRINTS.filter(d => d.diet === 'carnivore').length, 11);
});

test('zero-mutation inheritance preserves all traits and weights over ten generations', () => {
  for (const d of FOUNDER_BLUEPRINTS) {
    let g = createFounderGenome(d.id), initial = structuredClone(g);
    const prng = new sim.XoshiroPRNG(d.seed);
    for (let i = 0; i < 10; i++) {
      g = sim.mutateGenome(g, 0, prng);
      const omitIdentity = (genome: sim.Genome) => {
        const {id, parentIds, generation, ...traits} = genome; return traits;
      };
      assert.deepEqual(omitIdentity(g), omitIdentity(initial), d.id);
    }
  }
});

test('structural mutations retain valid geometry and organ hosts', () => {
  let g = createFounderGenome('FND-036');
  const prng = new sim.XoshiroPRNG(91);
  const partCounts = new Set<number>();
  for (let i = 0; i < 500; i++) {
    g = sim.mutateGenome(g, .6, prng); partCounts.add(g.parts.length);
    assert.deepEqual(sim.morphologyProblems(g.parts), [], `generation ${i}`);
    assert.ok([...g.eyes, ...g.mouths].every(o => o.partIndex >= 0 && o.partIndex < g.parts.length));
    assert.equal(g.weightsIH[0].length, sim.getBrainLayout(g).inputs.length);
    assert.equal(g.weightsHO.length, (g.parts.length - 1) * sim.OUTPUTS_PER_JOINT);
  }
  assert.ok(partCounts.size > 1, 'body-part count actually evolves');
});

test('remapping by IDs preserves surviving eye and joint pathways after a middle leaf is pruned', () => {
  const parent = createFounderGenome('FND-011');
  parent.weightsIH[3] = parent.inputKeys!.map((_, i) => i / 100);
  parent.weightsHO.forEach((row, i) => row.fill(i / 10));
  const child = structuredClone(parent);
  const removedIndex = 2;
  child.parts.splice(removedIndex, 1);
  child.parts.forEach(p => { if (p.parentIndex > removedIndex) p.parentIndex--; });
  sim.remapBrain(child, parent);
  child.inputKeys!.forEach((key, i) => assert.equal(child.weightsIH[3][i], parent.weightsIH[3][parent.inputKeys!.indexOf(key)]));
  child.outputKeys!.forEach((key, i) => assert.deepEqual(child.weightsHO[i], parent.weightsHO[parent.outputKeys!.indexOf(key)]));
});

test('every eye and every joint supplies RGB, distance, angle and velocity inputs', () => {
  const g = createFounderGenome('FND-050');
  const {s, org} = isolated(g);
  sim.stepSimulation(s, noFood, 1 / 60);
  assert.equal(org.rayHits.length, g.eyes.length * 5);
  assert.equal(org.neuralInputs.length, g.eyes.length * 20 + (g.parts.length - 1) * 2 + 7 + g.mouths.length * 2);
  for (const eye of g.eyes) {
    assert.equal(org.rayHits.filter(r => r.eyeId === eye.id).length, 5);
    assert.ok(g.inputKeys!.includes(`eye:${eye.id}:ray:4:distance`));
  }
  for (const part of g.parts.slice(1)) assert.ok(g.inputKeys!.includes(`joint:${part.id}:velocity`));
});

test('balanced steering responds oppositely to mirrored retinal food signals', () => {
  const g = createFounderGenome('FND-001', 'balanced');
  const response = (ray: number) => {
    const input = new Array(g.inputKeys!.length).fill(0);
    input[ray * 4 + 1] = 1;
    const hidden = g.weightsIH.map((row, i) => Math.tanh(row.reduce((sum, w, j) => sum + w * input[j], g.biasesH[i])));
    return hidden[0] * g.weightsHO[0][0] + hidden[1] * g.weightsHO[0][1];
  };
  assert.ok(response(0) * response(4) < 0);
  assert.notDeepEqual(g.weightsIH, createFounderGenome('FND-001', 'unbiased').weightsIH);
});

test('zero target seeds no food and prevents environmental inflow', () => {
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0};
  const s = createInitialWorld(settings);
  assert.equal(s.nutrients.length, 0);
  for (let i = 0; i < 600; i++) sim.stepSimulation(s, settings, 1 / 60);
  assert.equal(s.nutrients.length, 0);
});

test('clearing food and resizing preserve energy and rigid joint geometry', () => {
  const s = createInitialWorld(DEFAULT_SETTINGS);
  const before = totalAccountedEnergy(s);
  const distances = s.organisms.map(o => o.segments.map(p => Math.hypot(p.x - o.segments[0].x, p.y - o.segments[0].y)));
  clearFreeNutrients(s);
  resizeWorld(s, DEFAULT_SETTINGS, 800, 600);
  s.organisms.forEach((o, i) => o.segments.forEach((p, j) => assert.ok(Math.abs(Math.hypot(p.x - o.segments[0].x, p.y - o.segments[0].y) - distances[i][j]) < 1e-8)));
  assert.ok(Math.abs(totalAccountedEnergy(s) - before) < 1e-5);
});

test('gravity uses the same acceleration units for bodies, eggs and nutrients', () => {
  const settings = {...DEFAULT_SETTINGS, waterViscosity: 0, targetNutrients: 0, inflowRate: 0, gravity: 120};
  const s = createInitialWorld(settings, 7, 'unbiased', 'standard', 0);
  const g = createFounderGenome('FND-001'); g.motorForce = 0;
  const o = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
  s.nutrients.push({id: 'n', x: 100, y: 100, vx: 0, vy: 0, energyValue: 3000, radius: 18, bottomTimer: 0});
  s.eggs.push({id: 'e', clutchId: 'c', parentOrgId: o.id, x: 500, y: 500, vx: 0, vy: 0, genome: structuredClone(g),
    fundedReserve: 10000, fundedStructural: g.bodyCost, incubationProgress: 0, totalIncubationTime: 100,
    pulseTimer: 0, colorHue: 200, readyToHatch: false});
  sim.stepSimulation(s, settings, 1 / 60);
  assert.ok(Math.abs(sim.calculateOrganismCOM(o).vyCOM - 2) < 1e-6);
  assert.equal(s.nutrients[0].vy, 2); assert.equal(s.eggs[0].vy, 2);
});

test('population cap covers manual additions, seeding, hatching and reproduction', () => {
  const settings = {...DEFAULT_SETTINGS, maxOrganisms: 1};
  const s = createInitialWorld(settings);
  assert.equal(s.organisms.length, 1);
  assert.equal(addExternalOrganism(s, createFounderGenome('FND-006'), settings, 500, 500), null);
  const org = s.organisms[0]; org.age = 40; org.energy = org.genome.maxEnergyCapacity;
  sim.stepSimulation(s, settings, 1 / 60); assert.equal(s.eggs.length, 0);
  s.eggs.push({id: 'e', clutchId: 'c', parentOrgId: org.id, x: 500, y: 500, vx: 0, vy: 0,
    genome: createFounderGenome('FND-006'), fundedReserve: 10000, fundedStructural: 10000,
    incubationProgress: 1, totalIncubationTime: 1, pulseTimer: 0, colorHue: 200, readyToHatch: false});
  sim.stepSimulation(s, settings, 1 / 60); assert.equal(s.organisms.length, 1); assert.equal(s.eggs.length, 1);
});

test('snapshot round-trip continues exactly, including PRNG, fractional inflow and hatching IDs', () => {
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 25, inflowRate: 1.7};
  const s = createInitialWorld(settings, 81);
  s.nutrients.splice(0, 10); s.ledger.recordedLosses += 30000;
  for (let i = 0; i < 19; i++) sim.stepSimulation(s, settings, 1 / 60);
  const g = createFounderGenome('FND-006');
  s.eggs.push({id: 'round-trip', clutchId: 'c', parentOrgId: s.organisms[0].id, x: 200, y: 200, vx: 0, vy: 0,
    genome: g, fundedReserve: 10000, fundedStructural: g.bodyCost, incubationProgress: .95, totalIncubationTime: 1,
    pulseTimer: 0, colorHue: 200, readyToHatch: false});
  const snapshot = JSON.stringify(createSnapshot(s, settings, {seed: 81}));
  const restored = restoreSnapshot(snapshot);
  assert.deepEqual(createSnapshot(restored.state, restored.settings, {seed: 81}), JSON.parse(snapshot));
  for (let i = 0; i < 180; i++) { sim.stepSimulation(s, settings, 1 / 60); sim.stepSimulation(restored.state, restored.settings, 1 / 60); }
  assert.deepEqual(createSnapshot(s, settings), createSnapshot(restored.state, restored.settings));
});

test('invalid snapshots reject atomically; catalogue clones and diagnostic reports do not consume world randomness', () => {
  const s = createInitialWorld(DEFAULT_SETTINGS), before = s.prng.getState();
  const report = diagnosticReport(s, DEFAULT_SETTINGS, s.organisms[0].id);
  assert.equal(report.population.living, 18); assert.ok(report.selected); assert.ok(Math.abs(report.energy.errorJ) < 1e-5);
  const a = createFounderBankItems(), b = createFounderBankItems();
  a[0].genome.parts[0].dimN = 9; assert.notEqual(a[0].genome.parts[0].dimN, b[0].genome.parts[0].dimN);
  assert.deepEqual(s.prng.getState(), before);
  const invalid = createSnapshot(s, DEFAULT_SETTINGS); invalid.state.organisms[0].segments[0].x = NaN;
  assert.throws(() => restoreSnapshot(invalid));
  assert.ok(Number.isFinite(s.organisms[0].segments[0].x));
});

test('legacy v3 saves migrate sensory weights and activations without dropping hidden memory', () => {
  const oldGenome = sim.createReferenceNematodeGenome();
  const s = isolated(structuredClone(oldGenome)).s;
  const o = s.organisms[0]; o.genome = oldGenome;
  o.neuralInputs = new Array(22).fill(.25); o.neuralOutputs = new Array(24).fill(.1);
  o.neuralHidden.fill(.37);
  const raw = {schemaVersion: '3.0.0', simTime: 3, organisms: [o], eggs: [], nutrients: [],
    ledger: s.ledger, prngState: s.prng.getState(), lineage: []};
  const loaded = restoreSnapshot(JSON.stringify(raw));
  const migrated = loaded.state.organisms[0];
  assert.equal(migrated.genome.brainVersion, 7);
  assert.equal(migrated.neuralInputs.length, 33);
  assert.ok(migrated.neuralHidden.every(value => value === .37));
  const angleIndex = migrated.genome.inputKeys!.indexOf('joint:part-1:angle');
  assert.equal(migrated.neuralInputs[angleIndex], .25 / oldGenome.parts[1].maxAngle);
  assert.equal(migrated.genome.weightsIH[0][angleIndex], oldGenome.weightsIH[0][15] * oldGenome.parts[1].maxAngle);
});

test('in-game verification runs real checks without consuming the live/global PRNG', async () => {
  const before = sim.rng.getState();
  const result = await runProductionChecks();
  assert.deepEqual(sim.rng.getState(), before);
  assert.ok(Object.entries(result).filter(([key]) => key !== 'details').every(([, value]) => value === true), JSON.stringify(result));
  console.log('DIAGNOSTICS', JSON.stringify(result));
});

for (const seed of [4242, 71, 1901]) test(`actual default initialization: 60 seconds, seed ${seed}`, () => {
  const s = createInitialWorld(DEFAULT_SETTINGS, seed);
  assert.equal(s.organisms.length, 18); assert.equal(s.nutrients.length, 275);
  for (let i = 0; i < 3600; i++) sim.stepSimulation(s, DEFAULT_SETTINGS, 1 / 60);
  assert.ok(s.organisms.filter(o => !o.dissolving).length > 0);
  assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-4);
  console.log('DEFAULT', JSON.stringify({seed, simTime: s.simTime, living: s.organisms.filter(o => !o.dissolving).length,
    births: s.totalBirths, deaths: s.totalDeaths, eggs: s.eggs.length, energyErrorJ: totalAccountedEnergy(s) - s.ledger.externalInflow}));
});
