import {DEFAULT_SETTINGS, createSnapshot} from '../../persistence';
import {createInitialWorld} from '../../world';
import {enableClosedEconomy, setWorldEnergy} from '../../energyEconomy';
import {translateLiveOrganism} from '../../selfTubes';
export const tubeSettings = {...DEFAULT_SETTINGS, worldWidth: 1800, worldHeight: 600,
  physicsRegime: 'passive-work-v3' as const, ecologyRegime: 'closed-v1' as const,
  mouthContactModel: 'capsule-v1' as const, nutrientLimit: null,
  targetNutrients: 0, inflowRate: 0, waterViscosity: 0, mutationSeverity: 0};
export function selfTubeFixture(side: 'L' | 'R' = 'L') {
  const state = createInitialWorld(tubeSettings, 127, 'balanced', 'standard', 1);
  const org = state.organisms[0];
  for (const part of org.genome.parts) part.oscillatorMix = 0;
  for (const row of org.genome.weightsHO) row.fill(0); org.genome.biasesO.fill(0);
  translateLiveOrganism(org, (side === 'L' ? -299.9 : tubeSettings.worldWidth + 299.9) - org.segments[0].x,
    450 - org.segments[0].y);
  for (const segment of org.segments) {segment.vx = side === 'L' ? -80 : 80; segment.vy = 0; segment.angVel = 0;}
  state.nutrients = []; state.eggs = []; state.bubbles = []; state.caustics = [];
  state.selfTubes = {version: 1, connected: true, accepted: [0]};
  enableClosedEconomy(state); setWorldEnergy(state, state.energyPool!.budget + 1200000);
  return {state, settings: {...tubeSettings}, source: createSnapshot(state, tubeSettings)};
}
