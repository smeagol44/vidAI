/** #98 original #93 two-output genetics/habitat; isolated physics and intake-only choice. */
import {plasticNetwork,plasticMutation,plasticCoverage,withoutLifetimePlasticity,PLASTIC_SEEDS,PLASTIC_BUDGET,PLASTIC_OPTIONS,LEARNING_FIELDS,intakeSource,intakeMetrics,mutationSeed,INTAKE_TRAINING,INTAKE_HELD_OUT} from './architecturePlasticity';
import type {Genome} from '../simulation';
export {plasticNetwork,plasticMutation,plasticCoverage,withoutLifetimePlasticity,PLASTIC_SEEDS,PLASTIC_BUDGET,LEARNING_FIELDS,mutationSeed,INTAKE_TRAINING,INTAKE_HELD_OUT};
export const OPTIONS={...PLASTIC_OPTIONS,traceUncapped:true};
export function source(g:Genome,c=INTAKE_TRAINING){const s=intakeSource(g,c);s.schemaVersion='98.0.0';s.settings.experimentalVelocityMode='uncapped-plasticity-v1';return s;}
export function metrics(p:any,seconds=12){
 const check=(v:unknown):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw Error('Nonfinite study result');if(v&&typeof v==='object')for(const x of Object.values(v))check(x);};check(p);
 const m=intakeMetrics(p,seconds);if(!p.uncappedAudit||!p.learningAudit||p.metrics.ticks!==Math.round(seconds*60)||!p.metrics.finite||m.absorbedJ<0||m.food.grossFoodJ<0||m.absorbedJ>m.food.grossFoodJ)throw Error('Corrupt/incomplete physical food receipt');
 return{...m,valid:true,reasons:[],formerValid:m.valid,formerReasons:m.reasons,modeAudit:p.modeAudit,learningAudit:p.learningAudit,uncapped:{stages:p.uncappedAudit.stages,guardLossJ:p.uncappedAudit.guardLossJ},torqueAudit:p.torqueAudit};
}
export function select<T extends {absorbedJ:number}>(parent:T,rows:T[]){let best=parent,index=-1;if(!Number.isFinite(best.absorbedJ)||best.absorbedJ<0)throw Error('Corrupt incumbent intake');rows.forEach((r,i)=>{if(!Number.isFinite(r.absorbedJ)||r.absorbedJ<0)throw Error('Corrupt offspring intake');if(r.absorbedJ>best.absorbedJ){best=r;index=i;}});return{best,index};}

