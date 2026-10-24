/** #103 offline wrapper: original environment, exactly one feeding flag. */
import {source as originalSource} from './movingNutrient';
import {selectionMetrics} from './selectionMetrics';
import {restoreSnapshot,createSnapshot} from '../persistence';
import type {Genome} from '../simulation';
export {initial,RUNS,HELD,OPTIONS,mutationSeed} from './movingNutrient';
export {mutate,makeOrigin} from './parentTargeting';
export function source(g:Genome,environment={seed:73,heading:.37}){
 const {state,settings}=restoreSnapshot(originalSource(g,environment));settings.experimentalFeedingMode='proximity-90-v1';
 state.proximityFeeding={version:'proximity-90-v1',contactJ:0,proximityJ:0,samples:[],bodyTrace:[]};return createSnapshot(state,settings);
}
export function metrics(p:any){
 const finite=(v:any):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw Error('Nonfinite trial');if(v&&typeof v==='object')Object.values(v).forEach(finite);};finite(p);
 const t=p.snapshot.state.pursuit,a=p.pursuitAudit,base=selectionMetrics(p,15),food=p.foodAudit;
 if(!t||!a||p.metrics.ticks!==900||!p.metrics.finite||t.steps!==3600||t.absorbedJ<0||Math.abs(t.absorbedJ-food.absorbedJ)>1e-7||Math.abs(t.reservoirInputJ-food.grossFoodJ)>1e-8)throw Error('Corrupt pursuit food evidence');
 const a2=p.snapshot.state.proximityFeeding;if(!a2||Math.abs(a2.contactJ+a2.proximityJ-t.absorbedJ)>1e-7||a2.samples.length!==900)throw Error('Corrupt proximity receipts');
 return{physicalContactJ:a2.contactJ,proximityJ:a2.proximityJ,oralIntakeResidualJ:t.absorbedJ-food.absorbedJ,...base,valid:true,reasons:[],formerReasons:base.reasons.filter((r:string)=>r!=='population/food'),absorbedJ:t.absorbedJ,reservoirInputJ:t.reservoirInputJ,absorbedByState:t.absorbedByState,grossByState:t.grossByState,food,learning:p.learningAudit,uncapped:{stages:p.uncappedAudit.stages,guardLossJ:p.uncappedAudit.guardLossJ},modeAudit:p.modeAudit,partitionResidualJ:10000+t.absorbedJ-base.remainingJ-base.motorJ-(p.snapshot.state.ledger.metabolicDissipation-(t.reservoirInputJ-t.absorbedJ)),freeze:t.events.find((e:any)=>e.kind==='freeze')??null,targetEvents:t.events,alive:p.metrics.founders[0].alive};
}
