import {type Nutrient, type SimulationSettings, getNutrientRadius} from '../../simulation';
import {DEFAULT_SETTINGS} from '../../persistence';
import {createInitialWorld} from '../../world';
import {enableClosedEconomy, embodiedEnergy} from '../../energyEconomy';
export const cycleSettings: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3',
  ecologyRegime: 'closed-v1', mouthContactModel: 'capsule-v1', nutrientCycle: 'decay-v1',
  targetNutrients: 275, nutrientLimit: null, inflowRate: 0};
export function food(energy = 3000, carrion = false, x = 1200, y = 750): Nutrient {
  return {id: `food-${x}-${y}`, x, y, vx: 0, vy: 0, energyValue: energy,
    radius: getNutrientRadius(energy, 'decay-v1'), bottomTimer: 0, pulseTimer: 0,
    ...(carrion ? {kind: 'carrion' as const, decayTimeRemaining: 60} : {})};
}
export function cycleFixture(items: Nutrient[] = [food()]) {
  const settings = {...cycleSettings};
  const state = createInitialWorld({...settings, targetNutrients: 0}, 125, 'balanced', 'standard', 0);
  state.nutrients = items; delete state.energyPool; enableClosedEconomy(state);
  state.energyPool!.budget = embodiedEnergy(state);
  return {state, settings};
}
