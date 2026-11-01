/** Controlled feeding/biting scene for transport and renderer acceptance checks. */
import {mouthContactFixture} from '../../mouthContactAudit';
import {spawnOrganism, remapBrain, calculateBodyCost, calculateMaxEnergyCapacity, XoshiroPRNG} from '../../simulation';
export function energyActivityFixture() {
  const {state, config, hunter, prey} = mouthContactFixture('capsule-v1', 'head-on');
  config.worldWidth = 2400; config.worldHeight = 1500;
  const g = prey.genome;
  g.mouths = [{id: 'grazer', partIndex: 0, direction: 'EAST', slot: 0, intakeWidth: 7, mouthType: 'herbivore'}];
  g.bodyCost = calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier); remapBrain(g);
  Object.assign(prey, spawnOrganism(g, prey.segments[0].x, prey.segments[0].y, 0,
    undefined, 10000, new XoshiroPRNG(12)), {id: prey.id});
  state.nutrients.push({id: 'meal', x: 1230, y: 750, vx: 0, vy: 0,
    energyValue: 3000, radius: 18, kind: 'nutrient', bottomTimer: 0, pulseTimer: 0});
  state.ledger.externalInflow += 3000;
  return {state, config, hunter, prey};
}
