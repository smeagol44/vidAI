/** Read-only #89 substep mode/band receipts; never returned to the brain/solver. */
import type {SimulationHost} from '../simulationHost';import type {ActuationObserver} from '../actuationObservation';
export function createHybridModeObservation(host:SimulationHost){
 const last=new Map<string,number>();for(const o of host.state.organisms)for(let j=0;j<o.joints.length;j++)last.set(o.id+'/'+j,o.joints[j].gateBand!);
 const bands=['negative-off','direct','oscillator','positive-off'] as const;
 const groups=new Map<string,{samples:number;requestedSquare:number;appliedSquare:number;nonzeroApplied:number}>(),pending=new Map<string,string>();
 const transitions:Array<{time:number;organism:string;joint:number;from:string;to:string;signal:number;command:number}>=[];
 const observe:ActuationObserver=s=>{
  if(s.kind==='demand'&&s.modeBand!==undefined){
   const key=s.organism+'/'+s.joint,band=s.modeBand,previous=last.get(key)!,group=key+'/'+bands[band];last.set(key,band);pending.set(key,group);
   if(previous!==band)transitions.push({time:s.time,organism:s.organism,joint:s.joint,from:bands[previous],to:bands[band],signal:s.modeSignal,command:s.neuralCommand});
   let g=groups.get(group);if(!g){g={samples:0,requestedSquare:0,appliedSquare:0,nonzeroApplied:0};groups.set(group,g);}g.samples++;g.requestedSquare+=(s.requestedTorque/s.baseCeiling)**2;
  }else if(s.kind==='delivery'){const g=groups.get(pending.get(s.organism+'/'+s.joint)!);if(g){g.appliedSquare+=s.appliedTorque**2;g.nonzeroApplied+=Number(s.appliedTorque!==0);}}
 };
 return{observe,report:()=>({transitions,groups:Object.fromEntries([...groups].map(([key,g])=>[key,{samples:g.samples,requestedNormalizedRms:Math.sqrt(g.requestedSquare/g.samples),appliedTorqueRms:Math.sqrt(g.appliedSquare/g.samples),nonzeroApplied:g.nonzeroApplied}]))})};
}
