import {scenarioObserverPreferences} from './observerPreferences';
import type {SimulationSettings} from './simulation';
import type {FounderMode} from './founders';
import {createInitialWorld} from './world';
import {clearFreeNutrients} from './persistence';

export type EnvironmentScenario = 'default' | 'harsh-world' | 'pipe-world';

/** Independent startup recipe, copied once from the reviewed fork Harsh reference.
 * Never derive this object from Harsh or caller defaults. Shared engine rules
 * (founder creation, funded eggs and food banking) remain authoritative.
 */
export const PIPE_WORLD_PRESET: Readonly<SimulationSettings> = Object.freeze({
  worldWidth: 4600, worldHeight: 2100, gravity: 20, waterViscosity: .40,
  inflowRate: 1, nutrientLimit: 200, targetNutrients: 275, nutrientPattern: 'uniform',
  maxOrganisms: 50, kinshipProtection: true, mutationSeverity: .25,
  physicsRegime: 'passive-work-v3', ecologyRegime: 'closed-v1',
  mouthContactModel: 'capsule-v1', nutrientCycle: 'decay-v2',
});

/** Startup only. Saved worlds never pass through this factory. */
export function createScenarioWorld(defaults: SimulationSettings, scenario: EnvironmentScenario,
  seed: number, mode: FounderMode = 'balanced', preset = 'standard', requestedCount = 18) {
  const settings: SimulationSettings = scenario === 'pipe-world'
    ? {...PIPE_WORLD_PRESET}
    : scenario === 'harsh-world'
    ? {...defaults, inflowRate: 1, nutrientLimit: 200, worldWidth: 4800, worldHeight: 3000,
      gravity: 20, maxOrganisms: 50, waterViscosity: .40}
    : {...defaults};
  const state = createInitialWorld(settings, seed, mode, preset, requestedCount);
  // Keep the existing initial grant and PRNG path, then bank the free food
  // before publishing the world. This is the existing manual clear operation.
  if (scenario === 'harsh-world' || scenario === 'pipe-world') clearFreeNutrients(state);
  return {state, settings, observerPreferences: scenarioObserverPreferences(scenario)};
}
