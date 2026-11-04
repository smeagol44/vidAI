import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createInitialWorld} from '../world';
import {BUILD_VERSION, DEFAULT_SETTINGS, createSnapshot, totalAccountedEnergy} from '../persistence';
import {stepSimulation, type SimulationSettings} from '../simulation';

// Supply a clean checkout of the recorded canonical base; no baseline refresh.
const baselineDirectory = process.argv[2];
if (!baselineDirectory) throw new Error('Usage: node --import tsx scripts/check-side-windows-baseline.ts <canonical-base-checkout> [report.json]');
const baseline = async (file: string) => import(pathToFileURL(resolve(baselineDirectory, file)).href);
const [oldWorld, oldPersistence, oldSimulation] = await Promise.all([
  baseline('world.ts'), baseline('persistence.ts'), baseline('simulation.ts'),
]);
const previousSnapshot = (state: unknown, settings: SimulationSettings) => {
  const snapshot = oldPersistence.createSnapshot(state, settings);
  // The release label changes independently of every simulation state field.
  snapshot.build = BUILD_VERSION;
  return snapshot;
};
const cases: object[] = [];
for (const physicsRegime of ['legacy-v0', 'surface-work-v1', 'paid-work-v2', 'passive-work-v3'] as const) {
  for (const closed of [false, true]) for (const capsule of [false, true]) {
    const settings: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime,
      ecologyRegime: closed ? 'closed-v1' : undefined, nutrientLimit: null,
      mouthContactModel: capsule ? 'capsule-v1' : undefined,
      worldWidth: 1000, worldHeight: 800, targetNutrients: 20, inflowRate: 2};
    const current = createInitialWorld(settings, 73, 'balanced', 'standard', 3);
    const previous = oldWorld.createInitialWorld(settings, 73, 'balanced', 'standard', 3);
    assert.deepEqual(createSnapshot(current, settings), previousSnapshot(previous, settings));
    let maxStockDifference = 0;
    for (let tick = 0; tick < 60; tick++) {
      stepSimulation(current, settings, 1 / 60);
      oldSimulation.stepSimulation(previous, settings, 1 / 60);
      assert.deepEqual(createSnapshot(current, settings), previousSnapshot(previous, settings),
        `${physicsRegime}, closed=${closed}, capsule=${capsule}, tick=${tick + 1}`);
      maxStockDifference = Math.max(maxStockDifference,
        Math.abs(totalAccountedEnergy(current) - oldPersistence.totalAccountedEnergy(previous)));
    }
    cases.push({physicsRegime, closed, capsule, ticks: 60, exactCompleteSnapshots: true, maxStockDifference});
  }
}
const report = {canonicalBase: execFileSync('git', ['-C', baselineDirectory, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), seed: 73,
  scope: 'No topology; all simulation snapshot fields exact at initialization and each tick; only the release build label is normalized.',
  cases, totalComparedTicks: 960, allExact: true};
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
