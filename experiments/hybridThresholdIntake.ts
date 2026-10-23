/** #89 offline follow-up. Same #87 body/environment/mutations/score/gates. */
import {foodNetwork} from './neuralFood';import {validateGenome} from '../persistence';
import {intakeSource,intakeMutation,intakeMetrics,INTAKE_OPTIONS,INTAKE_TRAINING,INTAKE_HELD_OUT,chooseIntakeElite,mutationSeed,GATES,parameterCount} from './nutrientIntake';
export {intakeSource,intakeMutation,intakeMetrics,INTAKE_TRAINING,INTAKE_HELD_OUT,chooseIntakeElite,mutationSeed,GATES,parameterCount};
export const HYBRID_SEEDS=[17,71,1901,4099,8191] as const;
export const HYBRID_BUDGET={generations:15,offspring:15,seconds:12,neuralEvents:8,sigma:.15};
export const HYBRID_OPTIONS={...INTAKE_OPTIONS,traceModes:true};
export function revisedHybridNetwork(seed:number){const g=foodNetwork('two-output',seed);g.motorController={version:'neural-motor-v2',architecture:'two-output',hysteresisWidth:.06};return validateGenome(g);}
