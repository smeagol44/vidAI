import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createInitialWorld, addExternalOrganism} from '../world';
import {LEGACY_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';

const settings = {...LEGACY_SETTINGS, worldWidth: 12000, worldHeight: 12000, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
function fixture(single = false) {
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(9));
  if (single) { g.parts = [g.parts[0]]; g.eyes = []; }
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier);
  sim.ensureBrainLayout(g); g.weightsHO.forEach(row => row.fill(0)); g.biasesO.fill(0);
  const s = createInitialWorld(settings, 9, 'unbiased', 'standard', 0);
  const org = addExternalOrganism(s, g, settings, 6000, 6000, 0)!;
  s.caustics = [];
  return {s, org};
}
function command(org: sim.Organism, channel: string, value: number, joint?: number) {
  org.genome.outputKeys!.forEach((key, i) => {
    if (key.endsWith(`:${channel}`) && (joint === undefined || key.startsWith(`joint:${org.genome.parts[joint + 1].id}:`)))
      org.genome.biasesO[i] = Math.atanh(value);
  });
}
function seconds(s: sim.SimulationState, duration: number, dt = 1 / 60, viscosity = settings.waterViscosity) {
  for (let i = 0; i < Math.round(duration / dt); i++) sim.stepSimulation(s, {...settings, waterViscosity: viscosity}, dt);
}
function assertConserved(s: sim.SimulationState) {
  assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-6);
}

test('brain disengagement reaches zero active torque and can resume the same inherited gait', () => {
  const {s, org} = fixture();
  command(org, 'Engage', -.9);
  sim.stepSimulation(s, settings, 1 / 60);
  assert.ok(org.joints.every(j => j.engagement! > .8 && j.engagement! < 1), 'smooth response, not an instant snap');
  seconds(s, 2);
  assert.ok(org.joints.every(j => j.engagement === 0 && j.appliedTorque === 0));
  const heat = s.ledger.mechanicalWorkHeat;
  seconds(s, 2); assert.equal(s.ledger.mechanicalWorkHeat, heat);
  const start = sim.calculateOrganismCOM(org);
  command(org, 'Engage', 0); seconds(s, 5);
  const end = sim.calculateOrganismCOM(org);
  assert.ok(org.joints.every(j => j.engagement! > .99));
  assert.ok(s.ledger.mechanicalWorkHeat > heat);
  assert.ok(Math.hypot(end.x - start.x, end.y - start.y) > 25);
  assertConserved(s);
});

test('amplitude can reach zero while an engaged motor holds its joint target', () => {
  const {s, org} = fixture(); command(org, 'Amp', -.9); seconds(s, 2);
  assert.ok(org.joints.every(j => j.amplitude === 0 && j.targetAngle === 0 && j.engagement === 1));
  command(org, 'Amp', .5); seconds(s, 2);
  assert.ok(org.joints.every(j => j.amplitude! > 1.74));
  assert.ok(org.joints.some(j => Math.abs(j.targetAngle) > .1)); assertConserved(s);
});

test('motor engagement is independent for each articulated joint', () => {
  const {s, org} = fixture(); command(org, 'Engage', -.9, 0); seconds(s, 2);
  assert.equal(org.joints[0].engagement, 0); assert.equal(org.joints[0].appliedTorque, 0);
  assert.equal(org.joints[1].engagement, 1); assert.ok(Math.abs(org.joints[1].appliedTorque) > .001);
  assert.ok(org.genome.motorForce > 0); assertConserved(s);
});

test('opposing neural steering commands turn the physical swimmer to opposite sides', () => {
  const left = fixture(), right = fixture();
  command(left.org, 'Angle', -.6); command(right.org, 'Angle', .6);
  const startLeft = sim.calculateOrganismCOM(left.org), startRight = sim.calculateOrganismCOM(right.org);
  seconds(left.s, 10); seconds(right.s, 10);
  assert.ok(sim.calculateOrganismCOM(left.org).y - startLeft.y > 100);
  assert.ok(sim.calculateOrganismCOM(right.org).y - startRight.y < -100);
  assertConserved(left.s); assertConserved(right.s);
});

