import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {createSnapshot, restoreSnapshot, BUILD_VERSION, totalAccountedEnergy} from '../persistence';
import {stepSimulation, getNutrientRadius} from '../simulation';

// Compare against an immutable verified-fork checkout; never refresh scientific baselines.
const directory = process.argv[2];
if (!directory) throw new Error('Usage: check-food-submission-continuation.ts <verified-fork-checkout> [report.json]');
const load = (file: string) => import(pathToFileURL(resolve(directory, file)).href);
const [previousPersistence, previousSimulation, fixtures] = await Promise.all([
  load('persistence.ts'), load('simulation.ts'), load('tests/support/nutrient-cycle.ts'),
]);
const cases = [];
for (const cycle of [undefined, 'decay-v1', 'decay-v2'] as const) for (const tubes of [false, true]) {
  const old = fixtures.cycleFixture([fixtures.food(9300, true), fixtures.food(75, false, 1000, 500)]);
  old.settings.nutrientCycle = cycle;
  for (const food of old.state.nutrients) food.radius = getNutrientRadius(food.energyValue, cycle);
  old.state.nutrients[0].decayTimeRemaining = .1;
  if (tubes) {
    old.settings.worldHeight = 600;
    old.state.selfTubes = {version: 1, connected: true, accepted: [0]};
    old.state.nutrients[0].x = -200; old.state.nutrients[0].y = 450;
  }
  const original = previousPersistence.createSnapshot(old.state, old.settings);
  const current = restoreSnapshot(original);
  const expected = () => ({...previousPersistence.createSnapshot(old.state, old.settings), build: BUILD_VERSION});
  assert.deepEqual(createSnapshot(current.state, current.settings), expected());
  for (let tick = 0; tick < 120; tick++) {
    previousSimulation.stepSimulation(old.state, old.settings, 1 / 60);
    stepSimulation(current.state, current.settings, 1 / 60);
    assert.deepEqual(createSnapshot(current.state, current.settings), expected(), `${cycle}/${tubes}/${tick}`);
    assert.equal(totalAccountedEnergy(current.state), previousPersistence.totalAccountedEnergy(old.state));
  }
  cases.push({cycle: cycle ?? 'historical-omitted', tubes, exactTicks: 120});
}
const report = {baseline: execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  scope: 'Exact complete verified-fork snapshots through decay/mineralization in tank/tubes; only build label normalized.',
  cases, totalComparedTicks: 720, allExact: true};
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
