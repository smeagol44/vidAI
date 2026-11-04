import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import BrainGraph from '../BrainGraph';
import {eggReserveFixture} from './support/egg-reserve';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome, FEATURED_BLUEPRINTS, FOUNDER_BLUEPRINTS} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, validateGenome, totalAccountedEnergy} from '../persistence';
import {SimulationHost} from '../simulationHost';
const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, gravity: 0, waterViscosity: 0, mutationSeverity: 0};
const world = () => createInitialWorld(settings, 139, 'balanced', 'standard', 0);
const legacy = (id = 'CUR-001') => createFounderGenome(id, 'balanced', {vision: 'legacy'});

test('all 64 new starter brains remove range by identity, preserving RGB, recurrent and motor alleles and quiet-water response', () => {
  for (const d of [...FEATURED_BLUEPRINTS, ...FOUNDER_BLUEPRINTS]) for (const mode of ['balanced', 'unbiased'] as const) {
    const old = createFounderGenome(d.id, mode, {vision: 'legacy'}), rgb = createFounderGenome(d.id, mode);
    assert.equal(rgb.brainVersion, 8);
    assert.equal(rgb.inputKeys!.length, old.inputKeys!.length - old.eyes.length * 5);
    assert.ok(!rgb.inputKeys!.some(k => k.endsWith(':distance')));
    assert.deepEqual(rgb.parts, old.parts); assert.deepEqual(rgb.eyes, old.eyes); assert.deepEqual(rgb.mouths, old.mouths);
    assert.deepEqual(rgb.weightsHH, old.weightsHH); assert.deepEqual(rgb.weightsHO, old.weightsHO);
    assert.deepEqual(rgb.biasesO, old.biasesO); assert.deepEqual(rgb.hiddenTimeConstants, old.hiddenTimeConstants);
    for (let h = 0; h < rgb.weightsIH.length; h++) {
      for (const [i, key] of rgb.inputKeys!.entries()) assert.equal(rgb.weightsIH[h][i], old.weightsIH[h][old.inputKeys!.indexOf(key)]);
      let expected = old.biasesH[h];
      for (const [i, key] of old.inputKeys!.entries()) if (key.endsWith(':distance')) expected += old.weightsIH[h][i];
      assert.equal(rgb.biasesH[h], expected);
    }
    assert.deepEqual(validateGenome(rgb), rgb);
    const child = sim.mutateGenome(rgb, 1, new sim.XoshiroPRNG(139));
    assert.equal(child.brainVersion, 8); assert.ok(!child.inputKeys!.some(k => k.endsWith(':distance')));
    assert.deepEqual(validateGenome(child), child);
  }
});

test('explicit world upgrade preserves stable live state and valid learned edges, with no PRNG or energy movement', () => {
  const s = world(), g = legacy(); g.sensoryPlasticityRate = .8; g.plasticityRate = .8;
  const o = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
  const old = structuredClone(o.genome), distance = old.inputKeys!.find(k => k.endsWith(':distance'))!;
  const rgbKey = old.inputKeys!.find(k => k.endsWith(':green'))!;
  o.neuralInputs = old.inputKeys!.map((_, i) => i / 100);
  o.neuralHidden[0] = .39; o.neuralOutputs[0] = -.21;
  const disabled = sim.brainEdgeKey('ih', old.hiddenIds![1], distance);
  o.genome.disabledConnections!.push(disabled);
  const allowed = sim.plasticSensoryEdges(o.genome);
  const kept = allowed.find(e => old.inputKeys![e.input] === rgbKey)!;
  assert.ok(kept);
  o.learnedSensoryWeights = [kept].map(e => ({edge: e.edge, delta: .2, eligibility: .1}));
  s.eggs = eggReserveFixture().state.eggs;
  s.ledger.externalInflow += s.eggs.reduce((v, e) => v + e.fundedReserve + e.fundedStructural, 0);
  const eggBefore = structuredClone(s.eggs);
  const before = structuredClone(o), rng = s.prng.getState(), energy = totalAccountedEnergy(s);
  sim.upgradeWorldVision(s);
  assert.ok(s.eggs.every(e => e.genome.brainVersion === 8));
  assert.ok([...s.lineage.values()].every(r => r.genome.brainVersion === 8));
  assert.deepEqual(s.eggs.map(({genome, ...egg}) => egg), eggBefore.map(({genome, ...egg}) => egg));
  assert.equal(o.genome.brainVersion, 8); assert.deepEqual(s.prng.getState(), rng); assert.equal(totalAccountedEnergy(s), energy);
  assert.deepEqual(o.segments, before.segments); assert.deepEqual(o.joints, before.joints);
  assert.deepEqual(o.neuralHidden, before.neuralHidden); assert.deepEqual(o.neuralOutputs, before.neuralOutputs);
  assert.deepEqual(o.neuralInputs, o.genome.inputKeys!.map(k => before.neuralInputs[old.inputKeys!.indexOf(k)]));
  assert.deepEqual(o.learnedSensoryWeights, [before.learnedSensoryWeights![0]]);
  assert.ok(!o.genome.disabledConnections!.includes(disabled));
  let expectedBias = before.genome.biasesH[1];
  for (const [i, key] of old.inputKeys!.entries()) if (key.endsWith(':distance') && key !== distance) expectedBias += old.weightsIH[1][i];
  assert.equal(o.genome.biasesH[1], expectedBias);
  const snap = createSnapshot(s, settings); assert.equal(snap.schemaVersion, '20.0.0');
  const restored = restoreSnapshot(snap), host = new SimulationHost(); host.reset(snap, 139);
  for (let i = 0; i < 30; i++) {sim.stepSimulation(s, settings, 1 / 60); sim.stepSimulation(restored.state, settings, 1 / 60); host.tick();}
  assert.deepEqual(createSnapshot(restored.state, settings), createSnapshot(s, settings));
  assert.deepEqual(host.snapshot(), createSnapshot(s, settings));
  const twice = createSnapshot(s, settings); sim.upgradeWorldVision(s); assert.deepEqual(createSnapshot(s, settings), twice);
});

