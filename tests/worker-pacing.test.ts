import assert from 'node:assert/strict';
import {test} from 'node:test';
import {workerWakeDelay, FIXED_TICK_SECONDS} from '../workerPacing';
import {selectSimulationSpeed, toggleSimulationSpeed, SIMULATION_SPEEDS, isSimulationSpeed,
  type PlaybackSpeed} from '../simulationSpeed';

test('x0 remembers every supported nonzero speed and either pause entry resumes identically', () => {
  for (const speed of SIMULATION_SPEEDS) {
    if (speed === 0) continue;
    const playing = selectSimulationSpeed({speed: 0, lastNonzero: 1}, speed);
    const paused = selectSimulationSpeed(playing, 0);
    assert.deepEqual(paused, {speed: 0, lastNonzero: speed});
    assert.deepEqual(toggleSimulationSpeed(playing), paused);
    assert.deepEqual(toggleSimulationSpeed(paused), playing);
    assert.deepEqual(toggleSimulationSpeed(selectSimulationSpeed(paused, 0)), playing);
    const changed: PlaybackSpeed = selectSimulationSpeed(paused, 2);
    assert.deepEqual(changed, {speed: 2, lastNonzero: 2});
  }
  assert.deepEqual(SIMULATION_SPEEDS, [0, 1, 2, 5, 10, 20, 'max']);
  for (const value of [NaN, Infinity, -1, .5, 4, 50, '0', null, undefined]) assert.equal(isSimulationSpeed(value), false);
});

test('overdue simulation yields to commands without introducing timer idle time', () => {
  assert.equal(workerWakeDelay(FIXED_TICK_SECONDS, 1, 0, true), 0);
  assert.equal(workerWakeDelay(0, 1, 20, true), 0);
  assert.equal(workerWakeDelay(0, 5, 4, true), 0);
  // A 20ms kernel tick cannot sustain 1x; sleeping another 4ms would
  // artificially reduce its ceiling from 50 to about 42 ticks/second.
  let simulated = 0, wall = 0;
  while (wall < 1000) {
    simulated += FIXED_TICK_SECONDS; wall += 20;
    wall += workerWakeDelay(Math.max(0, wall / 1000 - simulated), 1, 20, true);
  }
  assert.ok(Math.abs(simulated / FIXED_TICK_SECONDS - 50) < 1e-10);
  assert.equal(wall, 1000);
});

test('light worlds pace selected speed and paused worlds cannot spin', () => {
  assert.ok(Math.abs(workerWakeDelay(0, 1, 2, true) - (1000 / 60 - 2)) < 1e-12);
  assert.ok(Math.abs(workerWakeDelay(0, 5, 1, true) - (1000 / 300 - 1)) < 1e-12);
  assert.equal(workerWakeDelay(2, 5, 100, false), 16);
  assert.equal(workerWakeDelay(2, 0, 100, true), 16);
});

test('MAX yields immediately without a multiplier ceiling while x0 still idles', () => {
  assert.equal(workerWakeDelay(0, 'max', 0, true), 0);
  assert.equal(workerWakeDelay(0, 'max', 100, true), 0);
  assert.equal(workerWakeDelay(0, 'max', 0, false), 16);
});
