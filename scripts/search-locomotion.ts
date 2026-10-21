import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {FEATURED_BLUEPRINTS, createFounderGenome} from '../founders';
import {auditLocomotionPhysics} from '../locomotionPhysicsAudit';
import {BUILD_VERSION} from '../persistence';
import {evaluateSwimmer, searchSwimmer, acceptSwimmer} from '../locomotionSearch';
const arg = (name: string) => {const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1];};
const selected = arg('--id');
const settings = {seed: Number(arg('--seed') ?? 711), generations: Number(arg('--generations') ?? 3),
  offspring: Number(arg('--offspring') ?? 8), seconds: 6};
const check = process.argv.includes('--check');
if (check && (settings.seed !== 711 || settings.generations !== 3 || settings.offspring !== 8))
  throw new Error('--check requires the default reproducible search budget');
if (!Number.isSafeInteger(settings.seed)) throw new Error('Seed must be an integer');
if (selected && !FEATURED_BLUEPRINTS.some(f => f.id === selected)) throw new Error('Unknown featured starter');
const trials = [
  {seconds: 9, heading: Math.PI / 2, viscosity: .18, seed: 811},
  {seconds: 9, heading: -.7, viscosity: .15, seed: 977},
  {seconds: 9, heading: 2.3, viscosity: .22, seed: 1201},
  {seconds: 15, heading: .37, viscosity: .18, seed: 2301},
];
const audit = auditLocomotionPhysics();
const results = [];
for (const [index, spec] of FEATURED_BLUEPRINTS.entries()) {
  if (selected && spec.id !== selected) continue;
  const original = createFounderGenome(spec.id, 'balanced', {locomotion: 'catalogue', foraging: 'catalogue'});
  const search = searchSwimmer(original, {...settings, seed: settings.seed + index * 1009});
  const baselines = trials.map(t => evaluateSwimmer(original, t));
  const candidates = trials.map(t => evaluateSwimmer(search.genome, t));
  const accepted = search.best.score > search.baseline.score && acceptSwimmer(baselines, candidates);
  const row = {id: spec.id, name: spec.name, family: spec.family, accepted,
    sourceGenomeSHA256: createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    training: {...search, genome: undefined}, holdout: {conditions: trials, baselines, candidates},
    genes: {motorFrequency: search.genome.motorFrequency, motorForce: search.genome.motorForce,
      parts: search.genome.parts.slice(1).map(p => ({id: p.id, cpgPhaseOffset: p.cpgPhaseOffset,
        cpgAmp: p.cpgAmp, cpgFreqMult: p.cpgFreqMult, oscillatorMix: p.oscillatorMix, waveHarmonics: p.waveHarmonics}))}};
  if (check) assert.deepEqual(createFounderGenome(spec.id, 'balanced', {foraging: 'catalogue'}), accepted ? search.genome : original,
    `Committed starter calibration differs from the bounded search: ${spec.id}`);
  results.push(row);
  console.log(JSON.stringify({id: spec.id, accepted, evaluations: search.evaluations, rejected: search.rejected,
    distance: [search.baseline.distance, search.best.distance], spentJ: [search.baseline.spentJ, search.best.spentJ],
    holdoutDistanceRatios: candidates.map((c, i) => c.distance / baselines[i].distance),
    holdoutEfficiencyRatios: candidates.map((c, i) => c.efficiency / baselines[i].efficiency),
    baselineRejection: search.baseline.rejection}));
}
const report = {protocol: 'bounded-swimming-search-v1', build: BUILD_VERSION, settings, audit, results,
  limitations: 'Empty-water locomotion only. No demonstrated food collection, learning benefit or ecological fitness. Existing physics; cap/hinge/accounting guards do not prove mechanical energy conservation.'};
if (arg('--output')) await writeFile(arg('--output')!, JSON.stringify(report, null, 2) + '\n');