test('legacy saves remain version 7, including inherited offspring, until explicitly upgraded; mixed worlds round-trip', () => {
  const s = world(), o = addExternalOrganism(s, legacy(), settings, 1200, 750, 0)!;
  const snap = createSnapshot(s, settings); assert.equal(snap.schemaVersion, '16.0.0');
  const loaded = restoreSnapshot(snap); assert.deepEqual(createSnapshot(loaded.state, settings), snap);
  assert.equal(sim.mutateGenome(o.genome, 1, new sim.XoshiroPRNG(12)).brainVersion, 7);
  addExternalOrganism(s, createFounderGenome('CUR-002'), settings, 1600, 750, 0);
  const mixed = createSnapshot(s, settings); assert.equal(mixed.schemaVersion, '20.0.0');
  assert.deepEqual(createSnapshot(restoreSnapshot(mixed).state, settings), mixed);
  for (const locus of ['living', 'lineage'] as const) {
    const wrong = structuredClone(mixed); wrong.schemaVersion = '16.0.0';
    if (locus === 'lineage') wrong.state.organisms = wrong.state.organisms.filter(x => x.genome.brainVersion !== 8);
    assert.throws(() => restoreSnapshot(wrong), /brain version|require schema 20/);
  }
});

test('RGB-only runtime retains optical geometry in diagnostics without exposing range or hit identity to the brain', () => {
  const observe = (distance: number, lightness: number) => {
    const s = world(), g = createFounderGenome('CUR-001');
    g.parts = [g.parts[0]]; g.mouths = []; g.eyes = [{id: 'eye', partIndex: 0, direction: 'EAST', fov: .2, range: 500}];
    sim.remapBrain(g); g.motorForce = 0;
    const observer = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
    const target = structuredClone(g); target.eyes = []; target.hue = 120; target.saturation = 100; target.lightness = lightness;
    sim.remapBrain(target); const other = addExternalOrganism(s, target, settings, 1200 + distance, 750, 0)!;
    s.ledger.externalInflow += other.genome.maxEnergyCapacity - other.energy; other.energy = other.genome.maxEnergyCapacity;
    sim.stepSimulation(s, settings, 1 / 60);
    return observer;
  };
  const near = observe(100, 10), far = observe(100 + 275 * Math.log(2), 20);
  assert.ok(Math.abs(near.rayHits[2].dist - far.rayHits[2].dist) > 90);
  const key = 'eye:eye:ray:2:green', i = near.genome.inputKeys!.indexOf(key);
  assert.ok(Math.abs(near.neuralInputs[i] - far.neuralInputs[i]) < 1e-12, JSON.stringify({near: near.rayHits[2], far: far.rayHits[2], inputs: [near.neuralInputs[i], far.neuralInputs[i]]}));
  assert.equal(near.neuralInputs.length, 3 * 5 + 7);
  assert.ok(!near.genome.inputKeys!.some(k => /distance|hit|type|target/.test(k)));
  for (const o of [near, far]) assert.ok(o.neuralInputs.every(Number.isFinite));
  const diagram = renderToStaticMarkup(React.createElement(BrainGraph, {organism: near, threshold: 0}));
  assert.ok(diagram.includes('RGB-only vision')); assert.ok(!diagram.includes('distance'));
  const old = sim.spawnOrganism(legacy(), 1200, 750);
  const legacyDiagram = renderToStaticMarkup(React.createElement(BrainGraph, {organism: old, threshold: 0}));
  assert.ok(legacyDiagram.includes('Legacy vision')); assert.ok(legacyDiagram.includes('distance'));
});
