/** #98 read-only diagnostics and complete acquired delta/consolidation changes.
 * No numerical diagnostic here affects a force, score, parent or PRNG. */
import type {ActuationObserver} from '../actuationObservation';
import type {SimulationHost} from '../simulationHost';
export function createUncappedPlasticityObservation(host:SimulationHost){
 const edgeKeys:Array<{kind:string;edge:string}>=[],edgeIndices=new Map<string,number>(),previous=new Map<number,[number,number]>();
 const learning:number[][]=[],ticks:number[][]=[];
 const ledgerKeys=Object.keys(host.state.ledger) as Array<keyof typeof host.state.ledger>;
 const tickColumns=['tick','time','reserveJ',...ledgerKeys,'motorL1','sensoryL1','absorbedJ','contact'];
 const stages={forces:{samples:0,maxLinear:0,maxOmega:0,linearExceedances:0,angularExceedances:0},contact:{samples:0,maxLinear:0,maxOmega:0,linearExceedances:0,angularExceedances:0}};
 let guardLossJ=0;
 const observe:ActuationObserver=s=>{
  if(Object.values(s).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw new Error('Nonfinite uncapped actuation receipt');
  if(s.kind==='uncapped-part'){
   const g=stages[s.stage],speed=Math.hypot(s.vx,s.vy);g.samples++;g.maxLinear=Math.max(g.maxLinear,speed);g.maxOmega=Math.max(g.maxOmega,Math.abs(s.omega));g.linearExceedances+=Number(speed>400);g.angularExceedances+=Number(Math.abs(s.omega)>20);
  }else if(s.kind==='guard')guardLossJ+=s.lostJ;
 };
 const afterTick=(tick:number)=>{
  const state=host.state,o=state.organisms[0];
  if(!o||state.organisms.length!==1||state.eggs.length||o.energy<0||state.nutrients.some(n=>n.energyValue<0))throw new Error('Corrupt singleton/resource state');
  const finite=(v:unknown):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Nonfinite uncapped tick state');if(v&&typeof v==='object')for(const x of Object.values(v))finite(x);};
  finite([state.ledger,o.energy,o.segments,o.joints,o.neuralInputs,o.neuralOutputs,o.neuralHidden,o.learnedMotorWeights,o.learnedSensoryWeights,state.nutrients]);
  for(const [kind,entries] of [['motor',o.learnedMotorWeights],['sensory',o.learnedSensoryWeights]] as const)for(const e of entries??[]){
   const key=kind+'/'+e.edge;let index=edgeIndices.get(key);if(index===undefined){index=edgeKeys.length;edgeIndices.set(key,index);edgeKeys.push({kind,edge:e.edge});}
   const value:[number,number]=[e.delta,e.consolidation??0],old=previous.get(index);
   if(!old||old[0]!==value[0]||old[1]!==value[1]){learning.push([tick+1,index,e.delta,e.eligibility,e.consolidation??0]);previous.set(index,value);}
  }
  const l1=(xs?:Array<{delta:number}>)=>(xs??[]).reduce((a,e)=>a+Math.abs(e.delta),0);
  const absorbedJ=Object.values(o.mouthFeedback??{}).reduce((a,m)=>a+m.intake*3600/60,0),contact=Number(Object.values(o.mouthFeedback??{}).some(m=>m.contact));
  ticks.push([tick+1,state.simTime,o.energy,...ledgerKeys.map(k=>state.ledger[k]),l1(o.learnedMotorWeights),l1(o.learnedSensoryWeights),absorbedJ,contact]);
 };
 return{observe,afterTick,report:()=>({stages,guardLossJ,tickColumns,ticks,edgeKeys,learningColumns:['tick','edgeIndex','delta','eligibility','consolidation'],learning})};
}
