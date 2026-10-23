/** #63 OFFLINE experiment only. Never imported by simulation, UI or live ecology. */
import {createFounderGenome} from '../founders';
import {makeGatedGenome} from './gatedGenome';
import {makeRetainedGenome} from './retainedHead';
import {XoshiroPRNG,type Genome,type SimulationSettings} from '../simulation';
import {createInitialWorld,addExternalOrganism} from '../world';
import {createSnapshot,DEFAULT_SETTINGS,validateGenome} from '../persistence';
export const ARCHITECTURES=['legacy','signed','hybrid'] as const;
export type Architecture=typeof ARCHITECTURES[number];
export const START_SEEDS=[17,71,1901] as const;
export const TRAINING={seed:73,heading:.37,viscosity:.18,seconds:5};
export const HELD_OUT=[{seed:811,heading:-.7,viscosity:.18,seconds:10},{seed:977,heading:2.3,viscosity:.18,seconds:15},{seed:2301,heading:Math.PI/2,viscosity:.18,seconds:15}] as const;
export const BUDGET={generations:12,offspring:16,neuralEvents:8,sigma:.15,reserveJ:50000};
export const GATES={anchorPx:.5,limitRad:.05,constraintGainJ:1e-12,chemicalJ:1e-5,omega:20.001,billingJ:1e-9};
export type ScalarChange={field:'weightsIH'|'weightsHH'|'weightsHO'|'biasesH'|'biasesO';row:number;column?:number;before:number;after:number};
export type Mutation={kind:'neural';changes:ScalarChange[]}|{kind:'selector';joint:string;before:string[];after:string[]};
export function initialNetwork(architecture:Architecture,seed:number):Genome{
 const original=createFounderGenome('CUR-001');
 const g=architecture==='legacy'?structuredClone(original):architecture==='signed'?makeGatedGenome(original,'three-output',.06,seed):makeRetainedGenome(original,seed);
 const trunk=new XoshiroPRNG(seed),legacy=new XoshiroPRNG(seed^0x1a29e31),signed=new XoshiroPRNG(seed^0x5ae29f1);
 const weights=(r:XoshiroPRNG,n:number)=>Array.from({length:n},()=>r.range(-1/Math.sqrt(n),1/Math.sqrt(n)));
 // Rebuild EVERY matrix and bias. No donor motor, sensory or recurrent weights remain.
 g.weightsIH=g.hiddenIds!.map(()=>weights(trunk,g.inputKeys!.length));g.weightsHH=g.hiddenIds!.map(()=>weights(trunk,g.hiddenIds!.length));
 g.biasesH=g.hiddenIds!.map(()=>trunk.range(-.1,.1));g.hiddenTimeConstants=g.hiddenIds!.map(()=>0);g.disabledConnections=[];
 const rows=new Map<string,{weights:number[];bias:number}>();
 for(const p of g.parts.slice(1))for(const channel of ['Angle','Drive','Torque','Stiff','Amp','Engage'])rows.set(`joint:${p.id}:${channel}`,{weights:weights(legacy,24),bias:legacy.range(-.1,.1)});
 for(const p of g.parts.slice(1))for(const channel of ['Mode','DirectTorque','OscillatorStrength'])rows.set(`joint:${p.id}:${channel}`,{weights:weights(signed,24),bias:signed.range(-.1,.1)});
 g.weightsHO=g.outputKeys!.map(k=>rows.get(k)!.weights);g.biasesO=g.outputKeys!.map(k=>rows.get(k)!.bias);
 return validateGenome(g);
}
export function parameterCount(g:Genome){return g.weightsIH.flat().length+g.weightsHH.flat().length+g.weightsHO.flat().length+g.biasesH.length+g.biasesO.length;}
export function mutationSeed(seed:number,generation:number,offspring:number){return (seed^Math.imul(generation,0x9e3779b1)^Math.imul(offspring+1,0x85ebca6b))>>>0;}
export function mutateNetwork(parent:Genome,architecture:Architecture,seed:number,offspring:number):{genome:Genome;mutation:Mutation}{
 const g=structuredClone(parent),r=new XoshiroPRNG(seed);
 if(architecture==='hybrid'&&offspring<2){
  if(g.motorController?.version!=='retained-head-v1')throw new Error('Hybrid selector required');
  const c=g.motorController,joint=g.parts[offspring+1].id,before=[...c.signedJoints],ids=new Set(before);
  if(ids.has(joint))ids.delete(joint);else ids.add(joint);
  c.signedJoints=g.parts.slice(1).filter(p=>ids.has(p.id)).map(p=>p.id);
  return{genome:validateGenome(g),mutation:{kind:'selector',joint,before,after:[...c.signedJoints]}};
 }
 const slots:Array<{field:ScalarChange['field'];row:number;column?:number}>=[];
 for(const field of ['weightsIH','weightsHH','weightsHO'] as const)g[field].forEach((row,i)=>row.forEach((_,j)=>slots.push({field,row:i,column:j})));
 for(const field of ['biasesH','biasesO'] as const)g[field].forEach((_,row)=>slots.push({field,row}));
 const changes:ScalarChange[]=[];
 for(let event=0;event<BUDGET.neuralEvents;event++){
  const slot=slots[r.rangeInt(0,slots.length-1)];
  const values=slot.column===undefined?g[slot.field] as number[]:(g[slot.field] as number[][])[slot.row];
  const index=slot.column??slot.row,before=values[index];
  const z=Math.sqrt(-2*Math.log(Math.max(Number.MIN_VALUE,r.nextFloat())))*Math.cos(2*Math.PI*r.nextFloat()),bound=slot.column===undefined?1.5:3.5;
  const after=Math.max(-bound,Math.min(bound,before+z*BUDGET.sigma));values[index]=after;changes.push({...slot,before,after});
 }
 return{genome:validateGenome(g),mutation:{kind:'neural',changes}};
}
/** Every candidate is born from its GENOME: no activation, eligibility or learned delta inheritance. */
export function selectionSource(g:Genome,c:{seed:number;heading:number;viscosity:number;seconds:number}=TRAINING,passive=false){
 const config:SimulationSettings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',motorExperiment:g.motorController?.version==='retained-head-v1'?'retained-head-v1':'gated-torque-v1',
  worldWidth:4800,worldHeight:3000,targetNutrients:0,inflowRate:0,mutationSeverity:0,gravity:0,waterViscosity:c.viscosity,mouthContactModel:'capsule-v1'};
 const genome=structuredClone(g);
 if(passive){
  for(let i=0;i<genome.outputKeys!.length;i++)if(/:(Engage|Mode)$/.test(genome.outputKeys![i])){genome.weightsHO[i].fill(0);genome.biasesO[i]=-3;}
 }
 const s=createInitialWorld(config,c.seed,'balanced','standard',0),o=addExternalOrganism(s,genome,config,2400,1500,c.heading)!;
 // A finite experimental starting stock, fully recorded as external funding. No recurring subsidy.
 s.ledger.externalInflow+=BUDGET.reserveJ-o.energy;o.energy=BUDGET.reserveJ;
 if(passive)o.joints.forEach(j=>j.engagement=0);
 return createSnapshot(s,config);
}
export interface SelectionTrial {valid:boolean;distance:number}
/** Only validity then net COM displacement decide selection. No energy/direction/late-motion score. */
export function chooseElite<T extends SelectionTrial>(parent:T|null,offspring:T[]):{best:T|null;index:number}{
 let best=parent?.valid?parent:null,index=-1;
 offspring.forEach((c,i)=>{if(c.valid&&(!best||c.distance>best.distance)){best=c;index=i;}});return{best,index};
}
