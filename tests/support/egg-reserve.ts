import {DEFAULT_SETTINGS} from '../../persistence';
import {createInitialWorld} from '../../world';
import {createFounderGenome} from '../../founders';
import {enableClosedEconomy} from '../../energyEconomy';
import type {Egg, SimulationSettings} from '../../simulation';

/** Static observer scene with real finite stocks and the ordinary egg lifecycle. */
export function eggReserveFixture(closed = false) {
  const config: SimulationSettings = {...DEFAULT_SETTINGS, worldWidth: 1000, worldHeight: 800,
    physicsRegime: 'passive-work-v3', mouthContactModel: 'capsule-v1',
    targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
  const state = createInitialWorld(config, 116, 'balanced', 'standard', 0);
  state.bubbles = []; state.caustics = [];
  state.eggs = [1000, 750, 500, 250, 0].map((fundedReserve, i): Egg => {
    const genome = createFounderGenome('CUR-001');
    return {id: `reserve-${i}`, clutchId: 'reserve', parentOrgId: 'absent-parent',
      genome, x: 220 + i * 140, y: 400, vx: 0, vy: 0,
      fundedStructural: genome.bodyCost, fundedReserve, initialFundedReserve: 1000,
      incubationProgress: .25, totalIncubationTime: 100, pulseTimer: 0,
      colorHue: 120, readyToHatch: false};
  });
  state.ledger.externalInflow = state.eggs.reduce((v, e) => v + e.fundedReserve + e.fundedStructural, 0);
  if (closed) {
    enableClosedEconomy(state);
    for (const egg of state.eggs) egg.hatchReserveTarget = 1100;
    config.ecologyRegime = 'closed-v1'; config.nutrientLimit = 0;
  }
  return {state, config};
}
