import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {addExternalOrganism, createInitialWorld} from '../world';
import {createSnapshot, DEFAULT_SETTINGS, totalAccountedEnergy} from '../persistence';
import {FoodAcquisitionObserver, nearestEdibleFreeFoodGap} from '../foodAcquisitionAudit';
import {runFeaturedAcquisitionSurvey} from '../ecologyBaseline';

const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
function atMouth(org: sim.Organism) {
  const mouth = org.genome.mouths[0];
  const phys = org.segments[mouth.partIndex], def = org.genome.parts[mouth.partIndex];
  const anchor = sim.getOrganAnchor(mouth, def.width, def.height);
  return {x: phys.x + Math.cos(phys.angle) * anchor.x - Math.sin(phys.angle) * anchor.y,
    y: phys.y + Math.sin(phys.angle) * anchor.x + Math.cos(phys.angle) * anchor.y};
}
function food(x: number, y: number, kind: 'nutrient'|'carrion'='nutrient'): sim.Nutrient {
  return {id: 'finite-food', kind, x,y,vx:0,vy:0, energyValue: 3000,
    radius: sim.getNutrientRadius(3000), bottomTimer: 0, pulseTimer: 0,
    ...(kind==='carrion' ? {decayTimeRemaining: sim.CARRION_DECAY_SECONDS}: {})};
}

test('the foraging census distinguishes edible geometry, optical sight and real intake without world mutation', () => {
  const state = createInitialWorld(settings, 17, 'balanced', 'standard', 0);
  const g = createFounderGenome('CUR-001');
  g.motorForce = 0;
  const org = addExternalOrganism(state, g, settings, 1200,750,0)!;
  const p = atMouth(org);
  state.nutrients.push(food(p.x,p.y));
  state.ledger.externalInflow += 3000;
  const monitor = new FoodAcquisitionObserver(state);
  const before = createSnapshot(state, settings);
  assert.ok(nearestEdibleFreeFoodGap(org,state)! <= 0);
  assert.deepEqual(createSnapshot(state,settings),before,
    'observer construction must not mutate PRNG, organism or food');
  sim.stepSimulation(state,settings,1/60);
  const stepState = createSnapshot(state, settings);
  monitor.sample(state);
  const found = monitor.results(state);
  assert.deepEqual(createSnapshot(state,settings),stepState,
    'sampling and reporting must not mutate the world');
  assert.equal(found.length,1);
  assert.equal(found[0].founderId,'CUR-001');
  assert.equal(found[0].ticks,1);
  assert.equal(found[0].nearbyFoodTicks,1);
  assert.equal(found[0].overlappingFoodTicks,1);
  assert.equal(found[0].mouthContactTicks,1);
  assert.equal(found[0].feedingTicks,1);
  assert.ok(found[0].absorbedJ.Nutrient > 0);
  assert.ok(found[0].energyShortfallForOneEggJ! >= 0);
  assert.throws(() => monitor.sample(state), /once per forward tick/);
  assert.ok(Math.abs(totalAccountedEnergy(state)-state.ledger.externalInflow)<1e-5);
});

test('a carnivore can see plant-colored food but cannot ingest it or treat it as edible', () => {
  const state = createInitialWorld(settings,29,'balanced','standard',0);
  const g = createFounderGenome('CUR-009'); g.motorForce = 0;
  const org = addExternalOrganism(state,g,settings,1200,750,0)!;
  const p=atMouth(org);
  state.nutrients.push(food(p.x,p.y));
  state.ledger.externalInflow += 3000;
  const monitor=new FoodAcquisitionObserver(state);
  assert.equal(nearestEdibleFreeFoodGap(org,state),null,
    'plant food is biologically excluded from carnivore proximity');
  sim.stepSimulation(state,settings,1/60);
  monitor.sample(state);
  const result=monitor.results(state)[0];
  assert.equal(result.nearbyFoodTicks,0);
  assert.equal(result.overlappingFoodTicks,0);
  assert.equal(result.feedingTicks,0);
  assert.equal(result.absorbedJ.Nutrient,0);
  assert.ok(Math.abs(totalAccountedEnergy(state)-state.ledger.externalInflow)<1e-5);
});

test('nine featured free swimmers reveal physical foraging stages under natural 400-food conditions', () => {
  const report=runFeaturedAcquisitionSurvey(17,2);
  assert.equal(report.founders.length,9);
  assert.equal(new Set(report.founders.map(f=>f.founderId)).size,9);
  assert.equal(report.final.population.seededOrHatchedBirths,9);
  assert.equal(report.final.population.eggLayings,0,
    'two juvenile seconds cannot demonstrate natural breeding');
  assert.ok(Math.abs(report.final.energy.discrepancyJ) < 1e-4);
  assert.ok(report.founders.every(f=>f.ticks===120 && f.pathLengthPx>=0
    && Number.isFinite(f.netDisplacementPx)
    && f.edibleVisibleTicks<=f.edibleRayHitTicks
    && f.feedingTicks<=f.mouthContactTicks
    && f.mouthContactTicks<=f.ticks));
  assert.ok(report.founders.some(f=>f.absorbedJ.Nutrient>0),
    'seed-17 control must still have genuine free-roaming ingestion');
  console.log('VIDA_CUR_ACQUISITION ' + JSON.stringify(report.founders.map(f=>({
    id:f.founderId, diet:f.diet, seen:f.edibleVisibleTicks,
    rayHits:f.edibleRayHitTicks, nearby:f.nearbyFoodTicks,
    overlap:f.overlappingFoodTicks, oralContact:f.mouthContactTicks,
    fed:f.feedingTicks, intakeJ:Math.round(f.absorbedJ.Nutrient+f.absorbedJ.Carrion+f.absorbedJ.Prey+f.absorbedJ.Egg),
    netMovementPx:Math.round(f.netDisplacementPx),
    reserveDeltaJ:Math.round(f.finalReserveJ-f.initialReserveJ),
    eggShortfallJ:Math.round(f.energyShortfallForOneEggJ??0),
  }))));
});
