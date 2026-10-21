import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {createFounderGenome, FEATURED_BLUEPRINTS, FOUNDER_BLUEPRINTS} from '../founders';
import {runTwinOarApproach, TWIN_OAR_APPROACH_CONDITIONS} from '../foragingAudit';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createSnapshot, restoreSnapshot, DEFAULT_SETTINGS, validateGenome} from '../persistence';
import {stepSimulation, mutateGenome, XoshiroPRNG} from '../simulation';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('Twin Oar reaches off-axis finite food through inherited visual steering and physical muscles', () => {
  for (const c of TWIN_OAR_APPROACH_CONDITIONS) {
    const current = runTwinOarApproach('current', c);
    const original = runTwinOarApproach('catalogue', c);
    const gaitOnly = runTwinOarApproach('gait-only', c);
    const disconnected = runTwinOarApproach('retinal-disconnected', c);
    assert.equal(current.absorbedJ, 2400, JSON.stringify(current));
    assert.ok(current.reserveDeltaJ > 1900);
    assert.equal(original.absorbedJ, 0);
    assert.equal(gaitOnly.absorbedJ, 0, 'forward locomotion alone cannot reach off-axis food');
    assert.equal(disconnected.absorbedJ, 0, 'real retinal input is causally required');
    assert.ok(current.expenditureJ <= original.expenditureJ * 1.01, 'no hidden cost reduction or costly brute force');
    for (const row of [current, original, gaitOnly, disconnected]) {
      assert.ok(row.valid && row.visibleTicks > 0);
      assert.equal(row.capTicks, 0);
      assert.ok(Math.abs(row.energyErrorJ) < 1e-5);
    }
  }
});

test('calibration changes only new Twin Oar genes; old saves and the other 63 designs remain intact', () => {
  const unaffected = [...FEATURED_BLUEPRINTS, ...FOUNDER_BLUEPRINTS]
    .filter(f => f.id !== 'CUR-002').map(f => createFounderGenome(f.id));
  assert.equal(hash(unaffected), '075d05d5db45a2cd821749601518716bd7e8d717178f28156e66bbf6bf24f535');
  const original = createFounderGenome('CUR-002', 'balanced', {foraging: 'catalogue'});
  const current = createFounderGenome('CUR-002');
  validateGenome(current);
  const child = mutateGenome(current, 0, new XoshiroPRNG(17));
  assert.deepEqual(child.weightsIH, current.weightsIH);
  assert.deepEqual(child.weightsHO, current.weightsHO);
  assert.deepEqual(child.parts, current.parts);
  const descendants = [17, 29, 41].map(seed => mutateGenome(current, .5, new XoshiroPRNG(seed)));
  assert.ok(descendants.some(g => hash(g.weightsIH) !== hash(current.weightsIH)));
  assert.ok(descendants.some(g => hash(g.parts) !== hash(current.parts)));
  const strip = (g: typeof current) => {
    const copy = structuredClone(g); copy.weightsIH = []; copy.weightsHO = [];
    copy.parts[2].cpgPhaseOffset = 0; return copy;
  };
  assert.deepEqual(strip(current), strip(original), 'anatomy, metabolism and other inherited traits unchanged');
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
  const state = createInitialWorld(settings, 311, 'balanced', 'standard', 0);
  addExternalOrganism(state, original, settings, 1200, 750, .23);
  for (let i = 0; i < 30; i++) stepSimulation(state, settings, 1 / 60);
  const restored = restoreSnapshot(createSnapshot(state, settings));
  assert.deepEqual(restored.state.organisms[0].genome, original);
  for (let i = 0; i < 60; i++) {
    stepSimulation(state, settings, 1 / 60); stepSimulation(restored.state, restored.settings, 1 / 60);
  }
  assert.deepEqual(createSnapshot(state, settings), createSnapshot(restored.state, restored.settings));
  assert.equal(hash(createSnapshot(restored.state, restored.settings).state),
    '28e177bac9b543eb91d2d6948124e4dcb85a8f44f9563f657d3a45568b20aa90',
    'exact v0.33.0 pre-calibration Twin Oar continuation');
});
