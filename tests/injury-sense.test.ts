import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createSnapshot, DEFAULT_SETTINGS, restoreSnapshot, totalAccountedEnergy, validateGenome} from '../persistence';

const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, waterViscosity: 0,
  mutationSeverity: 0, kinshipProtection: false};
const dt = 1 / 60;
function body(mouth?: sim.MouthType) {
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(21));
  g.parts = [g.parts[0]];
  g.eyes = [];
  g.motorForce = 0;
  g.mouths = mouth ? [{id: 'mouth', partIndex: 0, direction: 'EAST', intakeWidth: 12, mouthType: mouth}] : [];
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier);
  sim.remapBrain(g);
  return g;
}
function fixture(attackerMouth: sim.MouthType = 'carnivore') {
  const s = createInitialWorld(settings, 215, 'unbiased', 'standard', 0);
  const attacker = addExternalOrganism(s, body(attackerMouth), settings, 1200, 750, 0)!;
  const prey = addExternalOrganism(s, body(), settings, 1200 + attacker.genome.parts[0].width, 750, 0)!;
  const channel = prey.genome.inputKeys!.indexOf('body:injury');
  assert.ok(channel >= 0);
  // An ordinary inherited neural pathway: no special motor reflex in kernel.
  // Its coefficients could also evolve through ordinary mutations.
  prey.genome.weightsIH.forEach(row => row.fill(0));
  prey.genome.weightsHH.forEach(row => row.fill(0));
  prey.genome.biasesH.fill(0);
  prey.genome.weightsHO.forEach(row => row.fill(0));
  prey.genome.biasesO.fill(0);
  prey.genome.weightsIH[0][channel] = 2;
  const drive = prey.genome.outputKeys!.findIndex(k => k.endsWith(':Drive'));
  // A one-part creature cannot propel itself with motor outputs; use a
  // hidden response assertion here, not fabricated movement.
  return {s, attacker, prey, channel, drive};
}
test('a physical bite is sensed by the victim next tick, while contact without biting is not', () => {
  const carnivore = fixture('carnivore');
  const herbivore = fixture('herbivore');
  const carnBefore = totalAccountedEnergy(carnivore.s);
  const herbBefore = totalAccountedEnergy(herbivore.s);
  sim.stepSimulation(carnivore.s, settings, dt);
  sim.stepSimulation(herbivore.s, settings, dt);
  assert.equal(carnivore.prey.neuralInputs[carnivore.channel], 0);
  assert.equal(herbivore.prey.neuralInputs[herbivore.channel], 0);
  assert.ok(carnivore.prey.biteFeedbackJ! > 0, 'real carnivore bite transfers prey reserve');
  assert.equal(herbivore.prey.biteFeedbackJ, 0, 'herbivore cannot injure a living prey');
  const queued = carnivore.prey.biteFeedbackJ!;
  sim.stepSimulation(carnivore.s, settings, dt);
  sim.stepSimulation(herbivore.s, settings, dt);
  assert.equal(carnivore.prey.neuralInputs[carnivore.channel], Math.min(1, queued / 60));
  assert.ok(carnivore.prey.neuralHidden[0] > 0);
  assert.equal(herbivore.prey.neuralInputs[herbivore.channel], 0);
  assert.equal(herbivore.prey.neuralHidden[0], 0);
  assert.ok(Math.abs(totalAccountedEnergy(carnivore.s) - carnBefore) < 1e-5);
  assert.ok(Math.abs(totalAccountedEnergy(herbivore.s) - herbBefore) < 1e-5);
});

test('a bite does not report eye color, predator species, nearby body presence or ordinary metabolism', () => {
  const {s, attacker, prey, channel} = fixture('herbivore');
  const before = totalAccountedEnergy(s);
  for (let i = 0; i < 6; i++) sim.stepSimulation(s, settings, dt);
  assert.equal(prey.biteFeedbackJ, 0);
  assert.equal(prey.neuralInputs[channel], 0);
  assert.equal(prey.neuralHidden[0], 0);
  // Losing energy to physiology and standing beside a large body alone
  // must not trigger a predator signal.
  assert.ok(prey.energy < 10000);
  assert.ok(attacker.energy < 10000);
  assert.ok(Math.abs(totalAccountedEnergy(s) - before) < 1e-5);
});

test('queued real predation stimulus saves and continues exactly in schema 11', () => {
  const {s, prey, channel} = fixture();
  sim.stepSimulation(s, settings, dt);
  assert.ok(prey.biteFeedbackJ! > 0);
  const saved = createSnapshot(s, settings), restored = restoreSnapshot(saved);
  assert.equal(saved.schemaVersion, '12.0.0');
  assert.equal(restored.state.organisms.find(o => o.id === prey.id)!.biteFeedbackJ, prey.biteFeedbackJ);
  assert.deepEqual(createSnapshot(restored.state, settings), saved);
  for (let i = 0; i < 3; i++) {
    sim.stepSimulation(s, settings, dt);
    sim.stepSimulation(restored.state, settings, dt);
  }
  assert.deepEqual(createSnapshot(restored.state, settings), createSnapshot(s, settings));
  assert.ok(prey.neuralInputs[channel] > 0);
});

