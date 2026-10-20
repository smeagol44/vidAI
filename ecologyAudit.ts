import type {DeathCause, FeedingEvent, FoodCategory, SimulationState} from './simulation';
import {totalAccountedEnergy} from './persistence';

export type IntakeLedger = Record<FoodCategory, number>;
function emptyIntake(): IntakeLedger {
  return {Nutrient: 0, Carrion: 0, Prey: 0, Egg: 0};
}

export interface EcologyStateReport {
  simTime: number;
  population: {
    alive: number; dissolving: number; eggs: number;
    seededOrHatchedBirths: number; completedDeaths: number;
    deathCauses: Record<DeathCause, number>; maximumGeneration: number;
    eggLayings: number; fundedEggReserveJ: number; fundedEggStructuralJ: number;
  };
  resources: {freeFoodJ: number; carrionJ: number; livingReservesJ: number};
  energy: {externalInflowJ: number; accountedJ: number; discrepancyJ: number;
    metabolicHeatJ: number; mechanicalHeatJ: number; recordedLossJ: number};
}

/** Read-only ecological census. Egg laying and hatching are distinct:
 * totalBirths includes world-seeded creatures, while lineage offspringCount
 * counts funded eggs laid even before hatching. Recorded deaths are
 * completed dissolutions (not just organisms currently marked dying). */
export function readEcologyState(state: SimulationState): EcologyStateReport {
  const active = state.organisms.filter(o => !o.dissolving);
  const deathCauses: Record<DeathCause, number> = {'Old Age': 0, Starvation: 0, Predation: 0};
  let eggLayings = 0;
  for (const rec of state.lineage.values()) {
    eggLayings += rec.offspringCount;
    if (rec.deathCause) deathCauses[rec.deathCause]++;
  }
  const accountedJ = totalAccountedEnergy(state);
  const sumFood = (carrion: boolean) => state.nutrients
    .filter(food => (food.kind === 'carrion') === carrion)
    .reduce((sum, food) => sum + food.energyValue, 0);
  return {
    simTime: state.simTime,
    population: {
      alive: active.length,
      dissolving: state.organisms.length - active.length,
      eggs: state.eggs.length,
      seededOrHatchedBirths: state.totalBirths,
      completedDeaths: state.totalDeaths,
      deathCauses,
      maximumGeneration: Math.max(0, ...active.map(o => o.genome.generation)),
      eggLayings,
      fundedEggReserveJ: state.eggs.reduce((sum, egg) => sum + egg.fundedReserve, 0),
      fundedEggStructuralJ: state.eggs.reduce((sum, egg) => sum + egg.fundedStructural, 0),
    },
    resources: {
      freeFoodJ: sumFood(false),
      carrionJ: sumFood(true),
      livingReservesJ: active.reduce((sum, org) => sum + org.energy, 0),
    },
    energy: {
      externalInflowJ: state.ledger.externalInflow,
      accountedJ,
      discrepancyJ: accountedJ - state.ledger.externalInflow,
      metabolicHeatJ: state.ledger.metabolicDissipation,
      mechanicalHeatJ: state.ledger.mechanicalWorkHeat,
      recordedLossJ: state.ledger.recordedLosses,
    },
  };
}

/** Observes genuine mouth transfer receipts on each completed simulation tick.
 * VIDA coalesces recentFeedings events in place (over a 0.25 s window);
 * remembering the previous amount per EVENT OBJECT avoids counting the
 * growing receipt twice. Call after every step; this is an ephemeral
 * measurement, not persisted simulation state or a food-generation mechanism.
 * If more than eight separate receipts arrive within one tick, VIDA's
 * bounded recentFeedings buffer cannot expose all of them: do not use
 * this observer as a comprehensive high-density ecosystem ledger. */
export class EcologyIntakeObserver {
  private observed = new WeakMap<FeedingEvent, number>();
  private byOrganism = new Map<string, IntakeLedger>();
  private lastTime = -Infinity;
  readonly absorbedJ: IntakeLedger = emptyIntake();

  sample(state: SimulationState): void {
    if (state.simTime <= this.lastTime) {
      throw new Error('EcologyIntakeObserver: sample at most once, after each completed forward tick');
    }
    this.lastTime = state.simTime;
    for (const org of state.organisms) for (const receipt of org.recentFeedings ?? []) {
      const previous = this.observed.get(receipt) ?? 0;
      const delta = receipt.energyTransferred - previous;
      if (!Number.isFinite(delta) || delta < -1e-8) throw new Error('Invalid feeding receipt');
      if (delta > 0) {
        this.absorbedJ[receipt.foodCategory] += delta;
        let own = this.byOrganism.get(org.id);
        if (!own) {own = emptyIntake(); this.byOrganism.set(org.id, own);}
        own[receipt.foodCategory] += delta;
      }
      this.observed.set(receipt, receipt.energyTransferred);
    }
  }

  totals(): IntakeLedger { return {...this.absorbedJ}; }

  /** Per-individual, read-only energy absorbed from actual mouth receipts. */
  perOrganismTotals(): Record<string, IntakeLedger> {
    return Object.fromEntries([...this.byOrganism].map(([id, tally]) => [id, {...tally}]));
  }
}
