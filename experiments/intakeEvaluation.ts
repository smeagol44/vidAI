/** Private, request-scoped #87 evaluation. Not a world setting or saved state. */
import type {SimulationHost} from '../simulationHost';
import type {OfflineMortalityProtection} from '../simulation';
export function createIntakeEvaluation(host:SimulationHost,ticks:number){
 const s=host.state,c=host.settings,o=s.organisms[0];
 if(!['gated-torque-v1','neural-motor-v1','neural-motor-v2','plasticity-study-v1'].includes(c.motorExperiment!)||c.physicsRegime!=='passive-work-v3'
  ||s.organisms.length!==1||s.eggs.length||!o||o.dissolving||o.genome.mouths.some(m=>m.mouthType!=='herbivore')
  ||c.inflowRate!==0||ticks<1||ticks>720||s.simTime+ticks/60>12+1e-8)
  throw new Error('Nonlethal intake evaluation requires a paused singleton herbivore v3 experiment, no inflow/eggs, and at most12s');
 const initialReserveJ=o.energy,initialLossJ=s.ledger.recordedLosses;
 const causes=new Map<string,{id:string;cause:string;firstTime:number;lastTime:number;ticks:number;firstReserveJ:number}>();
 const mortality:OfflineMortalityProtection={version:'nonlethal-evaluation-v1',record:(id,cause,time,reserveJ)=>{
  const key=id+'/'+cause,r=causes.get(key);if(r){r.lastTime=time;r.ticks++;}else causes.set(key,{id,cause,firstTime:time,lastTime:time,ticks:1,firstReserveJ:reserveJ});
 }};
 const contacts:Array<{tick:number;time:number;reserveJ:number;mouths:unknown;learnedMotorL1:number;learnedSensoryL1:number}>=[];
 const l1=(entries?:Array<{delta:number}>)=>(entries??[]).reduce((a,e)=>a+Math.abs(e.delta),0);
 const afterTick=(tick:number)=>{const o=host.state.organisms[0];if(o&&Object.values(o.mouthFeedback??{}).some(m=>m.contact||m.intake))contacts.push({tick:tick+1,time:host.state.simTime,reserveJ:o.energy,mouths:structuredClone(o.mouthFeedback),learnedMotorL1:l1(o.learnedMotorWeights),learnedSensoryL1:l1(o.learnedSensoryWeights)});};
 return{mortality,afterTick,report:()=>({version:'nutrient-intake-v1',initialReserveJ,recordedLossesJ:host.state.ledger.recordedLosses-initialLossJ,wouldBeDeaths:[...causes.values()],contacts})};
}
