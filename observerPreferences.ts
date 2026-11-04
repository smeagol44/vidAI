import type {EnvironmentScenario} from './environmentScenarios';

/** Presentation preferences never enter simulation settings or Worker controls. */
export interface ObserverPreferences {
  selectAddedCreature: boolean;
  trackSelectedCreature: boolean;
  showCaustics: boolean;
}
export function scenarioObserverPreferences(scenario: EnvironmentScenario): ObserverPreferences {
  const enabled = scenario === 'default';
  return {selectAddedCreature: enabled, trackSelectedCreature: enabled, showCaustics: enabled};
}
/** Historical snapshots have no observer metadata and keep the original defaults. */
export function restoreObserverPreferences(value: unknown): ObserverPreferences {
  if (!value || typeof value !== 'object') return scenarioObserverPreferences('default');
  const input = value as Partial<ObserverPreferences>;
  return {selectAddedCreature: typeof input.selectAddedCreature === 'boolean' ? input.selectAddedCreature : true,
    trackSelectedCreature: typeof input.trackSelectedCreature === 'boolean' ? input.trackSelectedCreature : true,
    showCaustics: typeof input.showCaustics === 'boolean' ? input.showCaustics : true};
}
