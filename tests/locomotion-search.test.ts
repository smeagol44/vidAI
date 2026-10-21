import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {auditLocomotionPhysics} from '../locomotionPhysicsAudit';
import {evaluateSwimmer, searchSwimmer, scoreSwimTrial, mutateSwimmer, acceptSwimmer} from '../locomotionSearch';
import {FEATURED_BLUEPRINTS, FOUNDER_BLUEPRINTS, createFounderGenome} from '../founders';
import {XoshiroPRNG, stepSimulation, mutateGenome} from '../simulation';
import {createInitialWorld, addExternalOrganism} from '../world';
import {LEGACY_SETTINGS, validateGenome, createSnapshot, restoreSnapshot} from '../persistence';

const selected = ['CUR-003', 'CUR-008', 'CUR-009'];
test('physics audit measures dissipative rotated drag, passive spin, free momentum and actual size scaling', () => {
  const result = auditLocomotionPhysics();
  assert.equal(result.uniformDoubleSizeTorqueRatio, 16);
  assert.equal(result.drag.longitudinalRelativeToFullNormalFaces, .025);
});

test('offline fitness rejects idle, startup-only, invalid and circular movement', () => {
  const steady = {valid: true, distance: 100, pathLength: 100, lateSpeed: 20, spentJ: 200, lateMotorJ: 1};
  const score = scoreSwimTrial(steady, 5); assert.ok(score > 0);
  assert.equal(scoreSwimTrial({...steady, distance: 0}, 5), 0);
  assert.equal(scoreSwimTrial({...steady, lateSpeed: 0}, 5), 0);
  assert.equal(scoreSwimTrial({...steady, lateMotorJ: 0}, 5), 0);
  assert.equal(scoreSwimTrial({...steady, valid: false}, 5), 0);
  assert.equal(scoreSwimTrial({...steady, spentJ: -1}, 5), 0);
  assert.equal(scoreSwimTrial({...steady, spentJ: NaN}, 5), 0);
  assert.ok(scoreSwimTrial({...steady, distance: 10, pathLength: 1000}, 5) < score * .02);
  assert.ok(scoreSwimTrial({...steady, spentJ: 1000}, 5) < score);
});

function withoutMotor(g: ReturnType<typeof createFounderGenome>) {
  const copy = structuredClone(g);
  copy.motorForce = 0; copy.motorFrequency = 0;
  for (const p of copy.parts) {p.cpgAmp = 0; p.cpgFreqMult = 0; p.cpgPhaseOffset = 0; delete p.oscillatorMix; delete p.waveHarmonics;}
  return copy;
}
test('search uses a deterministic bounded budget, keeps the parent, and edits only existing motor alleles', () => {
  const original = createFounderGenome('CUR-003', 'balanced', {locomotion: 'catalogue'}), before = structuredClone(original);
  const options = {seed: 911, generations: 1, offspring: 2, seconds: 3};
  const a = searchSwimmer(original, options), b = searchSwimmer(original, options);
  assert.deepEqual(a, b); assert.equal(a.evaluations, 3); assert.ok(a.best.score >= a.baseline.score);
  assert.deepEqual(original, before);
  const random = new XoshiroPRNG(41);
  for (let i = 0; i < 12; i++) {
    const candidate = mutateSwimmer(original, random);
    assert.deepEqual(withoutMotor(candidate), withoutMotor(original)); validateGenome(candidate);
  }
  assert.throws(() => searchSwimmer(original, {generations: 9}), /budget/);
  assert.throws(() => evaluateSwimmer(original, {seconds: 1000}), /3–30/);
});

test('candidate adoption rejects reversed and less sustained motion despite higher distance', () => {
  const trial = evaluateSwimmer(createFounderGenome('CUR-003'), {seconds: 3});
  const better = {...trial, distance: trial.distance * 1.2, dx: trial.dx * 1.2, dy: trial.dy * 1.2,
    lateSpeed: trial.lateSpeed * 1.1, efficiency: trial.efficiency * 1.2};
  assert.ok(acceptSwimmer([trial], [better]));
  assert.ok(!acceptSwimmer([trial], [{...better, dx: -better.dx, dy: -better.dy}]));
  assert.ok(!acceptSwimmer([trial], [{...better, lateSpeed: trial.lateSpeed * .9}]));
  assert.ok(!acceptSwimmer([trial], [{...better, spentJ: trial.spentJ * 1.1}]));
});

for (const id of selected) test(`${id}: selected gait retains a longer held-out physical improvement without cap use`, () => {
  const original = createFounderGenome(id, 'balanced', {locomotion: 'catalogue'}), calibrated = createFounderGenome(id);
  assert.deepEqual(withoutMotor(calibrated), withoutMotor(original));
  const conditions = {seconds: 15, heading: .37, viscosity: .18, seed: 2301};
  const baseline = evaluateSwimmer(original, conditions), result = evaluateSwimmer(calibrated, conditions);
  assert.ok(acceptSwimmer([baseline], [result]), JSON.stringify({baseline, result}));
  assert.equal(result.capTicks, 0); assert.ok(result.energyError < 1e-5);
  validateGenome(calibrated);
  const offspring = mutateGenome(calibrated, .4, new XoshiroPRNG(291));
  assert.ok(offspring.motorFrequency !== calibrated.motorFrequency || offspring.parts.some((p, i) => p.cpgAmp !== calibrated.parts[i]?.cpgAmp));
});

test('the other six featured and all 55 legacy genomes remain exactly unchanged', () => {
  for (const f of [...FEATURED_BLUEPRINTS, ...FOUNDER_BLUEPRINTS].filter(f => !selected.includes(f.id)))
    assert.deepEqual(createFounderGenome(f.id), createFounderGenome(f.id, 'balanced', {locomotion: 'catalogue'}));
});

test('stored pre-calibration CUR-003 genome resumes the exact v0.32.1 cold continuation', () => {
  const config = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
  const state = createInitialWorld(config, 311, 'balanced', 'standard', 0);
  addExternalOrganism(state, createFounderGenome('CUR-003', 'balanced', {locomotion: 'catalogue'}), config, 1200, 750, 0);
  for (let i = 0; i < 40; i++) stepSimulation(state, config, 1 / 60);
  const restored = restoreSnapshot(createSnapshot(state, config)).state;
  for (let i = 0; i < 80; i++) stepSimulation(restored, config, 1 / 60);
  const hash = createHash('sha256').update(JSON.stringify(createSnapshot(restored, config).state)).digest('hex');
  assert.equal(hash, '1bf8f42ab1dd15f60fce7cd8209785dffb9acc927b4317ab28893a9beb400b33');
});
