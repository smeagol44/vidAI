import assert from 'node:assert/strict';
import {test} from 'node:test';
import {scenarioObserverPreferences, restoreObserverPreferences} from '../observerPreferences';
import {createScenarioWorld} from '../environmentScenarios';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot} from '../persistence';

test('scenario observation defaults are independent, editable and never change simulated state', () => {
  for (const scenario of ['default', 'harsh-world', 'pipe-world'] as const) {
    const f = createScenarioWorld(DEFAULT_SETTINGS, scenario, 71, 'balanced', 'standard', 0);
    const enabled = scenario === 'default';
    const expected = {selectAddedCreature: enabled, trackSelectedCreature: enabled, showCaustics: enabled};
    assert.deepEqual(f.observerPreferences, expected);
    const before = createSnapshot(f.state, f.settings);
    const beforeRandom = f.state.prng.getState();
    const beforeCaustics = structuredClone(f.state.caustics);
    f.observerPreferences.selectAddedCreature = !enabled;
    f.observerPreferences.showCaustics = !enabled;
    assert.deepEqual(createSnapshot(f.state, f.settings), before);
    assert.deepEqual(f.state.caustics, beforeCaustics);
    assert.deepEqual(f.state.prng.getState(), beforeRandom);
    assert.deepEqual(scenarioObserverPreferences(scenario), expected);
    const saved = createSnapshot(f.state, f.settings, {observerPreferences: f.observerPreferences});
    const loaded = restoreSnapshot(saved);
    assert.deepEqual(loaded.state.prng.getState(), beforeRandom);
    assert.deepEqual(createSnapshot(loaded.state, loaded.settings).state, before.state);
    assert.deepEqual(restoreObserverPreferences(loaded.metadata.observerPreferences), f.observerPreferences);
  }
});

test('three observer preferences restore independently; historical snapshots show caustics', () => {
  for (const selectAddedCreature of [false, true])
    for (const trackSelectedCreature of [false, true])
      for (const showCaustics of [false, true]) {
        const value = {selectAddedCreature, trackSelectedCreature, showCaustics};
        assert.deepEqual(restoreObserverPreferences(value), value);
      }
  assert.deepEqual(restoreObserverPreferences({selectAddedCreature: false, trackSelectedCreature: false}),
    {selectAddedCreature: false, trackSelectedCreature: false, showCaustics: true});
  for (const value of [undefined, null, 'bad', {selectAddedCreature: 'false'}])
    assert.deepEqual(restoreObserverPreferences(value),
      {selectAddedCreature: true, trackSelectedCreature: true, showCaustics: true});
});
