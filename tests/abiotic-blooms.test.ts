import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createInitialWorld} from '../world';
import {createSnapshot, restoreSnapshot, DEFAULT_SETTINGS, totalAccountedEnergy} from '../persistence';
import {EcologyIntakeObserver, readEcologyState} from '../ecologyAudit';
import {runFeaturedFoodDistributionPair} from '../ecologyBaseline';

const settings = {...DEFAULT_SETTINGS, worldWidth: 2400, worldHeight: 1500,
  targetNutrients: 400, inflowRate: 0, mutationSeverity: 0};
const close = (a: number, b: number) => assert.ok(Math.abs(a-b) < 1e-5, `${a} != ${b}`);

test('blooms concentrate some naturally seeded nutrients without granting extra food or reserving any for creatures', () => {
  for (const seed of [17, 29]) {
    const uniform = createInitialWorld({...settings, nutrientPattern: 'uniform'}, seed, 'balanced', 'standard', 0);
    const blooms = createInitialWorld({...settings, nutrientPattern: 'blooms'}, seed, 'balanced', 'standard', 0);
    assert.equal(uniform.nutrients.length, 400);
    assert.equal(blooms.nutrients.length, 400);
    const centers = sim.nutrientBloomCenters(blooms, settings);
    const before = blooms.prng.getState();
    assert.deepEqual(sim.nutrientBloomCenters(blooms, settings), centers);
    assert.deepEqual(blooms.prng.getState(), before, 'bloom sites cannot consume world randomness');
    const hits = (s: sim.SimulationState) => s.nutrients.filter(n =>
      centers.some(c => Math.abs(n.x - c.x) <= 170 && Math.abs(n.y - c.y) <= 170)).length;
    assert.ok(hits(blooms) > hits(uniform) + 50,
      `seed ${seed}: expected genuine spatial aggregation, got ${hits(blooms)} vs ${hits(uniform)}`);
    assert.deepEqual(uniform.ledger.externalInflow, blooms.ledger.externalInflow);
    close(totalAccountedEnergy(blooms), blooms.ledger.externalInflow);
    close(totalAccountedEnergy(uniform), uniform.ledger.externalInflow);
  }
});

test('uniform legacy snapshots keep old PRNG placement; bloom snapshots continue exactly across imports', () => {
  for (const pattern of ['uniform', 'blooms'] as const) {
    const config = {...settings, nutrientPattern: pattern};
    const world = createInitialWorld({...config, targetNutrients: 0}, 71, 'balanced', 'standard', 0);
    sim.addNutrients(world, config, 35);
    const raw = createSnapshot(world, config);
    if (pattern === 'uniform') delete (raw.settings as {nutrientPattern?: string}).nutrientPattern;
    const restored = restoreSnapshot(raw);
    assert.equal(restored.settings.nutrientPattern, pattern);
    sim.addNutrients(world, config, 12);
    sim.addNutrients(restored.state, restored.settings, 12);
    assert.deepEqual(restored.state.nutrients, world.nutrients);
    assert.deepEqual(restored.state.prng.getState(), world.prng.getState());
    close(totalAccountedEnergy(restored.state), restored.state.ledger.externalInflow);
  }
});

test('manual Feed placement always overrides bloom mode and consumes the same finite energy', () => {
  const make = () => createInitialWorld({...settings, targetNutrients: 0}, 83, 'balanced', 'standard', 0);
  const first = make(), second = make();
  const patch = {x: 900, y: 800, spread: 60};
  assert.equal(sim.addNutrients(first, {...settings, nutrientPattern: 'blooms'}, 8, patch), 8);
  assert.equal(sim.addNutrients(second, {...settings, nutrientPattern: 'uniform'}, 8, patch), 8);
  assert.deepEqual(first.nutrients, second.nutrients);
  close(totalAccountedEnergy(first), first.ledger.externalInflow);
  close(totalAccountedEnergy(second), second.ledger.externalInflow);
});

test('snapshot rejects unknown nutrient distributions instead of silently changing a world', () => {
  const config = {...settings, nutrientPattern: 'uniform' as const};
  const s = createInitialWorld({...config, targetNutrients: 0}, 89, 'balanced', 'standard', 0);
  const invalid = createSnapshot(s, config);
  (invalid.settings as {nutrientPattern: string}).nutrientPattern = 'magic';
  assert.throws(() => restoreSnapshot(invalid), /nutrient distribution/);
});

test('short naturally moving featured cohorts run in both food modes with real receipts and conserved energy', () => {
  for (const pattern of ['uniform', 'blooms'] as const) {
    const config = {...settings, targetNutrients: 70, nutrientPattern: pattern};
    const state = createInitialWorld(config, 17, 'balanced', 'standard', 4);
    const observer = new EcologyIntakeObserver();
    for (let tick = 0; tick < 120; tick++) {
      sim.stepSimulation(state, config, 1/60);
      observer.sample(state);
    }
    const byOrg = observer.perOrganismTotals();
    const totalAbsorbed = Object.values(byOrg).reduce((n, v) =>
      n + Object.values(v).reduce((a, b) => a + b, 0), 0);
    const gross = Object.values(observer.totals()).reduce((a, b) => a + b, 0);
    close(totalAbsorbed, gross);
    assert.equal(state.organisms.length, 4);
    assert.ok(state.organisms.every(o => o.energy >= 0 && o.segments.every(p =>
      Object.values(p).every(Number.isFinite))));
    close(readEcologyState(state).energy.discrepancyJ, 0);
    console.log('VIDA_BLOOM_SHORT ' + JSON.stringify({pattern,
      intakeJ: observer.totals(), finalReservesJ: readEcologyState(state).resources.livingReservesJ,
      eggsLaid: readEcologyState(state).population.eggLayings}));
  }
});

test('all nine featured founders get one bounded unassisted 400-food ecological comparison', () => {
  const compared = runFeaturedFoodDistributionPair(17, 2);
  const uniform = compared.uniform, blooms = compared.blooms;
  assert.equal(uniform.outcomes.length, 9);
  assert.equal(blooms.outcomes.length, 9);
  assert.deepEqual(blooms.founderStart, uniform.founderStart,
    'all founder genomes/positions must match before food is distributed');
  assert.equal(uniform.initialFoodJ, blooms.initialFoodJ);
  for (const condition of [uniform, blooms]) {
    close(condition.final.energy.discrepancyJ, 0);
    assert.equal(condition.final.population.seededOrHatchedBirths, 9);
    for (const founder of condition.outcomes) {
      assert.ok(Number.isFinite(founder.absorbedNutrientJ) && founder.absorbedNutrientJ >= 0);
      assert.ok(Number.isFinite(founder.reserveDeltaJ));
      assert.ok(Number.isInteger(founder.eggsLaid) && founder.eggsLaid >= 0);
    }
  }
  console.log('VIDA_FEATURED_400 ' + JSON.stringify({
    seed: compared.seed, seconds: compared.seconds,
    uniform: {total: uniform.totalIntakeJ,
      byFounder: uniform.outcomes.map(f => [f.founderId, Math.round(f.absorbedNutrientJ), Math.round(f.reserveDeltaJ)])},
    blooms: {total: blooms.totalIntakeJ,
      byFounder: blooms.outcomes.map(f => [f.founderId, Math.round(f.absorbedNutrientJ), Math.round(f.reserveDeltaJ)])},
  }));
});
