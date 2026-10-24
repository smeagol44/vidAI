/** Read-only paid-learning and somatic evidence, never an input or score. */
import type {SimulationHost} from '../simulationHost';import type {LearningObserver} from '../learningObservation';
export function createPlasticityObservation(host:SimulationHost){
 const totals={motor:{events:0,upkeepJ:0,rewriteJ:0,requestedRewriteJ:0,costJ:0},sensory:{events:0,upkeepJ:0,rewriteJ:0,requestedRewriteJ:0,costJ:0}};
 const observe:LearningObserver=r=>{const t=totals[r.category];t.events++;t.upkeepJ+=r.upkeepJ;t.rewriteJ+=r.rewriteJ;t.requestedRewriteJ+=r.requestedRewriteJ;t.costJ+=r.costJ;};
 const trace:Array<{tick:number;motorL1:number;sensoryL1:number}>=[];
 const l1=(a?:Array<{delta:number}>)=>(a??[]).reduce((s,r)=>s+Math.abs(r.delta),0);
 const afterTick=(tick:number)=>{if(tick%60===59){const o=host.state.organisms[0];trace.push({tick:tick+1,motorL1:l1(o?.learnedMotorWeights),sensoryL1:l1(o?.learnedSensoryWeights)});}};
 return{observe,afterTick,report:()=>{const o=host.state.organisms[0],motor=structuredClone(o?.learnedMotorWeights??[]),sensory=structuredClone(o?.learnedSensoryWeights??[]);return{totals,trace,somatic:{motor,sensory},motorL1:l1(motor),sensoryL1:l1(sensory),costJ:totals.motor.costJ+totals.sensory.costJ};}};
}
