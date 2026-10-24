/** #91 offline six-group protocol. No fitness enters live ecology. */
import {initialNetwork,mutateNetwork,mutationSeed,parameterCount,GATES} from './neuralSelection';
import {revisedHybridNetwork} from './hybridThresholdIntake';
import {XoshiroPRNG,type Genome} from '../simulation';import {validateGenome} from '../persistence';
import {plasticEdgePools,editPlasticMask} from '../plasticGenetics';
import {intakeSource,intakeMetrics,chooseIntakeElite,INTAKE_TRAINING,INTAKE_HELD_OUT,INTAKE_OPTIONS} from './nutrientIntake';
export {mutationSeed,parameterCount,GATES,intakeSource,intakeMetrics,chooseIntakeElite,INTAKE_TRAINING,INTAKE_HELD_OUT};
export const PLASTIC_ARCHITECTURES=['legacy','two-output','three-output'] as const;
export type PlasticArchitecture=typeof PLASTIC_ARCHITECTURES[number];
export const PLASTIC_CONDITIONS=['off','mutable'] as const;export type PlasticCondition=typeof PLASTIC_CONDITIONS[number];
export const PLASTIC_SEEDS=[17,71,1901,4099,8191] as const;
export const PLASTIC_BUDGET={generations:15,offspring:15,seconds:12,neuralEvents:8,sigma:.15,initialMotor:48,initialSensory:48,cap:96,traitEvents:1,traitSigmaFraction:.1,maskAttemptsPerCategory:1,extraUniformDraws:9};
export const PLASTIC_OPTIONS={...INTAKE_OPTIONS,traceModes:true,traceLearning:true};
export const LEARNING_FIELDS=['plasticityRate','sensoryPlasticityRate','forgettingRate','memoryConsolidationRate','injuryAversionRate'] as const;
const bounds=[.8,.8,1,2,1];
function shuffled<T>(v:T[],r:XoshiroPRNG){const a=[...v];for(let i=a.length-1;i>0;i--){const j=r.rangeInt(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function plasticNetwork(architecture:PlasticArchitecture,condition:PlasticCondition,seed:number){
 const g=architecture==='legacy'?initialNetwork('legacy',seed):architecture==='two-output'?revisedHybridNetwork(seed):initialNetwork('signed',seed);
 if(architecture==='three-output')g.motorController={version:'neural-motor-v3',architecture:'three-output',hysteresisWidth:.06};
 const traitRng=new XoshiroPRNG(seed^0x71b439a1),traits=Object.fromEntries(LEARNING_FIELDS.map((f,i)=>[f,traitRng.nextFloat()*bounds[i]]));
 const pools=plasticEdgePools(g),motorRng=new XoshiroPRNG(seed^0x139fe247),sensoryRng=new XoshiroPRNG(seed^0x68a51f29),motor:string[]=[];
 const perOutput=48/g.outputKeys!.length;if(!Number.isInteger(perOutput))throw Error('Fixed Darter output budget required');
 for(const output of g.outputKeys!){const candidates=pools.motor.filter(e=>JSON.parse(e)[1]===output);motor.push(...shuffled(candidates,motorRng).slice(0,perOutput));}
 g.plasticConnections={version:'heritable-plastic-v1',motor:motor.sort(),sensory:shuffled(pools.sensory,sensoryRng).slice(0,48).sort()};
 for(const f of LEARNING_FIELDS)g[f]=condition==='mutable'?traits[f]:0;
 return{genome:validateGenome(g),initialization:{architecture,condition,seed,drawnTraits:traits,traitsApplied:condition==='mutable',perOutput,initialMotor:48,initialSensory:48,pools:{motor:pools.motor.length,sensory:pools.sensory.length}}};
}
export function plasticMutation(parent:Genome,condition:PlasticCondition,seed:number,index:number){
 const neural=mutateNetwork(parent,'signed',seed,index),g=neural.genome,r=new XoshiroPRNG(seed^0x7cd94e13),draws=Array.from({length:9},()=>r.nextFloat());
 const f=Math.min(4,Math.floor(draws[0]*5)),field=LEARNING_FIELDS[f],before=g[field]??0,z=Math.sqrt(-2*Math.log(Math.max(Number.MIN_VALUE,draws[1])))*Math.cos(2*Math.PI*draws[2]),after=Math.max(0,Math.min(bounds[f],before+z*.1*bounds[f]));
 const pools=plasticEdgePools(g),motor=editPlasticMask(g.plasticConnections!.motor,pools.motor,draws.slice(3,6)),sensory=editPlasticMask(g.plasticConnections!.sensory,pools.sensory,draws.slice(6,9));
 if(condition==='mutable'){g[field]=after;g.plasticConnections={version:'heritable-plastic-v1',motor:motor.after,sensory:sensory.after};if((g.plasticityRate??0)===0&&(g.sensoryPlasticityRate??0)===0)g.memoryConsolidationRate=0;}
 return{genome:validateGenome(g),neuralMutation:neural.mutation,learningMutation:{draws,applied:condition==='mutable',trait:{field,before,proposed:after,final:g[field]},motor,sensory}};
}
export function withoutLifetimePlasticity(g:Genome){const clone=structuredClone(g);clone.plasticityRate=0;clone.sensoryPlasticityRate=0;clone.memoryConsolidationRate=0;return validateGenome(clone);}
export function plasticCoverage(g:Genome){const pc=g.plasticConnections!,pools=plasticEdgePools(g);return{motor:pc.motor.length,sensory:pc.sensory.length,motorPool:pools.motor.length,sensoryPool:pools.sensory.length,outputs:Object.fromEntries(g.outputKeys!.map(k=>[k,pc.motor.filter(e=>JSON.parse(e)[1]===k).length])),sensoryInputs:Object.fromEntries(g.inputKeys!.filter(k=>k.startsWith('eye:')&&/:(red|green|blue)$/.test(k)).map(k=>[k,pc.sensory.filter(e=>JSON.parse(e)[2]===k).length]))};}
