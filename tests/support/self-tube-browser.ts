import {createSnapshot, restoreSnapshot} from '../../persistence';
import {stepSimulation} from '../../simulation';

/** Test-only replay in the browser's own math runtime; never imported by the app. */
export function replaySelfTubeSnapshot(source: unknown, ticks: number) {
  const exact = restoreSnapshot(source);
  for (let tick = 0; tick < ticks; tick++) stepSimulation(exact.state, exact.settings, 1 / 60);
  return createSnapshot(exact.state, exact.settings).state;
}
