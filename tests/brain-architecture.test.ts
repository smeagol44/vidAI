import {createFounderGenome, createInitialWorld} from './support/legacy-vision';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as sim from '../simulation';
import {FOUNDER_BLUEPRINTS} from '../founders';
import BrainGraph from '../BrainGraph';
import {addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, validateGenome, totalAccountedEnergy} from '../persistence';

const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, waterViscosity: 0, mutationSeverity: 0};
function world() { return createInitialWorld(settings, 13, 'unbiased', 'standard', 0); }

function resizeHidden(count: number) {
  const old = createFounderGenome('FND-001', 'unbiased');
  const g = structuredClone(old);
  g.hiddenIds = Array.from({length: count}, (_, i) => `hidden:${i}`);
  sim.remapBrain(g, old);
  return {g, old};
}

test('all founders retain 24 uniquely identified neurons and mutable inherited sensory priors', () => {
  for (const d of FOUNDER_BLUEPRINTS) for (const mode of ['balanced', 'unbiased'] as const) {
    const g = createFounderGenome(d.id, mode);
    assert.equal(g.brainVersion, 7);
    assert.deepEqual(g.hiddenIds, Array.from({length: 24}, (_, i) => `hidden:${i}`));
    assert.deepEqual(g.disabledConnections, []);
    assert.deepEqual(g.hiddenTimeConstants, new Array(24).fill(0));
    const original = createFounderGenome(d.id, mode);
    assert.deepEqual(g, original);
    assert.deepEqual(validateGenome(g), g);
    const child = sim.mutateGenome(g, 0, new sim.XoshiroPRNG(8));
    assert.deepEqual(child.weightsIH, g.weightsIH);
    assert.deepEqual(child.weightsHH, g.weightsHH);
    assert.deepEqual(child.weightsHO, g.weightsHO);
    assert.deepEqual(child.hiddenIds, g.hiddenIds);
    assert.deepEqual(child.disabledConnections, g.disabledConnections);
  }
});

test('legacy v8 dense controllers migrate losslessly to v9, retaining recurrent memory and PRNG', () => {
  const s = world(), o = addExternalOrganism(s, createFounderGenome('FND-001'), settings, 1200, 750, 0)!;
  o.neuralHidden[2] = .4125;
  const current = createSnapshot(s, settings);
  const legacy = structuredClone(current);
  legacy.schemaVersion = '8.0.0';
  const downgrade = (g: sim.Genome) => {
    g.brainVersion = 4;
    delete g.hiddenIds;
    delete g.disabledConnections;
    delete g.hiddenTimeConstants;
    const i = g.inputKeys!.indexOf('body:injury');
    if (i >= 0) {
      g.inputKeys!.splice(i, 1);
      g.weightsIH.forEach(row => row.splice(i, 1));
    }
  };
  downgrade(legacy.state.organisms[0].genome);
  legacy.state.organisms[0].neuralInputs.pop();
  delete legacy.state.organisms[0].biteFeedbackJ;
  for (const [, rec] of legacy.state.lineage) downgrade(rec.genome);
  const before = structuredClone(legacy.state.organisms[0]);
  const restored = restoreSnapshot(legacy), got = restored.state.organisms[0];
  assert.equal(got.genome.brainVersion, 7);
  assert.deepEqual(got.genome.weightsIH.map(row => row.slice(0, -1)), before.genome.weightsIH);
  assert.ok(got.genome.weightsIH.every(row => row.at(-1) === 0));
  assert.deepEqual(got.genome.weightsHH, before.genome.weightsHH);
  assert.deepEqual(got.genome.biasesH, before.genome.biasesH);
  assert.deepEqual(got.genome.weightsHO, before.genome.weightsHO);
  assert.deepEqual(got.genome.biasesO, before.genome.biasesO);
  assert.deepEqual(got.neuralHidden, before.neuralHidden);
  assert.deepEqual(got.neuralInputs.slice(0, -1), before.neuralInputs);
  assert.equal(got.neuralInputs.at(-1), 0);
  assert.deepEqual(got.neuralOutputs, before.neuralOutputs);
  assert.deepEqual(restored.state.prng.getState(), legacy.state.prngState);
  assert.deepEqual(createSnapshot(restored.state, settings), current);
  sim.stepSimulation(s, settings, 1 / 60);
  sim.stepSimulation(restored.state, settings, 1 / 60);
  assert.deepEqual(createSnapshot(restored.state, settings), createSnapshot(s, settings));
});

