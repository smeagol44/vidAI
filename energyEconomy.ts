import type {Egg, SimulationState} from './simulation';

/** A live ecological stock. Heat/loss ledger fields remain cumulative diagnostics. */
export interface EnergyPool {
  regime: 'closed-v1';
  budget: number;
  reserve: number;
}

export const EGG_RESERVE_TOPUP = .1;
export const EGG_LIFETIME_MULTIPLIER = 3;
export const FOOD_SAFETY_LIMIT = 2200;

export function embodiedEnergy(s: SimulationState): number {
  return s.organisms.reduce((v, o) => v + o.energy + o.structuralBiomass, 0)
    + s.eggs.reduce((v, e) => v + e.fundedStructural + e.fundedReserve, 0)
    + s.nutrients.reduce((v, n) => v + n.energyValue, 0);
}

export function initializeClosedEgg(egg: Egg): void {
  egg.ageSeconds = Math.min(1, Math.max(0, egg.incubationProgress)) * egg.totalIncubationTime;
  egg.hatchReserveTarget = Math.min(egg.genome.maxEnergyCapacity,
    egg.fundedReserve * (1 + EGG_RESERVE_TOPUP));
}

/** Explicit conversion: no historical expenditure is restored, no PRNG draws. */
export function enableClosedEconomy(s: SimulationState): void {
  if (s.energyPool) return;
  s.energyPool = {regime: 'closed-v1', budget: embodiedEnergy(s), reserve: 0};
  s.nutrientAccumulator = 0;
  for (const egg of s.eggs) initializeClosedEgg(egg);
}

export function setWorldEnergy(s: SimulationState, budget: number): void {
  if (!s.energyPool) throw new Error('Convert this world to the closed economy first');
  if (!Number.isFinite(budget) || budget < 0 || budget > 1e9)
    throw new Error('World energy must be between 0 and 1,000,000,000 J');
  s.energyPool.reserve += budget - s.energyPool.budget;
  s.energyPool.budget = budget;
}

export function occupiedPopulation(s: SimulationState): number {
  return s.organisms.filter(o => !o.dissolving).length + (s.energyPool ? s.eggs.length : 0);
}

export function eggEnergyRequirement(egg: Egg): number {
  return egg.genome.bodyCost + (egg.hatchReserveTarget ?? 0);
}

/** Allocate shared funds proportionally to demand, before any egg can hatch.
 * Nutrient conversion precedes uptake; both are funded and have bounded rates. */
export function fundIncubatingEggs(s: SimulationState, dt: number): void {
  const pool = s.energyPool;
  if (!pool || pool.reserve <= 0) return;
  const demands = s.eggs.map(egg => {
    if ((egg.ageSeconds ?? 0) + dt >= EGG_LIFETIME_MULTIPLIER * egg.totalIncubationTime) return 0;
    return Math.min(Math.max(0, eggEnergyRequirement(egg) - egg.fundedStructural - egg.fundedReserve),
      (egg.hatchReserveTarget ?? 0) * EGG_RESERVE_TOPUP * dt / egg.totalIncubationTime);
  });
  const demand = demands.reduce((v, n) => v + n, 0);
  if (!demand) return;
  const fraction = Math.min(1, pool.reserve / demand);
  for (let i = 0; i < s.eggs.length; i++) {
    const amount = Math.min(pool.reserve, demands[i] * fraction);
    const egg = s.eggs[i];
    const repair = Math.min(amount, Math.max(0, egg.genome.bodyCost - egg.fundedStructural));
    egg.fundedStructural += repair;
    egg.fundedReserve += amount - repair;
    pool.reserve -= amount;
  }
}
