/** Read-only interpretation of the existing actual-Worker receipts. */
import {GATES,BUDGET} from './neuralSelection';
export function selectionMetrics(r:any,seconds:number){
 const m=r.metrics,t=r.torqueAudit,s=r.snapshot.state,o=s.organisms[0],f=m.founders[0],reasons:string[]=[];
 const require=(ok:boolean,why:string)=>{if(!ok)reasons.push(why);};
 require(m.finite&&[f.displacementPx,f.reserveSpentJ,t.positiveJ,t.negativeJ,t.costJ,t.maxPostContactAngularSpeed,t.maxConstraintAngularSpeed].every(Number.isFinite),'non-finite');
 require(f.alive&&s.organisms.length===1&&!o?.dissolving&&o?.energy>0,'premature death/depletion');
 require(Math.abs(s.simTime-seconds)<1e-8&&m.ticks===Math.round(seconds*60),'duration');
 require(s.eggs.length===0&&s.nutrients.length===0,'population/food');require(m.boundaryTicks===0,'boundary');
 require(m.guards===0&&t.guards===0,'speed guard');require(m.energyLimited===0&&t.limitedBatches===0,'energy limiting');
 require(t.maxAnchorPx<GATES.anchorPx,'anchor');require(t.maxLimitRad<GATES.limitRad,'joint limit');
 require(m.maxConstraintGainJ<GATES.constraintGainJ,'constraint gain');require(m.maxEnergyErrorJ<GATES.chemicalJ,'chemical balance');
 require(t.maxPostContactAngularSpeed<=GATES.omega&&t.maxConstraintAngularSpeed<=GATES.omega,'post-guard overspeed');
 require(t.totals.deliveryErrorMax===0,'delivery mismatch');require(Math.abs(t.costJ-4*t.positiveJ)<GATES.billingJ&&Math.abs(t.costJ-m.motorJ)<GATES.billingJ,'prepaid work');
 const trajectory=r.trajectory??[],joints=o?.joints.map((_:unknown,j:number)=>{
  const samples=trajectory.flatMap((p:any)=>p.organisms[0]?.joints[j]?[p.organisms[0].joints[j]]:[]);
  const modes=Object.fromEntries(Object.entries(t.groups).filter(([k])=>k.includes(`/J${j}/`)).map(([k,v]:any)=>[k.split('/').at(-1),v.samples]));
  return{sampledMinAngle:samples.length?Math.min(...samples.map((p:any)=>p.angle)):null,sampledMaxAngle:samples.length?Math.max(...samples.map((p:any)=>p.angle)):null,modeSubsteps:modes,finalAngle:samples.at(-1)?.angle,finalTorque:o.joints[j].appliedTorque};
 })??[];
 return{valid:reasons.length===0,reasons,distance:f.displacementPx,dx:f.dx,dy:f.dy,pathPx:m.pathPx,lateDistance:f.lateDisplacementPx,latePathPx:m.latePathPx,
  spentJ:f.reserveSpentJ,motorJ:m.motorJ,positiveJ:t.positiveJ,brakingJ:t.negativeJ,metabolicJ:s.ledger.metabolicDissipation,remainingJ:o?.energy??0,
  partitionResidualJ:f.reserveSpentJ-m.motorJ-s.ledger.metabolicDissipation,reserveJ:BUDGET.reserveJ,age:o?.age,
  guards:m.guards,energyLimited:m.energyLimited,limitedBatches:t.limitedBatches,anchorPx:t.maxAnchorPx,limitRad:t.maxLimitRad,maxConstraintGainJ:m.maxConstraintGainJ,
  chemicalErrorJ:m.maxEnergyErrorJ,peakConstraintOmega:t.maxConstraintAngularSpeed,peakPostContactOmega:t.maxPostContactAngularSpeed,constraintOverspeedSamples:t.constraintOverspeedSamples,
  requestRms:t.totals.requestedNormalized.rms,requestMax:t.totals.requestedNormalized.maxAbs,clipSamples:t.totals.clipSamples,
  deliveryError:t.totals.deliveryErrorMax,switches:m.switches,joints};
}
