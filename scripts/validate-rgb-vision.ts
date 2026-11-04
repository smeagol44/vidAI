/** Bounded regression evidence for #139; no search, selection or retuning.
 * This does not repeat or replace the historical scientific experiments. */
import {EcologyIntakeObserver} from '../ecologyAudit';
import {writeFileSync} from 'node:fs';
import {createFounderGenome, FEATURED_BLUEPRINTS, FOUNDER_BLUEPRINTS} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {calculateOrganismCOM, stepSimulation, getNutrientRadius} from '../simulation';
import {DEFAULT_SETTINGS, totalAccountedEnergy} from '../persistence';
const settings = {...DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3' as const, mouthContactModel: 'capsule-v1' as const,
  targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
const staticAudit = [...FEATURED_BLUEPRINTS, ...FOUNDER_BLUEPRINTS].map(d => {
  const old = createFounderGenome(d.id, 'balanced', {vision: 'legacy'}), rgb = createFounderGenome(d.id);
  const range = old.inputKeys!.map((k, i) => ({k, i})).filter(x => x.k.endsWith(':distance'));
  return {id: d.id, name: d.name, removedInputs: range.length,
    removedNonzeroEdges: range.reduce((n, x) => n + old.weightsIH.filter(row => row[x.i] !== 0).length, 0),
    maxRemovedWeight: Math.max(0, ...range.flatMap(x => old.weightsIH.map(row => Math.abs(row[x.i])))),
    maxBiasCorrection: Math.max(...old.biasesH.map((b, i) => Math.abs(b - rgb.biasesH[i]))),
    preservedRGBWeights: rgb.weightsIH.every((row, h) => row.every((w, i) => w === old.weightsIH[h][old.inputKeys!.indexOf(rgb.inputKeys![i])])),
    preservedMotorWeights: JSON.stringify(old.weightsHO) === JSON.stringify(rgb.weightsHO)};
});
function run(id: string, vision: 'rgb' | 'legacy', stimulus: 'empty' | 'food') {
  const state = createInitialWorld(settings, 139, 'balanced', 'standard', 0);
  const genome = createFounderGenome(id, 'balanced', {vision});
  const org = addExternalOrganism(state, genome, settings, 1200, 750, 0)!;
  const start = calculateOrganismCOM(org);
  if (stimulus === 'food') {
    state.nutrients.push({id: 'finite-validation-food', x: 1320, y: 790, vx: 0, vy: 0, kind: 'nutrient',
      energyValue: 3000, radius: getNutrientRadius(3000), bottomTimer: 0, pulseTimer: 0});
    state.ledger.externalInflow += 3000;
  }
  const energy = totalAccountedEnergy(state), reserve = org.energy;
  const intake = new EcologyIntakeObserver();
  let visibleTicks = 0;
  for (let tick = 0; tick < 180; tick++) {
    stepSimulation(state, settings, 1 / 60);
    intake.sample(state);
    if (org.rayHits.some(r => r.objectType === 'nutrient')) visibleTicks++;
  }
  const end = calculateOrganismCOM(org);
  return {id, vision, stimulus, brainVersion: org.genome.brainVersion, alive: !org.dissolving,
    dx: end.x - start.x, dy: end.y - start.y, displacementPx: Math.hypot(end.x - start.x, end.y - start.y),
    reserveDeltaJ: org.energy - reserve, absorbedJ: intake.totals().Nutrient, visibleTicks, energyResidualJ: totalAccountedEnergy(state) - energy};
}
const paired = FEATURED_BLUEPRINTS.flatMap(d => (['empty', 'food'] as const).map(stimulus => ({id: d.id, stimulus,
  legacy: run(d.id, 'legacy', stimulus), rgb: run(d.id, 'rgb', stimulus)})));
const report = {issue: 139, base: '67016f5536ebe44f67836ea2e4575c49c26fb3e9', purpose: 'Bounded correctness/impact validation only; not a historical experiment rerun or ecological superiority claim',
  protocol: {seed: 139, seconds: 3, ticks: 180, heading: 0, settings, food: {x: 1320, y: 790, joules: 3000}}, staticAudit, paired};
writeFileSync('docs/validation/rgb-only-vision-139.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({designs: staticAudit.length, pairs: paired.length,
  allRGBPreserved: staticAudit.every(r => r.preservedRGBWeights && r.preservedMotorWeights),
  maxDisplacementDifferencePx: Math.max(...paired.map(p => Math.abs(p.rgb.displacementPx - p.legacy.displacementPx))),
  foodChanges: paired.filter(p => p.rgb.absorbedJ !== p.legacy.absorbedJ).map(p => ({id: p.id, stimulus: p.stimulus, legacy: p.legacy.absorbedJ, rgb: p.rgb.absorbedJ})),
  maxEnergyResidualJ: Math.max(...paired.flatMap(p => [Math.abs(p.legacy.energyResidualJ), Math.abs(p.rgb.energyResidualJ)]))}));
