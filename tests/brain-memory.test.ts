import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as sim from '../simulation';
import {createFounderGenome, FOUNDER_BLUEPRINTS} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createSnapshot, LEGACY_SETTINGS, restoreSnapshot, totalAccountedEnergy, validateGenome} from '../persistence';
import BrainGraph from '../BrainGraph';

const settings = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0, waterViscosity: 0};
const world = () => createInitialWorld(settings, 4321, 'unbiased', 'standard', 0);
const seeded = (n: number) => new sim.XoshiroPRNG(n);
function singleMemoryBrain(tau: number) {
  const parent = createFounderGenome('FND-001', 'unbiased');
  const g = structuredClone(parent);
  g.hiddenIds = [parent.hiddenIds![0]];
  sim.remapBrain(g, parent);
  g.weightsIH[0].fill(0);
  g.weightsHH[0][0] = 0;
  g.biasesH[0] = 1;
  g.hiddenTimeConstants![0] = tau;
  g.weightsHO.forEach(row => row.fill(0));
  g.biasesO.fill(0);
  g.motorForce = 0;
  return g;
}

test('all 55 founders retain their original instantaneous update and seeded network', () => {
  for (const d of FOUNDER_BLUEPRINTS) {
    for (const mode of ['balanced', 'unbiased'] as const) {
      const g = createFounderGenome(d.id, mode);
      assert.equal(g.brainVersion, 7);
      assert.deepEqual(g.hiddenTimeConstants, new Array(24).fill(0));
      assert.deepEqual(g, createFounderGenome(d.id, mode));
      assert.deepEqual(validateGenome(g), g);
    }
  }
  const target = Math.tanh(.374);
  assert.equal(sim.integrateNeuronMemory(-.9, target, 0, 1 / 60), target);
  assert.equal(sim.integrateNeuronMemory(.5, -.75, 0, 1 / 120), -.75);
  assert.equal(sim.memoryUpkeep(createFounderGenome('FND-001')), 0);
});

test('leaky neurons retain activation and use real seconds independent of tick subdivision', () => {
  const tau = .8, target = Math.tanh(1), dt = 1 / 30;
  const first = sim.integrateNeuronMemory(0, target, tau, dt);
  const twoHalves = sim.integrateNeuronMemory(sim.integrateNeuronMemory(0, target, tau, dt / 2), target, tau, dt / 2);
  const exact = target * (1 - Math.exp(-dt / tau));
  assert.ok(Math.abs(first - exact) < 1e-14);
  assert.ok(Math.abs(first - twoHalves) < 1e-14);
  assert.ok(first > 0 && first < target);
  const slow = sim.integrateNeuronMemory(0, target, 2, dt);
  assert.ok(slow > 0 && slow < first);
  const afterSignal = sim.integrateNeuronMemory(first, 0, tau, dt);
  assert.ok(afterSignal > 0 && afterSignal < first);
  assert.equal(sim.integrateNeuronMemory(-.5, .7, 0, dt), .7);
});

test('actual kernel obeys per-neuron relaxation and retains original tau-zero response', () => {
  const slow = singleMemoryBrain(.5), fast = singleMemoryBrain(0);
  const s1 = world(), s2 = world();
  const org1 = addExternalOrganism(s1, slow, settings, 1200, 750, 0)!;
  const org2 = addExternalOrganism(s2, fast, settings, 1200, 750, 0)!;
  const before1 = totalAccountedEnergy(s1), before2 = totalAccountedEnergy(s2);
  sim.stepSimulation(s1, settings, 1 / 60);
  sim.stepSimulation(s2, settings, 1 / 60);
  assert.ok(Math.abs(org1.neuralHidden[0] -
    sim.integrateNeuronMemory(0, Math.tanh(1), .5, 1 / 60)) < 1e-14);
  assert.equal(org2.neuralHidden[0], Math.tanh(1));
  assert.ok(org1.neuralHidden[0] < org2.neuralHidden[0]);
  assert.ok(Math.abs(org1.sensoryEnergyRate! - org2.sensoryEnergyRate! - sim.MEMORY_METABOLIC_RATE * .5) < 1e-10);
  assert.ok(Math.abs(totalAccountedEnergy(s1) - before1) < 1e-5);
  assert.ok(Math.abs(totalAccountedEnergy(s2) - before2) < 1e-5);
  const html = renderToStaticMarkup(React.createElement(BrainGraph, {organism: org1, threshold: .01}));
  assert.match(html, /activation memory τ=0\.50 s/);
});

test('neuron timescales remap by stable ID and new topology starts at zero', () => {
  const parent = createFounderGenome('FND-001');
  parent.hiddenTimeConstants![12] = 1.25;
  parent.hiddenTimeConstants![0] = .3;
  const before = structuredClone(parent), g = structuredClone(parent);
  g.hiddenIds = ['hidden:12', 'hidden:0', 'hidden:new', 'hidden:7'];
  sim.remapBrain(g, before);
  assert.deepEqual(g.hiddenTimeConstants, [1.25, .3, 0, 0]);
  assert.deepEqual(g.weightsIH[0], before.weightsIH[12]);
  assert.deepEqual(g.weightsHH[0], [before.weightsHH[12][12], before.weightsHH[12][0], 0, before.weightsHH[12][7]]);
  assert.deepEqual(validateGenome(g), g);
  assert.equal(sim.mutateBrainTopology(g, 'add-neuron', seeded(10)), true);
  assert.equal(g.hiddenTimeConstants!.at(-1), 0);
  assert.equal(sim.mutateBrainTopology(g, 'remove-neuron', seeded(11)), true);
  assert.ok(g.hiddenTimeConstants!.every(tau => tau >= 0 && tau <= sim.MAX_BRAIN_MEMORY_SECONDS));
});

