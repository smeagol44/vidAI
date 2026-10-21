/** Bounded offline audit. No solver feedback, gene changes, or saved telemetry. */
import {createFounderGenome, FEATURED_BLUEPRINTS} from './founders';
import {createInitialWorld, addExternalOrganism} from './world';
import {DEFAULT_SETTINGS, totalAccountedEnergy} from './persistence';
import {stepSimulation, BASE_PART_DENSITY, calculateOrganismCOM,
  calculateBodyCost, calculateMaxEnergyCapacity, remapBrain,
  getCardinalAnchor, getChildAnchorForParentDir, type Genome, type SimulationSettings} from './simulation';
import {organismKineticEnergy, type MechanicalObserver, type MechanicalPhase} from './mechanicalObservation';

export function mechanicalRecorder() {
  const phases: Partial<Record<MechanicalPhase, {samples: number; addedJ: number; removedJ: number; netJ: number}>> = {};
  const observe: MechanicalObserver = (phase, before, after) => {
    const record = phases[phase] ??= {samples: 0, addedJ: 0, removedJ: 0, netJ: 0};
    const delta = after - before;
    record.samples++; record.netJ += delta;
    if (delta > 0) record.addedJ += delta;
    else record.removedJ -= delta;
  };
  return {phases, observe};
}

export function mechanicalFixture(parts = 2) {
  const config: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime: 'paid-work-v2' as const,
    targetNutrients: 0, inflowRate: 0, waterViscosity: 0, gravity: 0, mutationSeverity: 0};
  const state = createInitialWorld(config, 711, 'balanced', 'standard', 0);
  const genome = createFounderGenome('FND-001');
  genome.parts = genome.parts.slice(0, parts); genome.eyes = []; genome.mouths = []; genome.motorForce = 0;
  genome.bodyCost = calculateBodyCost(genome.parts, [], []);
  genome.maxEnergyCapacity = calculateMaxEnergyCapacity(genome.parts, genome.storageTraitMultiplier);
  remapBrain(genome);
  const org = addExternalOrganism(state, genome, config, 1200, 750, 0)!;
  return {state, config, org};
}

export function placeChildBeyondLimit(org: ReturnType<typeof mechanicalFixture>['org']) {
  const def = org.genome.parts[1], parent = org.genome.parts[def.parentIndex];
  const a = org.segments[def.parentIndex], b = org.segments[1];
  const pa = getCardinalAnchor(def.attachmentPoint, parent.width, parent.height);
  const ca = getChildAnchorForParentDir(def.attachmentPoint, def.width, def.height);
  b.angle = a.angle + def.baseAngleOffset + def.maxAngle + .2;
  b.x = a.x + Math.cos(a.angle) * pa.x - Math.sin(a.angle) * pa.y
    - Math.cos(b.angle) * ca.x + Math.sin(b.angle) * ca.y;
  b.y = a.y + Math.sin(a.angle) * pa.x + Math.cos(a.angle) * pa.y
    - Math.sin(b.angle) * ca.x - Math.cos(b.angle) * ca.y;
}

function run(name: string, fixture: ReturnType<typeof mechanicalFixture>, seconds: number) {
  const {state, config, org} = fixture, recorder = mechanicalRecorder();
  const kinetic = () => state.organisms.reduce((sum, o) => sum + organismKineticEnergy(o, BASE_PART_DENSITY), 0);
  const initialKineticJ = kinetic(), start = calculateOrganismCOM(org), reserve = org.energy;
  let positiveMotorWorkJ = 0, negativeMotorWorkJ = 0, numericalGuardEvents = 0;
  for (let tick = 0; tick < Math.round(seconds * 60); tick++) {
    stepSimulation(state, config, 1 / 60, undefined, recorder.observe);
    for (const o of state.organisms) {
      positiveMotorWorkJ += o.motorDiagnostics?.positiveWorkJ ?? 0;
      negativeMotorWorkJ += o.motorDiagnostics?.negativeWorkJ ?? 0;
      numericalGuardEvents += o.motorDiagnostics?.numericalGuardEvents ?? 0;
    }
  }
  const finalKineticJ = kinetic(), end = calculateOrganismCOM(org);
  const recordedDeltaJ = Object.values(recorder.phases).reduce((sum, phase) => sum + phase.netJ, 0);
  return {name, seconds, initialKineticJ, finalKineticJ, recordedDeltaJ,
    reconciliationErrorJ: finalKineticJ - initialKineticJ - recordedDeltaJ,
    positiveMotorWorkJ, negativeMotorWorkJ, motorChemicalCostJ: state.ledger.mechanicalWorkHeat,
    numericalGuardEvents, displacementPx: Math.hypot(end.x - start.x, end.y - start.y),
    primaryReserveSpentJ: reserve - org.energy,
    chemicalLedgerErrorJ: totalAccountedEnergy(state) - state.ledger.externalInflow,
    phases: recorder.phases};
}

export function runMechanicalAudit() {
  const rest = mechanicalFixture();
  const gap = mechanicalFixture(); gap.org.segments[1].x += 1;
  const limit = mechanicalFixture(); placeChildBeyondLimit(limit.org);
  const contact = mechanicalFixture(1);
  const second = addExternalOrganism(contact.state, structuredClone(contact.org.genome), contact.config,
    1200 + contact.org.genome.parts[0].width - .5, 750, 0)!;
  contact.org.segments[0].vx = 10; second.segments[0].vx = -10;
  const articulated = mechanicalFixture();
  addExternalOrganism(articulated.state, structuredClone(articulated.org.genome), articulated.config, 1200, 752, 0);
  const controls = [run('aligned-rest', rest, .1), run('one-pixel-anchor-error-at-rest', gap, .1),
    run('angular-limit-error-at-rest', limit, .1), run('inelastic-single-part-contact', contact, .1),
    run('overlapping-articulated-bodies-at-rest', articulated, .1)];
  const starters = FEATURED_BLUEPRINTS.map(design => {
    const config = {...rest.config, waterViscosity: .18};
    const state = createInitialWorld(config, 711, 'balanced', 'standard', 0);
    const genome: Genome = createFounderGenome(design.id);
    const org = addExternalOrganism(state, genome, config, 1200, 750, .37)!;
    return run(design.id, {state, config, org}, 5);
  });
  return {protocol: 'solver-stage-kinetic-audit-v1', seed: 711, controls, starters,
    notes: [
      'Observation only: all forces, iteration order, physics regimes, genes and saved state are unchanged.',
      'Stage changes measure translational plus rotational kinetic energy in joules; forces-and-motors combines motor, fluid, gravity and wall forces.',
      'Gross added/removed values include exchanges during iterative solving; use net values for total reconciliation.',
      'Position projection changes pose without immediate kinetic change; later bias/force changes can still inject energy.',
      'No spring potential or fluid energy is modeled here. This is a kinetic audit, not a proof of total mechanical conservation.',
      'Frozen starter swims use five seconds, heading .37, viscosity .18, no food or gene tuning. No ecological fitness claim.',
    ]};
}
