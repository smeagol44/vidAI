import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {readEcologyState, EcologyIntakeObserver} from '../ecologyAudit';
import {ECOLOGY_SEEDS, runUnassistedEcologyPair, runControlledGrazing,
  runAdultEggAllocation, runStarvationCohort} from '../ecologyBaseline';

const close = (a: number, b: number, tolerance = 1e-5) =>
  assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`);
function conserved(result: {final: ReturnType<typeof readEcologyState>}) {
  close(result.final.energy.discrepancyJ, 0, 1e-4);
}

test('read-only census and feeding receipt accumulator never change the world or double-count coalesced events', () => {
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
  const state = createInitialWorld(settings, 17, 'unbiased', 'standard', 0);
  const g = createFounderGenome('FND-001', 'unbiased');
  g.motorForce = 0;
  const org = addExternalOrganism(state, g, settings, 1200, 750, 0)!;
  const foodX = 1200 + sim.getOrganAnchor(g.mouths[0],g.parts[0].width,g.parts[0].height).x;
  state.nutrients.push({id:'food', x:foodX,y:750,vx:0,vy:0,
    energyValue:3000,radius:18,bottomTimer:0,kind:'nutrient'});
  state.ledger.externalInflow += 3000;
  const before = createSnapshot(state, settings);
  const census = readEcologyState(state);
  assert.equal(census.population.alive, 1);
  assert.equal(census.population.completedDeaths, 0);
  assert.equal(census.resources.freeFoodJ, 3000);
  close(census.energy.discrepancyJ, 0);
  assert.deepEqual(createSnapshot(state, settings), before, 'sampling must not consume randomness or alter snapshots');

  const observer = new EcologyIntakeObserver();
  for (let i=0;i<15;i++) {
    sim.stepSimulation(state, settings, 1/60);
    observer.sample(state);
  }
  const removed = 3000 - state.nutrients.reduce((sum,n)=>sum+n.energyValue,0);
  close(observer.totals().Nutrient, removed * sim.MOUTH_ASSIMILATION);
  assert.equal(observer.totals().Carrion, 0);
  assert.equal(observer.totals().Prey, 0);
  assert.equal(observer.totals().Egg, 0);
  assert.throws(()=>observer.sample(state), /at most once/);
  close(totalAccountedEnergy(state), state.ledger.externalInflow);
  const snap = createSnapshot(state, settings), restored = restoreSnapshot(snap);
  assert.deepEqual(createSnapshot(restored.state, settings), snap);
});

test('unassisted founder ecologies and food-removed counterfactuals have measured rather than invented outcomes', () => {
  const rows = ECOLOGY_SEEDS.map(runUnassistedEcologyPair);
  for (const {withFood, withoutFood} of rows) {
    conserved(withFood); conserved(withoutFood);
    assert.equal(withFood.initialBirths, 4);
    assert.equal(withoutFood.initialBirths, 4);
    assert.equal(withoutFood.final.resources.freeFoodJ, 0);
    assert.equal(withoutFood.absorbedJ.Nutrient, 0);
    assert.ok(withFood.final.population.alive >= 0 && withFood.final.population.alive <= 4);
    assert.equal(withFood.final.population.seededOrHatchedBirths - withFood.initialBirths, 0,
      '3 seconds of starting juveniles is NOT multigeneration selection');
    assert.equal(withFood.final.population.eggLayings, 0);
  }
  console.log('VIDA_BD_UNASSISTED ' + JSON.stringify(rows.map(({seed, withFood, withoutFood}) => ({
    seed, alive:withFood.final.population.alive,
    deaths:withFood.final.population.completedDeaths,
    absorbedFoodJ:withFood.absorbedJ.Nutrient, blindFoodlessAbsorbedJ:withoutFood.absorbedJ.Nutrient,
    endReserveWithFoodJ:withFood.final.resources.livingReservesJ,
    endReserveNoFoodJ:withoutFood.final.resources.livingReservesJ
  }))));
});

test('historical legacy paired off-axis swimming measures genuine nutrient absorption rather than retinal visibility alone', () => {
  const rows = [];
  let visuallyBetter = 0, successfulSighted = 0;
  for (const seed of ECOLOGY_SEEDS.slice(0,2)) for (const side of [-1,1] as const)
    for (const distance of [135,160] as const) {
      const seen = runControlledGrazing(seed, side, distance, true, 'legacy-v0');
      const blind = runControlledGrazing(seed, side, distance, false, 'legacy-v0');
      conserved(seen); conserved(blind);
      if (seen.absorbedJ.Nutrient > blind.absorbedJ.Nutrient + 1) visuallyBetter++;
      if (seen.absorbedJ.Nutrient > 0) successfulSighted++;
      for (const result of [seen, blind]) {
        close(result.absorbedJ.Nutrient, (3000-result.remainingNutrientJ)*sim.MOUTH_ASSIMILATION, 1);
        assert.equal(result.final.population.eggLayings,0);
      }
      rows.push({seed,side,distance,seenJ:seen.absorbedJ.Nutrient,blindJ:blind.absorbedJ.Nutrient});
    }
  assert.ok(visuallyBetter >= 4 && successfulSighted >= 4,
    'retinally wired swimmers must outperform disabled controls in some actual feeding outcomes');
  console.log('VIDA_BD_GRAZING ' + JSON.stringify({visuallyBetter,successfulSighted,pairs:rows}));
});

test('pre-funded mature cohorts lay genuinely paid eggs, unlike matched below-threshold cohorts', () => {
  const rows = ECOLOGY_SEEDS.map(seed => {
    const funded = runAdultEggAllocation(seed, true);
    const insufficient = runAdultEggAllocation(seed, false);
    conserved(funded); conserved(insufficient);
    assert.equal(funded.final.population.eggLayings, 1);
    assert.equal(funded.final.population.eggs, 1);
    assert.equal(funded.parentOffspringCount, 1);
    assert.equal(insufficient.final.population.eggLayings, 0);
    assert.equal(insufficient.final.population.eggs, 0);
    assert.equal(funded.eggDetails.length, 1);
    const egg = funded.eggDetails[0];
    close(egg.fundedStructuralJ, egg.actualChildStructuralCostJ);
    close(egg.fundedReserveJ, 3500);
    assert.equal(egg.generation, 2);
    assert.ok(funded.parentalEnergyJ > 0);
    assert.equal(funded.final.population.seededOrHatchedBirths-funded.initialBirths, 0,
      'funded egg is NOT already a hatched child');
    return {seed,eggsFunded:funded.final.population.eggs,
      reserveJ:egg.fundedReserveJ, structuralJ:egg.fundedStructuralJ, parentReserveJ:funded.parentalEnergyJ};
  });
  console.log('VIDA_BD_EGGS ' + JSON.stringify(rows));
});

test('low-initial-reserve cohorts actually starve, dissolve, and conserve carrion across seeds', () => {
  const rows = ECOLOGY_SEEDS.map(seed => {
    const result = runStarvationCohort(seed);
    conserved(result);
    assert.equal(result.final.population.alive,0);
    assert.equal(result.final.population.completedDeaths,1);
    assert.equal(result.final.population.deathCauses.Starvation,1);
    assert.ok(result.final.resources.carrionJ > 0);
    assert.equal(result.absorbedJ.Nutrient,0);
    return {seed,dead:result.final.population.completedDeaths,
      cause:'Starvation',carrionJ:result.final.resources.carrionJ};
  });
  console.log('VIDA_BD_MORTALITY ' + JSON.stringify(rows));
});