test('zero mutation inherits exact constants, positive severity can evolve slow memory deterministically', () => {
  const parent = createFounderGenome('FND-001');
  parent.hiddenTimeConstants![3] = .7;
  const original = structuredClone(parent);
  const unchanged = sim.mutateGenome(parent, 0, seeded(1));
  assert.deepEqual(unchanged.hiddenTimeConstants, parent.hiddenTimeConstants);
  let foundSeed = -1;
  let found: sim.Genome | null = null;
  const zero = createFounderGenome('FND-001');
  for (let seed = 1; seed <= 300; seed++) {
    const child = sim.mutateGenome(zero, 1, seeded(seed));
    if (child.hiddenTimeConstants!.some(tau => tau > 0)) {
      foundSeed = seed; found = child; break;
    }
  }
  assert.ok(found, 'rare memory mutations must be reachable with deterministic seeds');
  assert.deepEqual(sim.mutateGenome(zero, 1, seeded(foundSeed)), found);
  assert.deepEqual(parent, original);
  assert.deepEqual(zero.hiddenTimeConstants, new Array(24).fill(0));
  assert.deepEqual(validateGenome(found), found);
});

test('v9 snapshots upgrade with tau zero, preserving original network/activations and PRNG', () => {
  const s = world(), org = addExternalOrganism(s, singleMemoryBrain(0), settings, 1200, 750, 0)!;
  org.neuralHidden[0] = .424;
  const current = createSnapshot(s, settings), old = structuredClone(current);
  old.schemaVersion = '9.0.0';
  const downgrade = (g: sim.Genome) => {
    g.brainVersion = 5;
    delete g.hiddenTimeConstants;
    const i = g.inputKeys!.indexOf('body:injury');
    if (i >= 0) {
      g.inputKeys!.splice(i, 1);
      g.weightsIH.forEach(row => row.splice(i, 1));
    }
  };
  for (const o of old.state.organisms) {
    downgrade(o.genome);
    o.neuralInputs.pop(); // v9 predates the bite-feedback channel.
    delete o.biteFeedbackJ;
  }
  for (const egg of old.state.eggs) downgrade(egg.genome);
  for (const [, rec] of old.state.lineage) downgrade(rec.genome);
  const restored = restoreSnapshot(old), next = restored.state.organisms[0];
  assert.equal(next.genome.brainVersion, 7);
  assert.deepEqual(next.genome.hiddenTimeConstants, [0]);
  assert.deepEqual(next.neuralHidden, org.neuralHidden);
  assert.deepEqual(next.genome.weightsIH.map(row => row.slice(0, -1)),
    org.genome.weightsIH.map(row => row.slice(0, -1)));
  assert.ok(next.genome.weightsIH.every(row => row.at(-1) === 0));
  assert.deepEqual(next.genome.weightsHH, org.genome.weightsHH);
  assert.deepEqual(next.genome.weightsHO, org.genome.weightsHO);
  assert.deepEqual(restored.state.prng.getState(), s.prng.getState());
  sim.stepSimulation(s, settings, 1 / 60);
  sim.stepSimulation(restored.state, settings, 1 / 60);
  assert.deepEqual(restored.state.organisms[0].neuralHidden, s.organisms[0].neuralHidden);
  assert.deepEqual(restored.state.organisms[0].neuralOutputs, s.organisms[0].neuralOutputs);
  assert.deepEqual(restored.state.prng.getState(), s.prng.getState());
});

test('v10 snapshot resumes inherited slow-memory dynamics with exact continuation and energy ledger', () => {
  const s = world(), g = singleMemoryBrain(1.1);
  const o = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
  o.neuralHidden[0] = .2;
  sim.stepSimulation(s, settings, 1 / 60);
  const saved = createSnapshot(s, settings), restored = restoreSnapshot(saved);
  assert.equal(saved.schemaVersion, '12.0.0');
  assert.deepEqual(createSnapshot(restored.state, restored.settings), saved);
  for (let t = 0; t < 15; t++) {
    sim.stepSimulation(s, settings, 1 / 60);
    sim.stepSimulation(restored.state, settings, 1 / 60);
  }
  assert.deepEqual(createSnapshot(restored.state, settings), createSnapshot(s, settings));
  assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-5);
});

test('malformed memory arrays and invalid time constants are rejected before import', () => {
  const original = createFounderGenome('FND-001');
  const reject = (edit: (g: sim.Genome) => void) => {
    const g = structuredClone(original);
    edit(g);
    assert.throws(() => validateGenome(g), /Invalid snapshot/);
  };
  reject(g => {delete g.hiddenTimeConstants;});
  reject(g => {g.hiddenTimeConstants!.pop();});
  reject(g => {g.hiddenTimeConstants![0] = -0.1;});
  reject(g => {g.hiddenTimeConstants![0] = sim.MAX_BRAIN_MEMORY_SECONDS + .01;});
  reject(g => {g.hiddenTimeConstants![0] = NaN;});
  reject(g => {g.hiddenTimeConstants![0] = Infinity;});
  reject(g => {g.hiddenTimeConstants = ['1'] as unknown as number[];});
});
