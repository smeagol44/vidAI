/** Usage: node --import tsx scripts/check-environment-scenarios-baseline.ts /path/to/unchanged/base */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createScenarioWorld} from '../environmentScenarios';
import {createSnapshot, totalAccountedEnergy} from '../persistence';
import {stepSimulation} from '../simulation';

assert.ok(process.argv[2], 'Provide the unchanged pre-feature checkout');
const base = resolve(process.argv[2]);
const oldWorld = await import(pathToFileURL(resolve(base, 'world.ts')).href);
const oldSave = await import(pathToFileURL(resolve(base, 'persistence.ts')).href);
const oldSim = await import(pathToFileURL(resolve(base, 'simulation.ts')).href);
const settings = {...oldSave.DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3',
  ecologyRegime: 'closed-v1', nutrientLimit: null, mouthContactModel: 'capsule-v1'};
const rows = [];
for (const seed of [17, 73]) for (const mode of ['balanced', 'unbiased'] as const)
  for (const preset of ['standard', 'showcase', 'predator_cove', 'megafauna']) {
    const prior = oldWorld.createInitialWorld(settings, seed, mode, preset);
    const current = createScenarioWorld(settings, 'default', seed, mode, preset).state;
    assert.deepEqual(createSnapshot(current, settings), oldSave.createSnapshot(prior, settings));
    const harsh = createScenarioWorld(settings, 'harsh-world', seed, mode, preset);
    const manual = oldWorld.createInitialWorld(harsh.settings, seed, mode, preset);
    oldSave.clearFreeNutrients(manual);
    assert.deepEqual(createSnapshot(harsh.state, harsh.settings), oldSave.createSnapshot(manual, harsh.settings));
    assert.equal(harsh.state.energyPool!.budget, prior.energyPool.budget);
    for (let tick = 0; tick < 30; tick++) {
      stepSimulation(current, settings, 1 / 60); oldSim.stepSimulation(prior, settings, 1 / 60);
      stepSimulation(harsh.state, harsh.settings, 1 / 60); oldSim.stepSimulation(manual, harsh.settings, 1 / 60);
      assert.deepEqual(createSnapshot(current, settings), oldSave.createSnapshot(prior, settings));
      assert.deepEqual(createSnapshot(harsh.state, harsh.settings), oldSave.createSnapshot(manual, harsh.settings));
    }
    rows.push({seed, mode, preset, exactTicksPerWorld: 30, budgetJ: prior.energyPool.budget,
      defaultEnergyErrorJ: totalAccountedEnergy(current) - current.energyPool!.budget,
      harshEnergyErrorJ: totalAccountedEnergy(harsh.state) - harsh.state.energyPool!.budget});
  }
console.log(JSON.stringify({baseline: base, comparisons: rows,
  result: 'Exact complete initialization and every continuation tick: Default vs prior; Harsh vs prior manual configuration plus Clear Free Nutrients. No fields excluded or baselines refreshed.'}, null, 2));