test('different bounded hidden sizes execute, serialize and continue deterministically', () => {
  for (const count of [1, 4, 24, 32, 96]) {
    const {g, old} = resizeHidden(count);
    assert.equal(g.weightsIH.length, count);
    assert.equal(g.weightsHH.length, count);
    assert.equal(g.weightsHO[0].length, count);
    assert.deepEqual(g.weightsIH[0], old.weightsIH[0]);
    assert.deepEqual(g.weightsHH[0].slice(0, Math.min(24, count)), old.weightsHH[0].slice(0, Math.min(24, count)));
    if (count > 24) assert.ok(g.weightsIH.slice(24).every(row => row.every(w => w === 0)));
    assert.deepEqual(validateGenome(g), g);
    const s = world(), org = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
    assert.equal(org.neuralHidden.length, count);
    org.neuralHidden[0] = .375;
    const saved = createSnapshot(s, settings), reloaded = restoreSnapshot(saved);
    assert.deepEqual(createSnapshot(reloaded.state, settings), saved);
    sim.stepSimulation(s, settings, 1 / 60);
    sim.stepSimulation(reloaded.state, settings, 1 / 60);
    assert.deepEqual(createSnapshot(reloaded.state, settings), createSnapshot(s, settings));
    assert.ok(org.neuralHidden.every(Number.isFinite));
    assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-5);
  }
});

test('remapping architecture by IDs retains only the correct neural memory and synapses', () => {
  const s = world(), org = addExternalOrganism(s, createFounderGenome('FND-001'), settings, 1200, 750, 0)!;
  const before = structuredClone(org.genome);
  org.neuralHidden = before.hiddenIds!.map((_, i) => i / 100);
  org.neuralInputs[0] = .8;
  org.neuralOutputs[0] = -.2;
  org.genome.hiddenIds = ['hidden:12', 'hidden:0', 'new:a', 'hidden:6'];
  sim.remapOrganismBrain(org, before);
  assert.deepEqual(org.neuralHidden, [.12, 0, 0, .06]);
  assert.deepEqual(org.genome.weightsIH[0], before.weightsIH[12]);
  assert.deepEqual(org.genome.weightsHH[0], [before.weightsHH[12][12], before.weightsHH[12][0], 0, before.weightsHH[12][6]]);
  assert.deepEqual(org.genome.weightsHO[0], [before.weightsHO[0][12], before.weightsHO[0][0], 0, before.weightsHO[0][6]]);
  assert.equal(org.neuralInputs[0], .8);
  assert.equal(org.neuralOutputs[0], -.2);
  assert.deepEqual(validateGenome(org.genome), org.genome);
});

