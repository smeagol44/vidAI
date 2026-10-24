/** #100 offline source and receipts. No selection/targets in neural runtime. */
import {initialNetwork,mutateNetwork,mutationSeed} from './neuralSelection';
import {plasticNetwork,plasticMutation} from './architecturePlasticity';
import {DEFAULT_SETTINGS,createSnapshot} from '../persistence';
import {createInitialWorld,addExternalOrganism} from '../world';
import {addNutrients,type Genome,type SimulationSettings} from '../simulation';
import {organs,initPursuit,mouthGap} from '../movingNutrient';
import {selectionMetrics} from './selectionMetrics';
export {mutationSeed};
export const RUNS=[{controller:'legacy',seed:17},{controller:'mutable',seed:17},{controller:'mutable',seed:71},{controller:'mutable',seed:1901},{controller:'mutable',seed:4099}] as const;
export const HELD=[{seed:811,heading:-.7},{seed:977,heading:2.3},{seed:2301,heading:Math.PI/2}];
export const OPTIONS={auditTorque:true,traceJoints:true,traceFood:true,traceModes:true,traceLearning:true,traceUncapped:true};
export const initial=(controller:string,seed:number)=>controller==='legacy'?{genome:initialNetwork('legacy',seed),initialization:{architecture:'legacy',seed,fixedLearning:true}}:plasticNetwork('two-output','mutable',seed);
export const mutate=(g:Genome,controller:string,seed:number,index:number)=>controller==='legacy'?(()=>{const x=mutateNetwork(g,'legacy',seed,index);return{genome:x.genome,neuralMutation:x.mutation};})():plasticMutation(g,'mutable',seed,index);
export function source(g:Genome,environment={seed:73,heading:.37}){
 const settings:SimulationSettings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',motorExperiment:g.plasticConnections?'plasticity-study-v1':'gated-torque-v1',experimentalVelocityMode:'uncapped-pursuit-v1',mouthContactModel:'capsule-v1',worldWidth:4800,worldHeight:3000,targetNutrients:1,inflowRate:0,gravity:0,waterViscosity:.18};
 const state=createInitialWorld(settings,environment.seed,'balanced','standard',0),o=addExternalOrganism(state,structuredClone(g),settings,2400,1500,environment.heading)!;
 addNutrients(state,settings,1);const n=state.nutrients[0],eyes=organs(o).eyes,eye=eyes.reduce((a,b)=>((b.x-2400)*Math.cos(environment.heading)+(b.y-1500)*Math.sin(environment.heading)>(a.x-2400)*Math.cos(environment.heading)+(a.y-1500)*Math.sin(environment.heading)?b:a));
 n.x=eye.x+120*Math.cos(eye.heading);n.y=eye.y+120*Math.sin(eye.heading);n.vx=0;n.vy=0;state.pursuit=initPursuit(o,n,environment.seed);
 if(n.energyValue!==3000||mouthGap(o,n)<=0||o.energy!==10000)throw Error('Incorrect source initialization');return createSnapshot(state,settings);
}
export function metrics(p:any){
 const finite=(v:any):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw Error('Nonfinite trial');if(v&&typeof v==='object')Object.values(v).forEach(finite);};finite(p);
 const t=p.snapshot.state.pursuit,a=p.pursuitAudit,base=selectionMetrics(p,15),food=p.foodAudit;
 if(!t||!a||p.metrics.ticks!==900||!p.metrics.finite||t.steps!==3600||t.absorbedJ<0||t.absorbedJ!==food.absorbedJ||Math.abs(t.reservoirInputJ-food.grossFoodJ)>1e-8)throw Error('Corrupt pursuit food evidence');
 return{...base,valid:true,reasons:[],formerReasons:base.reasons.filter((r:string)=>r!=='population/food'),absorbedJ:t.absorbedJ,reservoirInputJ:t.reservoirInputJ,absorbedByState:t.absorbedByState,grossByState:t.grossByState,food,learning:p.learningAudit,uncapped:{stages:p.uncappedAudit.stages,guardLossJ:p.uncappedAudit.guardLossJ},modeAudit:p.modeAudit,partitionResidualJ:10000+t.absorbedJ-base.remainingJ-base.motorJ-(p.snapshot.state.ledger.metabolicDissipation-(t.reservoirInputJ-t.absorbedJ)),freeze:t.events.find((e:any)=>e.kind==='freeze')??null,targetEvents:t.events,alive:p.metrics.founders[0].alive};
}
