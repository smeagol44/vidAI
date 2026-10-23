/** Offline diagnostic specimens only. No catalogue edits, selection or new
 * force coefficients. The completed four-controller report is never rewritten. */
import {createFounderGenome} from '../founders';
import {XoshiroPRNG, type SimulationSettings} from '../simulation';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createSnapshot, DEFAULT_SETTINGS} from '../persistence';
import {makeGatedGenome} from './gatedGenome';

export const TORQUE_AUDIT_IDS = ['CUR-001','CUR-002','CUR-009'] as const;
export const TORQUE_AUDIT_CONDITIONS = [
  {seed:17,heading:.37,viscosity:.18}, {seed:71,heading:.8,viscosity:.15}, {seed:1901,heading:-1.1,viscosity:.22},
] as const;
export type AuditVariant = 'legacy-six-output' | 'legacy-fresh-head' | 'two-output/hard' | 'two-output/hysteresis'
  | 'three-output/hard' | 'three-output/hysteresis';
export const TORQUE_AUDIT_VARIANTS: AuditVariant[] = ['legacy-six-output','legacy-fresh-head',
  'two-output/hard','two-output/hysteresis','three-output/hard','three-output/hysteresis'];
export function torqueAuditSource(id: string, variant: AuditVariant, c: {seed:number;heading:number;viscosity:number}) {
  const original = createFounderGenome(id);
  let genome = original;
  if (variant === 'legacy-fresh-head') {
    genome = structuredClone(original);
    // Same latent first three rows/biases as the independent candidate. The
    // extra three use an independent matched-distribution stream, retaining
    // all six OLD meanings and existing enabled topology. This is a null
    // initialization control, not a selected or tuned starter.
    const latent = makeGatedGenome(original,'three-output',0,c.seed), extra = new XoshiroPRNG(c.seed ^ 0x5eeda11);
    for (let j=0;j<genome.parts.length-1;j++) for(let channel=0;channel<6;channel++) {
      genome.weightsHO[j*6+channel] = channel<3 ? [...latent.weightsHO[j*3+channel]]
        : genome.hiddenIds!.map(()=>extra.range(-.35,.35));
      genome.biasesO[j*6+channel] = channel<3 ? latent.biasesO[j*3+channel] : extra.range(-.5,.5);
    }
  } else if (variant !== 'legacy-six-output') {
    genome = makeGatedGenome(original,variant.startsWith('two')?'two-output':'three-output',variant.endsWith('hysteresis')?.06:0,c.seed);
  }
  const config: SimulationSettings = {...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',motorExperiment:'gated-torque-v1',
    worldWidth:4800,worldHeight:3000,targetNutrients:0,inflowRate:0,mutationSeverity:0,
    mouthContactModel:'capsule-v1',waterViscosity:c.viscosity};
  const state=createInitialWorld(config,c.seed,'balanced','standard',0);
  addExternalOrganism(state,genome,config,2400,1500,c.heading);
  return createSnapshot(state,config);
}
