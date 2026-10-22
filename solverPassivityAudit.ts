/** Offline release comparisons only; never imported by the product. */
import {createFounderGenome} from './founders';
import {createInitialWorld, addExternalOrganism} from './world';
import {DEFAULT_SETTINGS, totalAccountedEnergy} from './persistence';
import {stepSimulation, calculateOrganismCOM, getCardinalAnchor, getChildAnchorForParentDir,
  type Organism, type SimulationSettings} from './simulation';
import {mechanicalRecorder} from './mechanicalAudit';

export function jointErrors(org: Organism) {
  let anchorPx = 0, limitRad = 0;
  for (let i = 1; i < org.segments.length; i++) {
    const d = org.genome.parts[i], pd = org.genome.parts[d.parentIndex];
    const a = org.segments[d.parentIndex], b = org.segments[i];
    const pa = getCardinalAnchor(d.attachmentPoint, pd.width, pd.height);
    const pb = getChildAnchorForParentDir(d.attachmentPoint, d.width, d.height);
    anchorPx = Math.max(anchorPx, Math.hypot(b.x + Math.cos(b.angle) * pb.x - Math.sin(b.angle) * pb.y
      - a.x - Math.cos(a.angle) * pa.x + Math.sin(a.angle) * pa.y,
    b.y + Math.sin(b.angle) * pb.x + Math.cos(b.angle) * pb.y - a.y - Math.sin(a.angle) * pa.x - Math.cos(a.angle) * pa.y));
    const relative = b.angle - a.angle - d.baseAngleOffset;
    limitRad = Math.max(limitRad, Math.abs(Math.atan2(Math.sin(relative), Math.cos(relative))) - d.maxAngle);
  }
  return {anchorPx, limitRad};
}

export function observeSolver(id: string, physicsRegime: 'paid-work-v2' | 'passive-work-v3',
  seconds = 5, heading = .37, viscosity = .18) {
  const config: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0, waterViscosity: viscosity};
  const state = createInitialWorld(config, 711, 'balanced', 'standard', 0);
  const org = addExternalOrganism(state, createFounderGenome(id), config, 1200, 750, heading)!;
  const start = calculateOrganismCOM(org), reserve = org.energy, recorder = mechanicalRecorder();
  let guards = 0, limitedBatches = 0, maxAnchorErrorPx = 0, maxLimitExcessRad = 0, maxConstraintGainJ = 0;
  const began = performance.now();
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    stepSimulation(state, config, 1 / 60, undefined, (phase, before, after) => {
      recorder.observe(phase, before, after);
      if (phase === 'constraint-batch') maxConstraintGainJ = Math.max(maxConstraintGainJ, after - before);
    });
    guards += org.motorDiagnostics?.numericalGuardEvents ?? 0;
    limitedBatches += org.motorDiagnostics?.constraintLimitedBatches ?? 0;
    const error = jointErrors(org);
    maxAnchorErrorPx = Math.max(maxAnchorErrorPx, error.anchorPx);
    maxLimitExcessRad = Math.max(maxLimitExcessRad, error.limitRad);
  }
  const end = calculateOrganismCOM(org);
  return {id, physicsRegime, seconds, heading, viscosity,
    displacementPx: Math.hypot(end.x - start.x, end.y - start.y), reserveSpentJ: reserve - org.energy,
    guards, limitedBatches, maxAnchorErrorPx, maxLimitExcessRad, maxConstraintGainJ,
    chemicalErrorJ: totalAccountedEnergy(state) - state.ledger.externalInflow,
    runtimeMs: Math.round(performance.now() - began), phases: recorder.phases};
}
