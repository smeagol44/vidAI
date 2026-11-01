/** Bounded pre-change comparison. Usage: node --import tsx scripts/check-egg-reserve-baseline.ts /path/to/base */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {stepSimulation} from '../simulation';
import type {PhysicsRegime} from '../foundationPhysics';
import {addExternalOrganism} from '../world';
import {createFounderGenome} from '../founders';
import {setWorldEnergy, embodiedEnergy} from '../energyEconomy';
import {eggReserveFixture} from '../tests/support/egg-reserve';

assert.ok(process.argv[2], 'Provide an unchanged baseline checkout');
const base = resolve(process.argv[2]);
const oldSim = await import(pathToFileURL(resolve(base, 'simulation.ts')).href);
const oldSave = await import(pathToFileURL(resolve(base, 'persistence.ts')).href);
function withoutDisplay(snapshot: ReturnType<typeof createSnapshot>) {
  const result = structuredClone(snapshot);
  // Releases have distinct display identities. Compare all simulation fields
  // exactly while normalizing only this non-simulation envelope label.
  result.build = oldSave.BUILD_VERSION;
  for (const egg of result.state.eggs) {
    delete (egg as any).initialFundedReserve; delete (egg as any).initialReserveIsLegacy;
  }
  return result;
}
const rows = [];
for (const physicsRegime of ['legacy-v0', 'surface-work-v1', 'paid-work-v2', 'passive-work-v3'] as PhysicsRegime[])
  for (const closed of [false, true]) {
    const {state, config} = eggReserveFixture(closed); config.physicsRegime = physicsRegime;
    if (closed) setWorldEnergy(state, state.energyPool!.budget + 100000);
    const parent = addExternalOrganism(state, createFounderGenome('CUR-001'), {...config, ecologyRegime: undefined}, 500, 650, 0)!;
    state.simTime = 100; parent.age = 50; parent.energy = parent.genome.maxEnergyCapacity;
    // One clear hatch, one depleted damaged egg, one ordinary expiry (closed).
    state.eggs[0].incubationProgress = 1; state.eggs[0].hatchHeading = 0;
    state.eggs[0].fundedReserve = state.eggs[0].hatchReserveTarget ?? 1000;
    state.eggs[4].fundedStructural /= 2;
    if (closed) {
      state.eggs[3].ageSeconds = 299.99;
      state.energyPool!.reserve = 10000; state.energyPool!.budget = embodiedEnergy(state) + 10000;
    }
    const source = withoutDisplay(createSnapshot(state, config));
    const current = restoreSnapshot(source).state, prior = oldSave.restoreSnapshot(source).state;
    const energy = totalAccountedEnergy(current);
    let sawHatch = false, sawLay = false, sawExpiry = false;
    for (let i = 0; i < 120; i++) {
      stepSimulation(current, config, 1 / 60); oldSim.stepSimulation(prior, config, 1 / 60);
      assert.deepEqual(withoutDisplay(createSnapshot(current, config)),
        withoutDisplay(oldSave.createSnapshot(prior, config)), `${physicsRegime}/${closed}/tick ${i}`);
      sawHatch ||= current.organisms.length > 1;
      sawLay ||= current.eggs.some(e => e.id.startsWith('EGG-'));
      sawExpiry ||= current.nutrients.some(n => n.kind === 'carrion');
    }
    assert.ok(sawHatch && sawLay); if (closed) assert.ok(sawExpiry);
    assert.ok(Math.abs(totalAccountedEnergy(current) - energy) < 1e-5);
    rows.push({physicsRegime, closed, exactTicks: 120, sawHatch, sawLay, sawExpiry,
      energyErrorJ: totalAccountedEnergy(current) - energy});
  }
console.log(JSON.stringify({baseline: base, comparisons: rows,
  result: 'Exact complete simulation snapshots at every tick after removing the two display metadata fields and normalizing the release build label; no baseline refresh.'}, null, 2));
