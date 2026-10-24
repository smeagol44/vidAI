/** #94 offline protocol; original #88 mutation/init/fixture are reused unchanged. */
import {intakeSource,intakeMetrics,INTAKE_OPTIONS,INTAKE_BUDGET,INTAKE_TRAINING,INTAKE_HELD_OUT,intakeNetwork,intakeMutation,mutationSeed,parameterCount} from './nutrientIntake';
import type {Genome} from '../simulation';
export {INTAKE_BUDGET,INTAKE_TRAINING,INTAKE_HELD_OUT,intakeNetwork,intakeMutation,mutationSeed,parameterCount};
export const UNCAPPED_OPTIONS={...INTAKE_OPTIONS,traceUncapped:true};
export function uncappedSource(g:Genome,c=INTAKE_TRAINING){
 const s=intakeSource(g,c);s.schemaVersion='94.0.0';s.settings.experimentalVelocityMode='uncapped-hybrid-v1';return s;
}
export function uncappedMetrics(r:any,seconds=12){
 const finite=(v:unknown):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Nonfinite uncapped receipt');if(v&&typeof v==='object')for(const x of Object.values(v))finite(x);};finite(r);
 const m=intakeMetrics(r,seconds),u=r.uncappedAudit;
 if(!u||!r.metrics.finite||!Number.isFinite(m.absorbedJ)||m.absorbedJ<0||!Number.isFinite(m.food.grossFoodJ)||m.food.grossFoodJ<0||r.metrics.ticks!==Math.round(seconds*60))throw new Error('Nonfinite, corrupt or incomplete uncapped evaluation');
 // Old validity is deliberately NOT consumed. Every former threshold is a
 // diagnostic only. No penalty, fallback score or feasibility-first selection.
 return{...m,valid:true,reasons:[],formerGateReasons:m.reasons,
  uncapped:{maxLinearSpeed:u.maxLinearSpeed,maxAngularSpeed:u.maxAngularSpeed,linearExceedances:u.linearExceedances,angularExceedances:u.angularExceedances,guardLossJ:u.guardLossJ},
  torqueAudit:r.torqueAudit};
}
export function chooseUncappedElite<T extends {absorbedJ:number}>(parent:T,offspring:T[]){
 let best=parent,index=-1;
 if(!Number.isFinite(best.absorbedJ)||best.absorbedJ<0)throw new Error('Corrupt parent intake');
 offspring.forEach((o,i)=>{if(!Number.isFinite(o.absorbedJ)||o.absorbedJ<0)throw new Error('Corrupt offspring intake');if(o.absorbedJ>best.absorbedJ){best=o;index=i;}});
 return{best,index};
}