test('a faster neural rhythm gives a measured reference burst at increased motor expenditure', () => {
  const active = fixture(), burst = fixture(); command(burst.org, 'Drive', .8);
  const a = sim.calculateOrganismCOM(active.org), b = sim.calculateOrganismCOM(burst.org);
  seconds(active.s, 10); seconds(burst.s, 10);
  const ae = sim.calculateOrganismCOM(active.org), be = sim.calculateOrganismCOM(burst.org);
  assert.ok(Math.hypot(be.x - b.x, be.y - b.y) > Math.hypot(ae.x - a.x, ae.y - a.y) * 1.1);
  assert.ok(burst.s.ledger.mechanicalWorkHeat > active.s.ledger.mechanicalWorkHeat);
  assertConserved(active.s); assertConserved(burst.s);
});

for (const dt of [1 / 30, 1 / 60, 1 / 120]) test(`rest saves motor work without suppressing basal costs, dt=${dt}`, () => {
  const active = fixture(), resting = fixture(); command(resting.org, 'Engage', -.9);
  seconds(active.s, 10, dt); seconds(resting.s, 10, dt);
  assert.ok(resting.s.ledger.mechanicalWorkHeat < active.s.ledger.mechanicalWorkHeat * .2);
  assert.ok(resting.s.ledger.metabolicDissipation > 0);
  assert.ok(Math.abs(resting.s.ledger.metabolicDissipation - active.s.ledger.metabolicDissipation) < 1e-6);
  assert.ok(resting.org.energy > active.org.energy); assertConserved(active.s); assertConserved(resting.s);
});

test('nonzero longitudinal drag slows passive coasting; zero viscosity preserves momentum', () => {
  const damped = fixture(true), free = fixture(true);
  for (const {org} of [damped, free]) { org.genome.motorForce = 0; org.segments[0].vx = 60; }
  seconds(damped.s, 10); seconds(free.s, 10, 1 / 60, 0);
  const p = damped.org.genome.parts[0], mass = Math.max(.35, p.dimN * p.dimM * sim.BASE_PART_DENSITY);
  const decay = sim.LONGITUDINAL_DRAG * settings.waterViscosity * p.height / mass;
  const expected = 60 * Math.pow(1 - decay / 240, 2400);
  assert.ok(Math.abs(damped.org.speed - expected) < 1e-7);
  assert.ok(damped.org.speed < 55); assert.ok(Math.abs(free.org.speed - 60) < 1e-8);
});

test('oral feedback comes from actual ingestion, reaches the brain next tick, and clears after contact ends', () => {
  const {s, org} = fixture(true); org.genome.motorForce = 0;
  org.genome.weightsIH.forEach(row => row.fill(0)); org.genome.weightsHH.forEach(row => row.fill(0)); org.genome.biasesH.fill(0);
  const mouth = org.genome.mouths[0];
  const contact = org.genome.inputKeys!.indexOf(`mouth:${mouth.id}:contact`);
  const intake = org.genome.inputKeys!.indexOf(`mouth:${mouth.id}:intake`);
  org.genome.weightsIH[0][contact] = 2; org.genome.weightsIH[0][intake] = 2;
  const anchor = sim.getCardinalAnchor(mouth.direction, org.genome.parts[0].width, org.genome.parts[0].height);
  s.nutrients.push({id: 'food', x: 6000 + anchor.x, y: 6000 + anchor.y, vx: 0, vy: 0, energyValue: 3000,
    radius: 18, bottomTimer: 0, pulseTimer: 0}); s.ledger.externalInflow += 3000;
  sim.stepSimulation(s, settings, 1 / 60);
  assert.equal(org.neuralInputs[contact], 0); assert.equal(org.neuralHidden[0], 0);
  assert.deepEqual(org.mouthFeedback![mouth.id], {contact: 1, intake: .8});
  sim.stepSimulation(s, settings, 1 / 60);
  assert.equal(org.neuralInputs[contact], 1); assert.equal(org.neuralInputs[intake], .8);
  assert.ok(org.neuralHidden[0] > .99);
  s.ledger.recordedLosses += s.nutrients.reduce((sum, n) => sum + n.energyValue, 0); s.nutrients = [];
  sim.stepSimulation(s, settings, 1 / 60); assert.equal(org.mouthFeedback![mouth.id].contact, 0);
  sim.stepSimulation(s, settings, 1 / 60); assert.equal(org.neuralInputs[contact], 0); assert.equal(org.neuralInputs[intake], 0);
  assertConserved(s);
});

