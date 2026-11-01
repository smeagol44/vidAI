import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {createFounderGenome, FEATURED_BLUEPRINTS, FOUNDER_BLUEPRINTS} from '../founders';
import {runTwinOarApproach, TWIN_OAR_APPROACH_CONDITIONS} from '../foragingAudit';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createSnapshot, restoreSnapshot, LEGACY_SETTINGS, validateGenome} from '../persistence';
import {stepSimulation, mutateGenome, XoshiroPRNG, CONTINUOUS_EAT_RATE, MOUTH_ASSIMILATION} from '../simulation';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('Twin Oar reaches off-axis finite food through inherited visual steering and physical muscles', () => {
  for (const c of TWIN_OAR_APPROACH_CONDITIONS) {
    const current = runTwinOarApproach('current', c);
    const original = runTwinOarApproach('catalogue', c);
    const gaitOnly = runTwinOarApproach('gait-only', c);
    const disconnected = runTwinOarApproach('retinal-disconnected', c);
    // This assay protects visually caused, energetically useful acquisition.
    // Forward reach changes contact duration; completing the entire finite
    // particle is not a universal consequence of successful approach.
    assert.ok(current.absorbedJ > 0 && current.absorbedJ <= 3000 * MOUTH_ASSIMILATION, JSON.stringify(current));
    assert.ok(current.reserveDeltaJ > 0, 'physical food must fund a net reserve gain after all normal costs');
    assert.equal(original.absorbedJ, 0);
    assert.equal(gaitOnly.absorbedJ, 0, 'forward locomotion alone cannot reach off-axis food');
    assert.equal(disconnected.absorbedJ, 0, 'real retinal input is causally required');
    assert.ok(current.expenditureJ <= original.expenditureJ * 1.01, 'no hidden cost reduction or costly brute force');
    for (const row of [current, original, gaitOnly, disconnected]) {
      assert.ok(row.valid && row.visibleTicks > 0);
      assert.equal(row.capTicks, 0);
      assert.ok(Math.abs(row.energyErrorJ) < 1e-5);
      // The 3000-J particle is an exact multiple of the unchanged per-tick
      // specialist budget. Every observed contact in these fixtures pays it.
      assert.equal(row.absorbedJ, row.mouthContactTicks * CONTINUOUS_EAT_RATE / 60 * MOUTH_ASSIMILATION,
        'real contact and unchanged assimilation must explain every absorbed joule');
    }
  }
});

test('calibration changes only new Twin Oar genes; old saves and the other 63 designs remain intact', () => {
  const unaffected = [...FEATURED_BLUEPRINTS, ...FOUNDER_BLUEPRINTS]
    .filter(f => f.id !== 'CUR-002').map(f => createFounderGenome(f.id));
  // The historical golden predates the mouth schema split. Reconstruct only
  // that legacy serialization so the hash still guards every unrelated gene.
  const legacyMouthProjection = unaffected.map(genome => {
    const copy = structuredClone(genome);
    for (const mouth of copy.mouths) {
      mouth.intakeWidth = mouth.intakeLength ?? mouth.intakeWidth;
      delete mouth.intakeLength;
    }
    return copy;
  });
  assert.equal(hash(legacyMouthProjection), '075d05d5db45a2cd821749601518716bd7e8d717178f28156e66bbf6bf24f535');
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
  const settings = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
  const state = createInitialWorld(settings, 311, 'balanced', 'standard', 0);
  addExternalOrganism(state, original, settings, 1200, 750, .23);
  for (let i = 0; i < 30; i++) stepSimulation(state, settings, 1 / 60);
  const restored = restoreSnapshot(createSnapshot(state, settings));
  assert.deepEqual(restored.state.organisms[0].genome, original);
  for (let i = 0; i < 60; i++) {
    stepSimulation(state, settings, 1 / 60); stepSimulation(restored.state, restored.settings, 1 / 60);
  }
  assert.deepEqual(createSnapshot(state, settings), createSnapshot(restored.state, restored.settings));
  const historicalState = structuredClone(createSnapshot(restored.state, restored.settings).state);
  const projectGenomeMouths = (genome: typeof original) => {
    for (const mouth of genome.mouths) {
      mouth.intakeWidth = mouth.intakeLength ?? mouth.intakeWidth;
      delete mouth.intakeLength;
    }
  };
  for (const organism of historicalState.organisms) projectGenomeMouths(organism.genome);
  for (const egg of historicalState.eggs) projectGenomeMouths(egg.genome);
  for (const [, record] of historicalState.lineage) projectGenomeMouths(record.genome);
  assert.equal(hash(historicalState),
    '28e177bac9b543eb91d2d6948124e4dcb85a8f44f9563f657d3a45568b20aa90',
    'exact v0.33.0 pre-calibration Twin Oar continuation outside the intentional mouth schema change');
});
