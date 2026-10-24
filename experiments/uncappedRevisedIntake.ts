/** #96 exact #90 initializer/mutations/habitat, new uncapped identity/selection. */
import {revisedHybridNetwork,intakeSource,intakeMutation,intakeMetrics,HYBRID_SEEDS,HYBRID_BUDGET,HYBRID_OPTIONS,INTAKE_TRAINING,INTAKE_HELD_OUT,mutationSeed,parameterCount} from './hybridThresholdIntake';
import type {Genome} from '../simulation';
export {revisedHybridNetwork,intakeMutation,HYBRID_SEEDS,HYBRID_BUDGET,INTAKE_TRAINING,INTAKE_HELD_OUT,mutationSeed,parameterCount};
export const UNCAPPED_REVISED_OPTIONS={...HYBRID_OPTIONS,traceUncapped:true};
export function uncappedRevisedSource(g:Genome,condition=INTAKE_TRAINING){const s=intakeSource(g,condition);s.schemaVersion='96.0.0';s.settings.experimentalVelocityMode='uncapped-revised-v1';return s;}
export function uncappedRevisedMetrics(packet:any,seconds=12){
 const check=(v:unknown):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Nonfinite uncapped result');if(v&&typeof v==='object')for(const x of Object.values(v))check(x);};check(packet);
 const m=intakeMetrics(packet,seconds),u=packet.uncappedAudit;
 if(!u||packet.metrics.ticks!==Math.round(seconds*60)||!packet.metrics.finite||m.absorbedJ<0||m.food.grossFoodJ<0||m.absorbedJ>m.food.grossFoodJ)throw new Error('Corrupt/incomplete actual intake result');
 // Former validity and every tolerance flag are retained for disclosure ONLY.
 return{...m,valid:true,reasons:[],formerValid:m.valid,formerReasons:m.reasons,modeAudit:packet.modeAudit,uncapped:{stages:u.stages,guardLossJ:u.guardLossJ},torqueAudit:packet.torqueAudit};
}
/** Founder is ALWAYS the measured incumbent. Validity flags are never read. */
export function selectIntakeOnly<T extends {absorbedJ:number}>(founderOrParent:T,offspring:T[]){
 let best=founderOrParent,index=-1;
 if(!Number.isFinite(best.absorbedJ)||best.absorbedJ<0)throw new Error('Corrupt incumbent intake');
 offspring.forEach((o,i)=>{if(!Number.isFinite(o.absorbedJ)||o.absorbedJ<0)throw new Error('Corrupt offspring intake');if(o.absorbedJ>best.absorbedJ){best=o;index=i;}});
 return{best,index};
}
