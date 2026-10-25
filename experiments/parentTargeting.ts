/** Offline #103 lineage metadata. Never imported into the neural runtime. */
import {XoshiroPRNG,type Genome} from '../simulation';
import {validateGenome} from '../persistence';
import type {ScalarChange,Mutation} from './neuralSelection';
import type {plasticMutation} from './architecturePlasticity';
import {mutate as originalMutate} from './movingNutrient';
export interface Coordinate {id:string;field:ScalarChange['field'];row:number;column?:number}
export interface BirthReceipt extends ScalarChange {id:string;targeted:boolean;coordinateDraw:number|null;gaussian?:number}
export interface BirthOrigin {version:'parent-birth-v1';geneticParent:string;child:string;genomeSha:string;changedCoordinates:string[];receipts:BirthReceipt[]}
export function coordinates(g:Genome):Coordinate[]{
 const a:Coordinate[]=[];
 for(const field of ['weightsIH','weightsHH','weightsHO'] as const)g[field].forEach((row,i)=>row.forEach((_,j)=>a.push({field,row:i,column:j,id:JSON.stringify([field,field==='weightsHO'?g.outputKeys![i]:g.hiddenIds![i],field==='weightsIH'?g.inputKeys![j]:g.hiddenIds![j]])})));
 for(const field of ['biasesH','biasesO'] as const)g[field].forEach((_,row)=>a.push({field,row,id:JSON.stringify([field,field==='biasesH'?g.hiddenIds![row]:g.outputKeys![row]])}));
 return a;
}
export function value(g:Genome,s:Coordinate){return s.column===undefined?(g[s.field] as number[])[s.row]:(g[s.field] as number[][])[s.row][s.column];}
function set(g:Genome,s:Coordinate,v:number){if(s.column===undefined)(g[s.field] as number[])[s.row]=v;else(g[s.field] as number[][])[s.row][s.column]=v;}
export function makeOrigin(parent:Genome,child:Genome,receipts:BirthReceipt[],geneticParent:string,childRef:string,genomeSha:string):BirthOrigin{
 const slots=coordinates(parent);return{version:'parent-birth-v1',geneticParent,child:childRef,genomeSha,changedCoordinates:slots.filter(s=>value(parent,s)!==value(child,s)).map(s=>s.id),receipts};
}
export function targetPlan(parentIds:string[],slots:Coordinate[],seed:number){
 const pool=[...new Set(parentIds)];if(pool.some(id=>!slots.some(s=>s.id===id)))throw Error('Unknown parental scalar identity');
 const r=new XoshiroPRNG(seed^0x66a103ed),draws:number[]=[],next=()=>{const v=r.nextFloat();draws.push(v);return v;},rounding=next(),requested=rounding<.72?5:6,n=Math.min(requested,pool.length),chosen:string[]=[];
 for(let i=0;i<n;i++)chosen.push(pool.splice(Math.floor(next()*pool.length),1)[0]);
 const eventOrder=Array.from({length:8},(_,i)=>i);for(let i=7;i>0;i--){const j=Math.floor(next()*(i+1));[eventOrder[i],eventOrder[j]]=[eventOrder[j],eventOrder[i]];}
 const eventTargets:Array<string|null>=Array(8).fill(null);chosen.forEach((id,i)=>eventTargets[eventOrder[i]]=id);
 return{rounding,requested,realized:n,draws,eventTargets};
}
export function mutate(parent:Genome,controller:string,brainSeed:number,seed:number,index:number,origin:BirthOrigin|null,parentIdentity:string){
 const original:{genome:Genome;neuralMutation:Mutation;learningMutation?:ReturnType<typeof plasticMutation>['learningMutation']}=originalMutate(parent,controller,seed,index),slots=coordinates(parent),byIndex=new Map(slots.map(s=>[s.field+':'+s.row+':'+(s.column??''),s])),custom=controller==='mutable'&&[71,4099].includes(brainSeed);
 if(origin&&(origin.version!=='parent-birth-v1'||origin.genomeSha!==parentIdentity||origin.receipts.length!==8||!Array.isArray(origin.changedCoordinates)))throw Error('Invalid selected parent birth origin');
 const ids=origin?[...new Set(origin.changedCoordinates)]:[];if(ids.some(id=>!slots.some(s=>s.id===id)))throw Error('Unknown parental scalar identity');
 let genome=original.genome,neuralMutation=original.neuralMutation,receipts:BirthReceipt[],plan:ReturnType<typeof targetPlan>|null=null;
 if(custom&&origin&&ids.length){
  plan=targetPlan(ids,slots,seed);const parentSet=new Set(ids),outside=slots.filter(s=>!parentSet.has(s.id));if(!outside.length)throw Error('No exploratory coordinates');
  genome=structuredClone(original.genome);for(const s of slots)set(genome,s,value(parent,s));const neural=new XoshiroPRNG(seed);receipts=[];
  for(let event=0;event<8;event++){
   const coordinateDraw=neural.nextFloat(),z=Math.sqrt(-2*Math.log(Math.max(Number.MIN_VALUE,neural.nextFloat())))*Math.cos(2*Math.PI*neural.nextFloat()),target=plan.eventTargets[event],slot=target?slots.find(s=>s.id===target)!:outside[Math.floor(coordinateDraw*outside.length)],before=value(genome,slot),bound=slot.column===undefined?1.5:3.5,after=Math.max(-bound,Math.min(bound,before+z*.15));set(genome,slot,after);receipts.push({...slot,before,after,targeted:!!target,coordinateDraw,gaussian:z});
  }
  genome=validateGenome(genome);neuralMutation={kind:'neural' as const,changes:receipts.map(({field,row,column,before,after})=>({field,row,...(column===undefined?{}:{column}),before,after}))};
 }else{
  if(neuralMutation.kind!=='neural')throw Error('Eight neural mutations required');
  const r=new XoshiroPRNG(seed);receipts=neuralMutation.changes.map(c=>{const coordinateDraw=r.nextFloat();r.nextFloat();r.nextFloat();return{...c,id:byIndex.get(c.field+':'+c.row+':'+(c.column??''))!.id,targeted:false,coordinateDraw};});
 }
 return{...original,genome,neuralMutation,lineageMutation:{algorithm:custom?'parent-targeted-66':'original-random',parentIdentity,parentWasFounder:origin===null,parentOrigin:origin,parentCoordinates:ids,requestedTargets:plan?.requested??0,targetedEvents:plan?.realized??0,exploratoryEvents:8-(plan?.realized??0),targetedFraction:(plan?.realized??0)/8,plan,receipts}};
}
