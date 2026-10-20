import * as sim from './simulation';
import {createFounderGenome} from './founders';
import {createInitialWorld, addExternalOrganism} from './world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, clearFreeNutrients} from './persistence';
import {EcologyIntakeObserver, readEcologyState, type EcologyStateReport, type IntakeLedger} from './ecologyAudit';

export const ECOLOGY_DT = 1 / 60;
export const ECOLOGY_SEEDS = [17, 29, 41] as const;
const baseSettings = {...DEFAULT_SETTINGS, targetNutrients: 60, inflowRate: 0,
  mutationSeverity: .25, kinshipProtection: true};

export interface EcologyTrialResult {
  seed: number;
  condition: string;
  durationSeconds: number;
  initialBirths: number;
  initialReservesJ: number;
  final: EcologyStateReport;
  absorbedJ: IntakeLedger;
}

/** No per-tick manipulation: biology and contacts run through production
 * stepSimulation. Fixed initial conditions are visible in the condition label.
 * A counterfactual is a full cloned world (including PRNG state), with plant
 * resources explicitly removed and accounted as a loss before t=0. */
function measure(state: sim.SimulationState, condition: string, seed: number, steps: number,
  settings = baseSettings): EcologyTrialResult {
  const observer = new EcologyIntakeObserver();
  const beginning = readEcologyState(state);
  for (let i = 0; i < steps; i++) {
    sim.stepSimulation(state, settings, ECOLOGY_DT);
    observer.sample(state);
  }
  return {seed, condition, durationSeconds: steps * ECOLOGY_DT,
    initialBirths: beginning.population.seededOrHatchedBirths,
    initialReservesJ: beginning.resources.livingReservesJ,
    final: readEcologyState(state), absorbedJ: observer.totals()};
}

export function runUnassistedEcologyPair(seed: number) {
  const seeded = createInitialWorld(baseSettings, seed, 'balanced', 'standard', 4);
  // PRNG, genomes, anatomy, velocities and neural state start identical.
  const control = restoreSnapshot(createSnapshot(seeded, baseSettings)).state;
  clearFreeNutrients(control); // explicitly booked as recorded environmental loss
  const withFood = measure(seeded, 'four seeded free-swimming founders + 60 scattered nutrients; no inflow', seed, 180);
  const withoutFood = measure(control, 'identical founders + all free nutrients removed at t=0; no inflow', seed, 180);
  return {seed, withFood, withoutFood};
}

function disconnectRetina(g: sim.Genome): void {
  // Preserve the original zero-stimulus activation without changing joint,
  // oral, injury or oscillator weights. This is a genetic counterfactual,
  // not a perception override or physically different body.
  g.inputKeys!.forEach((key, index) => {
    if (!key.startsWith('eye:')) return;
    const baseline = key.endsWith(':distance') ? 1 : 0;
    g.weightsIH.forEach((row, h) => {
      g.biasesH[h] += row[index] * baseline;
      row[index] = 0;
    });
  });
}

export function runControlledGrazing(seed: number, side: -1 | 1, distance: 135 | 160, vision: boolean) {
  const settings = {...baseSettings, targetNutrients: 0, mutationSeverity: 0};
  const state = createInitialWorld(settings, seed, 'unbiased', 'standard', 0);
  const genome = createFounderGenome('FND-001', 'balanced');
  genome.maturityAge = 1000; // short assay isolates feeding, not breeding
  if (!vision) disconnectRetina(genome);
  addExternalOrganism(state, genome, settings, 1200, 750, 0);
  const angle = side * .5;
  const x = 1200 + Math.cos(angle) * distance;
  const y = 750 + Math.sin(angle) * distance;
  state.nutrients.push({id: 'audited-nutrient', x, y, vx: 0, vy: 0,
    kind: 'nutrient', energyValue: 3000, radius: sim.getNutrientRadius(3000), bottomTimer: 0, pulseTimer: 0});
  state.ledger.externalInflow += 3000; // a finite, explicit start-of-trial resource
  const trial = measure(state, vision ? 'sighted: off-axis finite food' : 'retinal-disconnected: same finite food',
    seed, 360, settings);
  return {...trial, side, distance, vision, remainingNutrientJ: state.nutrients
    .filter(n => n.kind !== 'carrion').reduce((sum, n) => sum + n.energyValue, 0)};
}

function createAdult(seed: number, funded: boolean) {
  const settings = {...baseSettings, targetNutrients: 0};
  const state = createInitialWorld(settings, seed, 'unbiased', 'standard', 0);
  const g = createFounderGenome('FND-001', 'unbiased');
  g.targetClutchSize = 1;
  g.motorForce = 0; // immobile adult to isolate allocation bookkeeping
  const parent = addExternalOrganism(state, g, settings, 1200, 750, 0)!;
  parent.age = 40; state.simTime = 50; // explicit pre-adult cohort, not natural lifecycle fitness
  const firstEgg = sim.evaluateReproductionAffordability(parent, state.simTime, 1, 0).requiredForOneEgg;
  const initialReserve = funded ? firstEgg + 2000 : firstEgg - 200;
  // Pre-existing initial cohort reserve is external energy only ONCE;
  // this setup never injects anything during stepping or reproduction.
  state.ledger.externalInflow += initialReserve - parent.energy;
  parent.energy = initialReserve;
  return {state, parent, settings, initialReserve};
}