test('oral feedback can drive the new engagement output through the actual recurrent controller', () => {
  const {s, org} = fixture();
  org.genome.weightsIH.forEach(row => row.fill(0)); org.genome.weightsHH.forEach(row => row.fill(0)); org.genome.biasesH.fill(0);
  const mouth = org.genome.mouths[0], key = `mouth:${mouth.id}:intake`;
  org.genome.weightsIH[0][org.genome.inputKeys!.indexOf(key)] = 3;
  org.genome.weightsHO[org.genome.outputKeys!.findIndex(k => k.endsWith(':Engage'))][0] = -2;
  const anchor = sim.getCardinalAnchor(mouth.direction, org.genome.parts[0].width, org.genome.parts[0].height);
  s.nutrients.push({id: 'food', x: 6000 + anchor.x, y: 6000 + anchor.y, vx: 0, vy: 0, energyValue: 3000, radius: 18, bottomTimer: 0});
  s.ledger.externalInflow += 3000;
  sim.stepSimulation(s, settings, 1 / 60); sim.stepSimulation(s, settings, 1 / 60);
  assert.ok(org.joints[0].engagement! < 1); assert.equal(org.joints[1].engagement, 1);
  assertConserved(s);
});

test('a real v5 seven-part save preserves all old commands, weights, hidden memory and PRNG by ID', () => {
  const old = JSON.parse(readFileSync(new URL('./fixtures/v5-motor-world.json', import.meta.url), 'utf8'));
  const before = old.state.organisms[0];
  const {state} = restoreSnapshot(old), org = state.organisms[0];
  assert.equal(org.genome.brainVersion, 7); assert.equal(org.neuralOutputs.length, 36);
  assert.deepEqual(org.neuralHidden, before.neuralHidden); assert.deepEqual(state.prng.getState(), old.state.prngState);
  before.genome.inputKeys.forEach((key: string, i: number) => {
    const current = org.genome.inputKeys!.indexOf(key); assert.equal(org.neuralInputs[current], before.neuralInputs[i]);
    org.genome.weightsIH.forEach((row, h) => assert.equal(row[current], before.genome.weightsIH[h][i]));
  });
  before.genome.outputKeys.forEach((key: string, i: number) => {
    const current = org.genome.outputKeys!.indexOf(key);
    assert.equal(org.neuralOutputs[current], before.neuralOutputs[i]);
    assert.deepEqual(org.genome.weightsHO[current], before.genome.weightsHO[i]);
    assert.equal(org.genome.biasesO[current], before.genome.biasesO[i]);
  });
  assert.ok(org.joints.every(j => j.amplitude === 1 && j.engagement === 1));
  assert.deepEqual(org.mouthFeedback, {});
});

test('current snapshots preserve motor ramps and oral feedback for exact continuation', () => {
  const {s, org} = fixture(); command(org, 'Engage', -.9); command(org, 'Amp', -.5);
  seconds(s, .1); org.mouthFeedback = {[org.genome.mouths[0].id]: {contact: 1, intake: .7}};
  const savedSettings = {...settings, worldWidth: 4800, worldHeight: 3000};
  org.segments.forEach(p => { p.x -= 3600; p.y -= 4500; });
  const saved = createSnapshot(s, savedSettings), restored = restoreSnapshot(saved);
  assert.equal(saved.schemaVersion, '16.0.0');
  assert.deepEqual(createSnapshot(restored.state, restored.settings), saved);
  for (let i = 0; i < 120; i++) { sim.stepSimulation(s, savedSettings, 1 / 60); sim.stepSimulation(restored.state, savedSettings, 1 / 60); }
  assert.deepEqual(createSnapshot(s, savedSettings), createSnapshot(restored.state, savedSettings));
  const bad = structuredClone(saved); bad.state.organisms[0].joints[0].engagement = 2;
  assert.throws(() => restoreSnapshot(bad));
  const badKeys = structuredClone(saved); badKeys.state.organisms[0].genome.outputKeys![0] = 'wrong';
  assert.throws(() => restoreSnapshot(badKeys));
});
