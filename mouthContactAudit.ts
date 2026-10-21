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
    g.mouths = mouth ? [{id: 'test-mouth', partIndex: 0, direction: 'EAST', slot: 0, intakeWidth: 20, mouthType: 'carnivore'}] : [];
    g.bodyCost = calculateBodyCost(g.parts, [], g.mouths);
    g.maxEnergyCapacity = calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier); remapBrain(g);
    return g;
  };
  const hunter = addExternalOrganism(state, make(true), config, 1200, 750, 0)!;
  const prey = addExternalOrganism(state, make(false), config, encounter === 'far' ? 1220 : encounter === 'overlap' ? 1213.75 : 1214.5,
    encounter === 'head-on' || encounter === 'overlap' ? 750 : 764.5, 0)!;
  return {state, config, hunter, prey};
}