export function runAdultEggAllocation(seed: number, funded: boolean) {
  const {state, parent, settings, initialReserve} = createAdult(seed, funded);
  const result = measure(state, funded ? 'mature warm-start with initially funded reserve'
    : 'identical mature warm-start, reserve below first-egg threshold',
    seed, 2, settings);
  return {...result, initialReserve,
    parentalEnergyJ: parent.energy,
    parentOffspringCount: parent.offspringCount,
    eggDetails: state.eggs.map(egg => ({fundedReserveJ: egg.fundedReserve,
      fundedStructuralJ: egg.fundedStructural, actualChildStructuralCostJ: egg.genome.bodyCost,
      parentId: egg.parentOrgId, generation: egg.genome.generation}))};
}

export function runStarvationCohort(seed: number) {
  const settings = {...baseSettings, targetNutrients: 0};
  const state = createInitialWorld(settings, seed, 'unbiased', 'standard', 0);
  const g = createFounderGenome('FND-001', 'unbiased');
  g.motorForce = 0;
  const org = addExternalOrganism(state, g, settings, 1200, 750, 0)!;
  const reserve = 1;
  state.ledger.externalInflow += reserve - org.energy;
  org.energy = reserve; // explicit impoverished initial condition, not a hidden starvation script
  const result = measure(state, 'juvenile with only 1 J at initialization, no food', seed, 55, settings);
  return result;
}

/**
 * First ecosystem-scale comparison with all nine curated founders, 400
 * naturally seeded nutrients, ordinary intake and native metabolism.
 * The initial animals/positions are identical across conditions: only the
 * abiotic food distribution differs. No food is placed at a mouth, no
 * scripted steering, no pre-funded adults and no post-start interventions.
 * Optional benchmark only; not part of fast tests or a fitness guarantee.
 */
export function runFeaturedFoodDistributionPair(seed = 17, seconds = 3) {
  const settings = {...DEFAULT_SETTINGS, inflowRate: 15, targetNutrients: 400,
    nutrientPattern: 'uniform' as const};
  const create = (pattern: 'uniform' | 'blooms') => {
    const config = {...settings, nutrientPattern: pattern};
    const state = createInitialWorld(config, seed, 'balanced', 'showcase');
    const founders = state.organisms.map(o => ({
      orgId: o.id, founderId: o.genome.id, initialEnergyJ: o.energy,
      position: sim.calculateOrganismCOM(o),
    }));
    const observer = new EcologyIntakeObserver();
    const initialFoodJ = readEcologyState(state).resources.freeFoodJ;
    for (let i = 0; i < Math.floor(seconds / ECOLOGY_DT); i++) {
      sim.stepSimulation(state, config, ECOLOGY_DT);
      observer.sample(state);
    }
    const intake = observer.perOrganismTotals();
    const outcomes = founders.map(f => {
      const final = state.organisms.find(o => o.id === f.orgId);
      return {
        founderId: f.founderId,
        absorbedNutrientJ: intake[f.orgId]?.Nutrient ?? 0,
        absorbedPreyJ: intake[f.orgId]?.Prey ?? 0,
        endReserveJ: final?.energy ?? 0,
        reserveDeltaJ: (final?.energy ?? 0) - f.initialEnergyJ,
        living: !!final && !final.dissolving,
        eggsLaid: state.lineage.get(f.orgId)?.offspringCount ?? 0,
      };
    });
    return {pattern, initialFoodJ, founderStart: founders.map(f =>
      ({id: f.founderId, x: f.position.x, y: f.position.y})),
      final: readEcologyState(state), totalIntakeJ: observer.totals(), outcomes};
  };
  return {seed, seconds, uniform: create('uniform'), blooms: create('blooms')};
}

export function collectEcologyBaseline() {
  return {
    protocol: 'VIDA-BD-short-fixed-seed-v1',
    physics: 'production-kernel / 1/60 s, no scripted feeding or steering',
    scope: 'bounded experiments; not ecological viability or evolutionary selection',
    featuredFoodDistribution: runFeaturedFoodDistributionPair(),
    unassistedPairs: ECOLOGY_SEEDS.map(runUnassistedEcologyPair),
    controlledGrazing: ECOLOGY_SEEDS.slice(0, 2).flatMap(seed => [-1, 1].flatMap(side =>
      [135, 160].flatMap(distance => [true, false].map(vision =>
        runControlledGrazing(seed, side as -1 | 1, distance as 135 | 160, vision))))),
    adultAllocation: ECOLOGY_SEEDS.flatMap(seed => [true, false].map(funded => runAdultEggAllocation(seed, funded))),
    lowReserveMortality: ECOLOGY_SEEDS.map(runStarvationCohort),
  };
}