test('disabled synapses do not participate in neural evaluation or graph rendering', () => {
  const {g} = resizeHidden(1);
  g.weightsIH[0].fill(0);
  g.weightsHH[0].fill(0);
  g.biasesH[0] = 0;
  g.weightsHO.forEach(row => row.fill(0));
  g.biasesO.fill(0);
  const energy = g.inputKeys!.indexOf('body:energy');
  assert.ok(energy >= 0);
  g.weightsIH[0][energy] = 3;
  g.weightsHO[0][0] = 3;
  const s = world(), org = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
  sim.stepSimulation(s, settings, 1 / 60);
  assert.ok(org.neuralHidden[0] > 0 && org.neuralOutputs[0] > 0);
  const enabledMarkup = renderToStaticMarkup(React.createElement(BrainGraph, {organism: org, threshold: 0}));
  assert.equal((enabledMarkup.match(/data-hidden-neuron=/g) ?? []).length, 1);
  assert.equal((enabledMarkup.match(/data-synapse=/g) ?? []).length, 2);
  org.genome.disabledConnections!.push(sim.brainEdgeKey('ih', 'hidden:0', 'body:energy'));
  assert.deepEqual(validateGenome(org.genome), org.genome);
  const disabledMarkup = renderToStaticMarkup(React.createElement(BrainGraph, {organism: org, threshold: 0}));
  assert.equal((disabledMarkup.match(/data-synapse=/g) ?? []).length, 1);
  sim.stepSimulation(s, settings, 1 / 60);
  assert.equal(org.neuralHidden[0], 0);
  assert.equal(org.neuralOutputs[0], 0);
});

test('invalid neuron counts, layouts, dangling or duplicate edges, and over-budget graphs are rejected', () => {
  const base = createFounderGenome('FND-001');
  const invalid = (edit: (g: sim.Genome) => void) => {
    const g = structuredClone(base);
    edit(g);
    assert.throws(() => validateGenome(g), /Invalid snapshot|Invalid hidden/);
  };
  invalid(g => { g.hiddenIds = []; });
  invalid(g => { g.hiddenIds![2] = g.hiddenIds![1]; });
  invalid(g => { g.weightsHH[0].pop(); });
  invalid(g => { g.weightsHO[0].pop(); });
  invalid(g => { g.weightsIH[0].pop(); });
  invalid(g => { g.disabledConnections = ['not-json']; });
  invalid(g => { g.disabledConnections = [sim.brainEdgeKey('hh', 'missing', 'hidden:0')]; });
  invalid(g => { const key = sim.brainEdgeKey('hh', 'hidden:0', 'hidden:0'); g.disabledConnections = [key, key]; });
  assert.throws(() => resizeHidden(97), /Invalid hidden/);
  const {g: big} = resizeHidden(96);
  // Use genuinely valid free organ faces to exceed the synapse budget.
  const bell = createFounderGenome('FND-055');
  const manyEyes = structuredClone(bell);
  manyEyes.eyes = structuredClone(bell.eyes);
  for (let p = 0; p < manyEyes.parts.length; p++) {
    for (const direction of sim.CARDINAL_DIRS) for (const slot of [0, 1, 2] as const) {
      manyEyes.eyes.push({...bell.eyes[0], id: `extra-eye:${p}:${direction}:${slot}`, partIndex: p, direction, slot});
      if (sim.surfacePlacementProblems(manyEyes).length) manyEyes.eyes.pop();
    }
  }
  assert.equal(sim.surfacePlacementProblems(manyEyes).length, 0);
  manyEyes.hiddenIds = [...big.hiddenIds!];
  const layout = sim.getBrainLayout(manyEyes);
  const totalEdges = 96 * (layout.inputs.length + 96 + layout.outputs.length);
  assert.ok(totalEdges > sim.MAX_ENABLED_BRAIN_EDGES, 'the valid anatomy must exceed the enabled-edge budget');
  assert.throws(() => sim.remapBrain(manyEyes, bell), /edge budget/);
  const disableCount = totalEdges - sim.MAX_ENABLED_BRAIN_EDGES;
  const disabled: string[] = [];
  for (const hidden of manyEyes.hiddenIds!) {
    for (const input of layout.inputs) {
      if (disabled.length < disableCount) disabled.push(sim.brainEdgeKey('ih', hidden, input));
    }
  }
  manyEyes.disabledConnections = disabled;
  sim.remapBrain(manyEyes, base);
  assert.equal(sim.enabledBrainEdgeCount(manyEyes), sim.MAX_ENABLED_BRAIN_EDGES);
  assert.equal(validateGenome(manyEyes).disabledConnections!.length, disableCount);
});
