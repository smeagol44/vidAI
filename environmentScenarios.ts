import type {SimulationSettings} from './simulation';
import type {FounderMode} from './founders';
import {createInitialWorld} from './world';
import {clearFreeNutrients} from './persistence';

export type EnvironmentScenario = 'default' | 'harsh-world';

/** Startup only. Saved worlds never pass through this factory. */
export function createScenarioWorld(defaults: SimulationSettings, scenario: EnvironmentScenario,
  seed: number, mode: FounderMode = 'balanced', preset = 'standard', requestedCount = 18) {
  const settings: SimulationSettings = scenario === 'harsh-world'
    ? {...defaults, inflowRate: 1, nutrientLimit: 200, worldWidth: 4800, worldHeight: 3000,
      gravity: 20, maxOrganisms: 50, waterViscosity: .40}
    : {...defaults};
  const state = createInitialWorld(settings, seed, mode, preset, requestedCount);
  // Keep the existing initial grant and PRNG path, then bank the free food
  // before publishing the world. This is the existing manual clear operation.
  if (scenario === 'harsh-world') clearFreeNutrients(state);
  return {state, settings};
}
