/** Offline controlled contact fixture; never imported into the simulation/UI. */
import {createFounderGenome} from './founders';
import {createInitialWorld, addExternalOrganism} from './world';
import {DEFAULT_SETTINGS} from './persistence';
import {remapBrain, calculateBodyCost, calculateMaxEnergyCapacity, type SimulationSettings} from './simulation';

export function mouthContactFixture(model?: 'capsule-v1', encounter = 'endpoint') {
  const config: SimulationSettings = {...DEFAULT_SETTINGS, mouthContactModel: model,
    targetNutrients: 0, inflowRate: 0, waterViscosity: 0, gravity: 0, mutationSeverity: 0, kinshipProtection: false};
  const state = createInitialWorld(config, 711, 'balanced', 'standard', 0);
  const make = (mouth: boolean) => {
    const g = createFounderGenome('FND-001');
    g.parts = g.parts.slice(0, 1); g.eyes = []; g.motorForce = 0;
    Object.assign(g.parts[0], {dimN: mouth ? 3 : 1, dimM: mouth ? 3 : 1, width: mouth ? 21 : 7, height: mouth ? 21 : 7});
    g.mouths = mouth ? [{id: 'test-mouth', partIndex: 0, direction: 'EAST', slot: 0, intakeWidth: 9, intakeLength: 20, mouthType: 'carnivore'}] : [];
    g.bodyCost = calculateBodyCost(g.parts, [], g.mouths);
    g.maxEnergyCapacity = calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier); remapBrain(g);
    return g;
  };
  const hunter = addExternalOrganism(state, make(true), config, 1200, 750, 0)!;
  // Keep the endpoint case just outside the legacy aperture while within
  // the forward capsule's reach and vertical radius. The old model must miss;
  // capsule-v1 must make physical contact with the prey rectangle.
  const placement = encounter === 'endpoint' ? {x: 1234.5, y: 756}
    : encounter === 'head-on' ? {x: 1214.5, y: 750}
    : encounter === 'overlap' ? {x: 1213.75, y: 750}
    : {x: 1245, y: 765};
  const prey = addExternalOrganism(state, make(false), config, placement.x, placement.y, 0)!;
  return {state, config, hunter, prey};
}

