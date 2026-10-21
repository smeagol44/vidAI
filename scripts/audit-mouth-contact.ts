/** Bounded release comparison. No runtime targeting, subsidies or retuning. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {capsuleContactsPart} from '../mouthGeometry';
import {mouthContactFixture} from '../mouthContactAudit';
import {createFounderGenome, FEATURED_BLUEPRINTS} from '../founders';
import {createInitialWorld, addExternalOrganism, collectWorldStats} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, totalAccountedEnergy} from '../persistence';
import {stepSimulation, calculateOrganismCOM, mouthApertureContactsPart, getDietClassification, type SimulationSettings} from '../simulation';
import {EcologyIntakeObserver} from '../ecologyAudit';

let oldContacts = 0, newContacts = 0, additions = 0, losses = 0;
for (let x = -24; x <= 24; x += 2) for (let y = -14; y <= 14; y += 2) {
  const p = {x: x + .125, y: y + .125, angle: 0, vx: 0, vy: 0, angVel: 0};
  const def = createFounderGenome('FND-001').parts[0]; def.width = 7; def.height = 7;
  const old = mouthApertureContactsPart(0, 0, -10, 0, 10, 0, 4.5, p, def);
  const fixed = capsuleContactsPart(-10, 0, 10, 0, 4.5, p, def);
  oldContacts += Number(old); newContacts += Number(fixed);
  additions += Number(fixed && !old); losses += Number(old && !fixed);
}
assert.equal(losses, 0);
const controls = [];
for (const encounter of ['endpoint', 'head-on', 'overlap', 'far']) for (const model of [undefined, 'capsule-v1'] as const) {
  const {state, config, hunter} = mouthContactFixture(model, encounter);
  stepSimulation(state, config, 1 / 60);
  controls.push({encounter, model: model ?? 'legacy', absorbedJ: hunter.recentFeedings?.reduce((sum, e) => sum + e.energyTransferred, 0) ?? 0,
    ledgerErrorJ: totalAccountedEnergy(state) - state.ledger.externalInflow});
}
const swimming = [];
for (const design of FEATURED_BLUEPRINTS) {
  let baseline: unknown;
  for (const model of [undefined, 'capsule-v1'] as const) {
    const config: SimulationSettings = {...DEFAULT_SETTINGS, mouthContactModel: model, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
    const state = createInitialWorld(config, 711, 'balanced', 'standard', 0);
    const org = addExternalOrganism(state, createFounderGenome(design.id), config, 1200, 750, .37)!;
    const start = calculateOrganismCOM(org), reserve = org.energy;
    for (let i = 0; i < 300; i++) stepSimulation(state, config, 1 / 60);
    const end = calculateOrganismCOM(org), exact = createSnapshot(state, config).state;
    if (!model) baseline = exact; else assert.deepEqual(exact, baseline);
    swimming.push({id: design.id, model: model ?? 'legacy', seconds: 5,
      displacementPx: Math.hypot(end.x - start.x, end.y - start.y), reserveSpentJ: reserve - org.energy});
  }
}
const ecology = [];
for (const seed of [17, 73]) for (const model of [undefined, 'capsule-v1'] as const) {
  const config: SimulationSettings = {...DEFAULT_SETTINGS, mouthContactModel: model, ecologyRegime: 'closed-v1', nutrientLimit: null};
  const state = createInitialWorld(config, seed, 'balanced', 'showcase');
  const observer = new EcologyIntakeObserver(), start = performance.now(); let maxErrorJ = 0;
  for (let i = 0; i < 3600; i++) {
    stepSimulation(state, config, 1 / 60); observer.sample(state);
    maxErrorJ = Math.max(maxErrorJ, Math.abs(totalAccountedEnergy(state) - state.energyPool!.budget));
  }
  const byDiet: Record<string, {Nutrient: number; Carrion: number; Prey: number; Egg: number}> = {};
  for (const [id, intake] of Object.entries(observer.perOrganismTotals())) {
    const genome = state.lineage.get(id)!.genome;
    const diet = getDietClassification(genome.mouths).category;
    const total = byDiet[diet] ??= {Nutrient: 0, Carrion: 0, Prey: 0, Egg: 0};
    for (const key of ['Nutrient', 'Carrion', 'Prey', 'Egg'] as const) total[key] += intake[key];
  }
  const row = {seed, model: model ?? 'legacy', seconds: 60, ...collectWorldStats(state, config.targetNutrients),
    absorbedJ: observer.totals(), absorbedByDietJ: byDiet, reserveJ: state.energyPool!.reserve, maxErrorJ,
    runtimeMs: Math.round(performance.now() - start)};
  ecology.push(row); console.log(JSON.stringify(row)); assert.ok(maxErrorJ < 1e-6);
}
const report = {protocol: 'mouth-capsule-contact-v1', geometry: {samples: 375, oldContacts, newContacts, additions, losses}, controls, swimming, ecology,
  notes: ['Inherited aperture width, radii, rates, assimilation, organs, controllers and swimming forces are unchanged.',
    'Prey contact changes from line plus central disk to the same full capsule used for free food and eggs.',
    'Controlled endpoint contact is intentionally improved; circle-food contact is unchanged.',
    'Five-second no-food swimming states are exactly equal for each frozen starter.',
    'Two unassisted 60-second showcase pairs do not establish reliable pursuit or sustained ecology. Receipt buffers are bounded.',
    'Runtime values are diagnostic headless timings, not browser FPS or a performance gate.']};
writeFileSync(process.argv[2] ?? 'docs/experiments/mouth-contact-v1.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({geometry: report.geometry, controls}));
