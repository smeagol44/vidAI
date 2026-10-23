/** #87 OFFLINE artificial selection. Never imported into the live ecosystem. */
import {initialNetwork,mutateNetwork,mutationSeed,parameterCount,GATES} from './neuralSelection';
import {foodNetwork} from './neuralFood';
import {selectionMetrics} from './selectionMetrics';
import {addNutrients,type Genome,type SimulationSettings} from '../simulation';
import {DEFAULT_SETTINGS,createSnapshot} from '../persistence';
import {createInitialWorld,addExternalOrganism} from '../world';
export {mutationSeed,parameterCount,GATES};
export const INTAKE_ARCHITECTURES=['legacy','neural-hybrid'] as const;
export type IntakeArchitecture=typeof INTAKE_ARCHITECTURES[number];
export const INTAKE_BUDGET={generations:15,offspring:15,seconds:12,brainSeed:17,neuralEvents:8,sigma:.15};
export const INTAKE_TRAINING={seed:73,heading:.37};
export const INTAKE_HELD_OUT=[{seed:811,heading:-.7},{seed:977,heading:2.3},{seed:2301,heading:Math.PI/2}] as const;
export const INTAKE_OPTIONS={auditTorque:true,traceJoints:true,traceFood:true,nonlethalEvaluation:'nutrient-intake-v1'};
export function intakeNetwork(a:IntakeArchitecture,seed=INTAKE_BUDGET.brainSeed){return a==='legacy'?initialNetwork('legacy',seed):foodNetwork('two-output',seed);}
export function intakeMutation(g:Genome,seed:number,index:number){return mutateNetwork(g,'signed',seed,index);}
export function intakeSource(g:Genome,c:{seed:number;heading:number}=INTAKE_TRAINING){
 const settings:SimulationSettings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',motorExperiment:g.motorController?'neural-motor-v1':'gated-torque-v1',
  mouthContactModel:'capsule-v1',worldWidth:1000,worldHeight:800,targetNutrients:0,nutrientPattern:'blooms',inflowRate:0,gravity:0,waterViscosity:.18};
 const s=createInitialWorld(settings,c.seed,'balanced','standard',0);
 addExternalOrganism(s,g,settings,500,400,c.heading);
 settings.targetNutrients=240;addNutrients(s,settings,240);
 return createSnapshot(s,settings);
}
export function intakeMetrics(r:any,seconds=12){
 const f=r.foodAudit,a=r.intakeAudit;if(!f||!a)throw new Error('Intake and food audit required');
 // Reuse the previous read-only physical receipt reducer, with explicit #87
 // resource/food semantics. Correct energy limiting is valid, starvation is
 // protected, and real nutrient stocks are permitted. No movement-based gate.
 const base=selectionMetrics({...r,snapshot:{...r.snapshot,state:{...r.snapshot.state,nutrients:[]}}},seconds);
 const reasons=base.reasons.filter((v:string)=>v!=='premature death/depletion'&&v!=='energy limiting');
 const o=r.snapshot.state.organisms[0];
 if(r.snapshot.state.organisms.length!==1||!r.metrics.founders[0].alive||o?.dissolving||!(o?.energy>=0))reasons.push('invalid living state');
 const partitionResidualJ=base.spentJ+f.grossFoodJ-base.motorJ-base.metabolicJ-a.recordedLossesJ;
 if(Math.abs(partitionResidualJ)>=GATES.chemicalJ)reasons.push('food/work partition');
 if(![f.absorbedJ,f.grossFoodJ,f.assimilationLossJ].every(Number.isFinite)||f.absorbedJ<0||f.grossFoodJ<0||f.assimilationLossJ< -1e-8||f.absorbedJ>f.grossFoodJ+1e-8)reasons.push('food accounting');
 // Normal singleton herbivore: discarded <=1J nutrient remnants are losses,
 // not assimilation. No attribution of those remnants to absorbed intake.
 const assimilationHeatJ=f.grossFoodJ-a.recordedLossesJ-f.absorbedJ;
 if(assimilationHeatJ< -1e-8)reasons.push('assimilation accounting');
 return{...base,reserveJ:a.initialReserveJ,valid:reasons.length===0,reasons,absorbedJ:f.absorbedJ,
  chemicalExpenditureJ:base.spentJ+f.absorbedJ,partitionResidualJ,recordedLossesJ:a.recordedLossesJ,
  food:{...f,assimilationHeatJ},nonlethal:a};
}
/** Sole comparison is valid absorbed joules. No displacement/energy tie-break. */
export function chooseIntakeElite<T extends {valid:boolean;absorbedJ:number}>(parent:T|null,offspring:T[]){
 let best=parent?.valid?parent:null,index=-1;offspring.forEach((c,i)=>{if(c.valid&&Number.isFinite(c.absorbedJ)&&(!best||c.absorbedJ>best.absorbedJ)){best=c;index=i;}});return{best,index};
}
