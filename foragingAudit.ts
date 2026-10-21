/** Offline observations of a bounded starter calibration. Never imported by
 * the live kernel/UI; target coordinates and scores are measurement only. */
import * as sim from './simulation';
import {createFounderGenome} from './founders';
import {addExternalOrganism, createInitialWorld} from './world';
import {LEGACY_SETTINGS, totalAccountedEnergy} from './persistence';
import {FoodAcquisitionObserver} from './foodAcquisitionAudit';

export type TwinOarCondition = 'catalogue' | 'current' | 'gait-only' | 'retinal-disconnected';
export const TWIN_OAR_APPROACH_CONDITIONS = [-1, 1].flatMap(side => [135, 160].flatMap(distance =>
  [{side, distance, heading: .8, viscosity: .15}, {side, distance, heading: -1.2, viscosity: .22}]));

function genomeFor(condition: TwinOarCondition): sim.Genome {
  const g = createFounderGenome('CUR-002', 'balanced',
    {foraging: condition === 'catalogue' || condition === 'gait-only' ? 'catalogue' : 'current'});
  if (condition === 'gait-only') g.parts[2].cpgPhaseOffset += Math.PI;
  if (condition === 'retinal-disconnected') g.inputKeys!.forEach((key, i) => {
    if (!key.startsWith('eye:')) return;
    const darkBaseline = key.endsWith(':distance') ? 1 : 0;
    g.weightsIH.forEach((row, h) => {g.biasesH[h] += row[i] * darkBaseline; row[i] = 0;});
  });
  return g;
}

/** Finite off-axis food, normal juvenile reserves and unmodified metabolism.
 * No per-tick intervention. Sixteen seconds is below normal maturity. */
export function runTwinOarApproach(condition: TwinOarCondition,
  setup: {side: number; distance: number; heading: number; viscosity: number},
  physicsRegime: sim.SimulationSettings['physicsRegime'] = 'legacy-v0') {
  const settings = {...LEGACY_SETTINGS, physicsRegime, targetNutrients: 0, inflowRate: 0,
    mutationSeverity: 0, waterViscosity: setup.viscosity};
  const state = createInitialWorld(settings, 811, 'balanced', 'standard', 0);
  const org = addExternalOrganism(state, genomeFor(condition), settings, 1200, 750, setup.heading)!;
  const angle = setup.heading + setup.side * .45;
  state.nutrients.push({id: 'finite-assay-food', kind: 'nutrient',
    x: 1200 + Math.cos(angle) * setup.distance, y: 750 + Math.sin(angle) * setup.distance,
    vx: 0, vy: 0, energyValue: 3000, radius: sim.getNutrientRadius(3000), bottomTimer: 0, pulseTimer: 0});
  state.ledger.externalInflow += 3000;
  const observer = new FoodAcquisitionObserver(state);
  let visibleTicks = 0, capTicks = 0;
  for (let i = 0; i < 960; i++) {
    sim.stepSimulation(state, settings, 1 / 60);
    observer.sample(state);
    if (org.rayHits.some(r => r.objectType === 'nutrient' && r.r + r.g + r.b > 0)) visibleTicks++;
    if ((org.motorEnergyRate ?? 0) >= sim.MAX_FRAME_MOTOR_WORK * 60 - 1e-8) capTicks++;
  }
  const result = observer.results(state)[0];
  return {condition, ...setup, seconds: 16, visibleTicks, capTicks,
    absorbedJ: result.absorbedJ.Nutrient,
    reserveDeltaJ: org.energy - result.initialReserveJ,
    expenditureJ: result.initialReserveJ + result.absorbedJ.Nutrient - org.energy,
    mouthContactTicks: result.mouthContactTicks,
    energyErrorJ: totalAccountedEnergy(state) - state.ledger.externalInflow,
    valid: !org.dissolving && org.segments.every(s => Object.values(s).every(Number.isFinite))};
}

/** Current defaults, all nine juveniles, ordinary scattered food and inflow.
 * Only CUR-002's inherited calibration/initial phase differs between worlds.
 * The observers never modify food placement, steering, maturity or reserves. */
export function runTwinOarScatteredPair(seed: number) {
  const settings = {...LEGACY_SETTINGS, targetNutrients: 275};
  const measure = (condition: 'catalogue' | 'current') => {
    const state = createInitialWorld(settings, seed, 'balanced', 'showcase');
    const org = state.organisms.find(o => o.genome.id === 'CUR-002')!;
    org.genome = genomeFor(condition);
    org.joints.forEach((j, i) => {j.phase = org.genome.parts[i + 1].cpgPhaseOffset;});
    state.lineage.get(org.id)!.genome = org.genome;
    const observer = new FoodAcquisitionObserver(state);
    for (let i = 0; i < 2400; i++) {sim.stepSimulation(state, settings, 1 / 60); observer.sample(state);}
    const result = observer.results(state).find(o => o.organismId === org.id)!;
    return {absorbedJ: result.absorbedJ.Nutrient,
      reserveDeltaJ: result.finalReserveJ - result.initialReserveJ,
      mouthContactTicks: result.mouthContactTicks, eggsLaid: result.fundedEggsLaid,
      energyErrorJ: totalAccountedEnergy(state) - state.ledger.externalInflow};
  };
  return {seed, seconds: 40, catalogue: measure('catalogue'), current: measure('current')};
}