test('v10 brains migrate by stable sensory ID while preserving old connection weights and activations', () => {
  const {s, prey, channel} = fixture('herbivore');
  // A genuine v10 genome has no injury allele; the new channel starts
  // disconnected (weight 0), not as a retroactively acquired learned reflex.
  prey.genome.weightsIH[0][channel] = 0;
  sim.stepSimulation(s, settings, dt);
  const current = createSnapshot(s, settings), old = structuredClone(current);
  old.schemaVersion = '10.0.0';
  const downgrade = (g: sim.Genome) => {
    g.brainVersion = 6;
    const index = g.inputKeys!.indexOf('body:injury');
    assert.ok(index >= 0);
    g.inputKeys!.splice(index, 1);
    for (const row of g.weightsIH) row.splice(index, 1);
  };
  for (const o of old.state.organisms) {
    downgrade(o.genome);
    o.neuralInputs.splice(o.neuralInputs.length - 1, 1);
    delete o.biteFeedbackJ;
  }
  for (const [, rec] of old.state.lineage) downgrade(rec.genome);
  for (const e of old.state.eggs) downgrade(e.genome);
  const imported = restoreSnapshot(old);
  assert.equal(imported.state.organisms[0].genome.brainVersion, 7);
  assert.deepEqual(createSnapshot(imported.state, settings), current);
  assert.equal(imported.state.organisms.find(o => o.id === prey.id)!.biteFeedbackJ, 0);
  sim.stepSimulation(s, settings, dt);
  sim.stepSimulation(imported.state, settings, dt);
  assert.deepEqual(createSnapshot(imported.state, settings), createSnapshot(s, settings));
});

test('current snapshots reject malformed injury values or brain version before replacing a world', () => {
  const {s} = fixture();
  const saved = createSnapshot(s, settings);
  for (const value of [-1, NaN, Infinity, '1', null, undefined]) {
    const modified = structuredClone(saved);
    modified.state.organisms[0].biteFeedbackJ = value as number;
    assert.throws(() => restoreSnapshot(modified), /Invalid snapshot/);
  }
  const wrong = structuredClone(saved);
  wrong.state.organisms[0].genome.brainVersion = 6;
  assert.throws(() => restoreSnapshot(wrong), /Invalid snapshot/);
  const g = structuredClone(s.organisms[0].genome);
  g.inputKeys!.pop();
  g.weightsIH.forEach(row => row.pop());
  assert.throws(() => validateGenome(g), /Invalid snapshot/);
});

test('experienced predation can drive inherited joint commands through true physical muscles', () => {
  const make = (injuryCoupled: boolean) => {
    const s = createInitialWorld(settings, 311, 'unbiased', 'standard', 0);
    const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(5));
    g.motorFrequency = 0;
    g.motorForce = 2.8;
    for (const p of g.parts.slice(1)) p.cpgAmp = 0;
    sim.ensureBrainLayout(g);
    g.weightsIH.forEach(row => row.fill(0));
    g.weightsHH.forEach(row => row.fill(0));
    g.weightsHO.forEach(row => row.fill(0));
    g.biasesH.fill(0); g.biasesO.fill(0);
    const injuryIndex = g.inputKeys!.indexOf('body:injury');
    const angleIndex = g.outputKeys!.findIndex(k => k.endsWith(':Angle'));
    if (injuryCoupled) {
      g.weightsIH[0][injuryIndex] = 2;
      g.weightsHO[angleIndex][0] = 2;
    }
    const prey = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
    const hunterGenome = body('carnivore');
    hunterGenome.mouths[0].direction = 'WEST';
    const predator = addExternalOrganism(s, hunterGenome, settings,
      1200 + (g.parts[0].width + hunterGenome.parts[0].width) / 2, 750, 0)!;
    predator.genome.motorForce = 0;
    return {s, prey, predator, injuryIndex, angleIndex};
  };
  const active = make(true), neutral = make(false);
  const beforeA = totalAccountedEnergy(active.s), beforeB = totalAccountedEnergy(neutral.s);
  sim.stepSimulation(active.s, settings, dt);
  sim.stepSimulation(neutral.s, settings, dt);
  assert.ok(active.prey.biteFeedbackJ! > 0 && neutral.prey.biteFeedbackJ! > 0,
    'real jaws must bite in both counterfactuals');
  assert.equal(active.prey.neuralOutputs[active.angleIndex], 0);
  sim.stepSimulation(active.s, settings, dt);
  sim.stepSimulation(neutral.s, settings, dt);
  assert.ok(active.prey.neuralInputs[active.injuryIndex] > 0);
  assert.ok(active.prey.neuralOutputs[active.angleIndex] > .5,
    'genetic synapses convert actual injury into the existing angle motor command');
  assert.equal(neutral.prey.neuralOutputs[neutral.angleIndex], 0);
  assert.ok(active.prey.joints[0].targetAngle > neutral.prey.joints[0].targetAngle + .1,
    'command reaches articulated physical hinge, not a scripted world velocity');
  assert.ok(Math.abs(totalAccountedEnergy(active.s) - beforeA) < 1e-5);
  assert.ok(Math.abs(totalAccountedEnergy(neutral.s) - beforeB) < 1e-5);
});
