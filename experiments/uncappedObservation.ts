/** #94 read-only complete force/contact trajectories, exact mode transitions and
 * acquired-weight changes. Never consumed by physics, brains or selection. */
import type {ActuationObserver} from '../actuationObservation';
import type {SimulationHost} from '../simulationHost';
export function createUncappedObservation(host:SimulationHost){
 const partColumns=['time','part','x','y','angle','vx','vy','omega'];
 const forces:number[][]=[],contact:number[][]=[],transitions:unknown[]=[],learning:unknown[]=[],ticks:unknown[]=[];
 const modes=new Map<string,string>(),learned=new Map<string,string>();
 let maxLinearSpeed=0,maxAngularSpeed=0,linearExceedances=0,angularExceedances=0,guardLossJ=0;
 const observe:ActuationObserver=s=>{
  if(s.kind==='uncapped-part'){
   const row=[s.time,s.part,s.x,s.y,s.angle,s.vx,s.vy,s.omega];
   if(!row.every(Number.isFinite))throw new Error('Nonfinite uncapped physical trajectory at '+s.time+'/'+s.part+'/'+s.stage);
   (s.stage==='forces'?forces:contact).push(row);
   maxLinearSpeed=Math.max(maxLinearSpeed,Math.hypot(s.vx,s.vy));maxAngularSpeed=Math.max(maxAngularSpeed,Math.abs(s.omega));
   linearExceedances+=Number(Math.hypot(s.vx,s.vy)>400);angularExceedances+=Number(Math.abs(s.omega)>20);
  }else if(s.kind==='demand'){
   const key=s.organism+'/'+s.joint;if(modes.get(key)!==s.mode){transitions.push({time:s.time,joint:s.joint,from:modes.get(key)??null,to:s.mode,modeSignal:s.modeSignal,command:s.neuralCommand});modes.set(key,s.mode);}
  }else if(s.kind==='guard')guardLossJ+=s.lostJ;
 };
 const afterTick=(tick:number)=>{
  for(const o of host.state.organisms){
   for(const [kind,entries] of [['motor',o.learnedMotorWeights],['sensory',o.learnedSensoryWeights]] as const)for(const e of entries??[]){
    const key=o.id+'/'+kind+'/'+e.edge,values=JSON.stringify([e.delta,e.consolidation??0]);
    // Eligibility is transient, not an acquired weight. Its final full state is
    // in the complete snapshot; every actual delta/consolidation change is here.
    if(learned.get(key)!==values){learning.push({tick:tick+1,time:host.state.simTime,kind,...e});learned.set(key,values);}
   }
   ticks.push({tick:tick+1,time:host.state.simTime,energy:o.energy,ledger:{...host.state.ledger},
    mouthFeedback:structuredClone(o.mouthFeedback),neuralInputs:[...o.neuralInputs],neuralOutputs:[...o.neuralOutputs],
    hidden:[...o.neuralHidden],joints:structuredClone(o.joints)});
  }
  const check=(v:unknown):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Nonfinite uncapped state at tick '+(tick+1));if(v&&typeof v==='object')for(const x of Object.values(v))check(x);};
  check(host.snapshot());
  if(host.state.organisms.length!==1||host.state.eggs.length||host.state.organisms[0].energy<0||host.state.nutrients.some(n=>n.energyValue<0))throw new Error('Corrupt uncapped fixture state at tick '+(tick+1));
 };
 return{observe,afterTick,report:()=>({partColumns,forces,contact,transitions,learning,ticks,maxLinearSpeed,maxAngularSpeed,linearExceedances,angularExceedances,guardLossJ})};
}
