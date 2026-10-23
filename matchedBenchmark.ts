/** Private #80 mechanical comparison: only drag law/method varies, never the world regime. */
import {scissorFixture,scissorTarget} from './scissorBenchmark';
import {serpentFixture,serpentTarget,shapeLoopArea} from './serpentBenchmark';
import {bodyMass,MECHANICAL_JOULES} from './foundationPhysics';
import {calculateBodyCost,calculateOrganismCOM,BASE_PART_DENSITY,type Organism} from './simulation';
import {totalAccountedEnergy} from './persistence';
import {organismKineticEnergy,type MechanicalPhase} from './mechanicalObservation';
import {rectangleContact} from './contacts';
import {type MatchedMethod,type DragLaw} from './matchedDrag';
import type {IntegrationDiagnostic,PhysicsObserver} from './physicsObservation';
import type {SolverTrace} from './solverTrace';
export type MatchedBody='scissor'|'serpent'|'paddles';
export interface MatchedRequest {
 version:'matched-drag-v1';body:MatchedBody;law:DragLaw;integration:'explicit'|'implicit';substeps:4|8|16;
 cycles:1|4;tape?:number[][];passive?:boolean;fluidOff?:boolean;audit?:boolean;
}
export function matchedFixture(body:MatchedBody){
 const f=body==='scissor'?scissorFixture('passive-work-v3'):serpentFixture('passive-work-v3');
 const anchors:MatchedMethod['anchors']=body==='scissor'?[{parent:{x:.5,y:3.5},child:{x:.5,y:-3.5}}]:
  body==='serpent'?[0,1].map(()=>({parent:{x:.5,y:3.5},child:{x:-.5,y:-3.5}})):
  [{parent:{x:-3.5,y:3.5},child:{x:.5,y:-3.5}},{parent:{x:3.5,y:3.5},child:{x:-.5,y:-3.5}}];
 if(body==='paddles'){
  const g=f.o.genome;g.id='BENCH-MATCHED-PADDLES';g.name='Offline body and independent paddles';
  g.parts[0]={...g.parts[0],dimN:1,width:7};g.parts[2].parentIndex=0;
  g.bodyCost=calculateBodyCost(g.parts,[],[]);f.o.structuralBiomass=g.bodyCost;
  f.o.segments[0]={x:1200,y:750,vx:0,vy:0,angle:0,angVel:0};
  f.o.segments[1]={x:1196,y:757,vx:0,vy:0,angle:0,angVel:0};
  f.o.segments[2]={x:1204,y:757,vx:0,vy:0,angle:0,angVel:0};
  f.host.state.ledger.externalInflow=f.o.energy+f.o.structuralBiomass;
 }
 const parts=f.o.genome.parts.map(d=>{const mass=bodyMass(d,BASE_PART_DENSITY,'passive-work-v3');
  return {width:d.width,height:d.height,parent:d.parentIndex,mass,inertia:mass*(d.width*d.width+d.height*d.height)/12,
    baseAngle:d.baseAngleOffset,maxAngle:d.maxAngle};});
 const ceiling=parts.slice(1).map((d,j)=>(d.inertia+parts[d.parent].inertia)*.5*2200);
 return {...f,anchors,reference:{parts,anchors,ceiling,joulesPerUnit:MECHANICAL_JOULES,chemicalReserve:f.o.energy,biologicalUpkeep:false}};
}
export function matchedAngles(o:Organism){return o.genome.parts.slice(1).map((d,j)=>
 o.segments[j+1].angle-o.segments[d.parentIndex].angle-d.baseAngleOffset);}
function targets(body:MatchedBody,t:number){return body==='scissor'?[scissorTarget(t,'slow-open').aperture-Math.PI/2]:serpentTarget(t,'traveling');}
function validate(r:MatchedRequest){
 if(!r||r.version!=='matched-drag-v1'||!['scissor','serpent','paddles'].includes(r.body)||!['v3','v4'].includes(r.law)||
 !['explicit','implicit'].includes(r.integration)||![4,8,16].includes(r.substeps)||![1,4].includes(r.cycles)||
 [r.passive,r.fluidOff,r.audit].some(x=>x!==undefined&&typeof x!=='boolean'))throw new Error('Invalid matched benchmark request');
 const {reference}=matchedFixture(r.body),n=reference.ceiling.length;
 if(r.tape!==undefined&&(!Array.isArray(r.tape)||r.tape.length!==r.cycles*960||
 !r.tape.every(row=>Array.isArray(row)&&row.length===n&&row.every((v,j)=>Number.isFinite(v)&&Math.abs(v)<=reference.ceiling[j]*(1+1e-12)))||
 (r.passive&&r.tape.some(row=>row.some(x=>x!==0)))))throw new Error('Invalid matched benchmark tape');
 if(!r.tape&&!r.passive&&!(r.body==='paddles'&&r.law==='v3'&&r.integration==='explicit'&&r.substeps===4))
 throw new Error('Identical external tape required');
}
export function runMatchedBenchmark(r:MatchedRequest){
 validate(r);const {host,o,anchors,reference}=matchedFixture(r.body),n=o.joints.length,audit=r.audit!==false;
 const statePacket=()=>JSON.parse(JSON.stringify({...host.state,prng:host.state.prng.getState(),lineage:[...host.state.lineage]}));
 const initialState=statePacket(),initialNeural=JSON.stringify([o.neuralHidden,o.neuralOutputs]);
 const start=calculateOrganismCOM(o,'passive-work-v3'),initialEnergy=o.energy,initialQ=matchedAngles(o),initialAngle=o.segments.reduce((s,p)=>s+p.angle,0)/o.segments.length;
 const kinetic=()=>organismKineticEnergy(o,BASE_PART_DENSITY,'passive-work-v3');
 const initialK=kinetic();let tick=0,sub=0,held=new Array(n).fill(0),positiveJ=0,brakingJ=0,motorJ=0;
 let fluidPhysicalJ=0,fluidNumericalJ=0,fluidBalanceErrorJ=0,explicitDragWorkJ=0,dragPositiveWorkJ=0;
 let guardEvents=0,guardLossJ=0,maxOmega=0,maxAnchorPx=0,maxLimitRad=0,overspeedSteps=0;
 let limitedBatches=0,poseRepairs=0,energyLimited=0,saturatedCommands=0,torqueMismatch=0;
 let maxChemicalErrorJ=0,maxOverlapPx=0,maxSolverMomentumChange=0,maxSolverCOMShiftPx=0;
 let momentumBefore=[0,0],comBefore=[0,0];
 const angleMin=new Array(n).fill(Infinity),angleMax=new Array(n).fill(-Infinity),trackingSquares=new Array(n).fill(0);let samples=0;
 const tape:number[][]=[],trajectory:Array<{time:number;x:number;y:number;q:number[];target:number[];positiveJ:number;brakingJ:number;motorJ:number;angles:number[]}>=[];
 const cycles:Array<Record<string,unknown>>=[];let cycleStart={x:start.x,y:start.y},cyclePositive=0;
 const phases:Partial<Record<MechanicalPhase,{samples:number;netJ:number;addedJ:number;removedJ:number}>>={};
 const observe=(p:MechanicalPhase,b:number,a:number)=>{const v=phases[p]??={samples:0,netJ:0,addedJ:0,removedJ:0};v.samples++;v.netJ+=a-b;v.addedJ+=Math.max(0,a-b);v.removedJ+=Math.max(0,b-a);};
 const momentum=()=>o.segments.reduce((s,p,i)=>[s[0]+reference.parts[i].mass*p.vx,s[1]+reference.parts[i].mass*p.vy],[0,0]);
 const physics:PhysicsObserver=e=>{
  if(e.stage==='matched-drag'){explicitDragWorkJ+=e.workJ;dragPositiveWorkJ+=Math.max(0,e.workJ);}
  if(e.stage==='budget'){positiveJ+=e.positiveJ;brakingJ+=e.negativeJ;motorJ+=e.costJ;energyLimited+=Number(e.scale<1);}
  if(e.stage==='motor')torqueMismatch+=Number(e.requested!==e.applied);
  if(e.stage==='fluid'){fluidPhysicalJ+=e.physicalDissipationJ;fluidNumericalJ+=e.numericalDissipationJ;
   fluidBalanceErrorJ=Math.max(fluidBalanceErrorJ,Math.abs(e.beforeJ-e.afterJ-e.physicalDissipationJ-e.numericalDissipationJ));}
  if(e.stage==='guard'){guardEvents++;guardLossJ+=e.lossJ;}
  if(e.stage==='joint-batch'){limitedBatches+=Number(e.scale<1);poseRepairs+=Number(e.repairPose);}
  if(e.stage==='substep'){
   maxOmega=Math.max(maxOmega,e.maxOmega);maxAnchorPx=Math.max(maxAnchorPx,e.anchorPx);maxLimitRad=Math.max(maxLimitRad,e.limitRad);overspeedSteps+=Number(e.overspeedParts>0);
   const q=matchedAngles(o),target=targets(r.body,(tick+(sub+1)/r.substeps)/60);
   for(let j=0;j<n;j++){angleMin[j]=Math.min(angleMin[j],q[j]);angleMax[j]=Math.max(angleMax[j],q[j]);trackingSquares[j]+=(q[j]-target[j])**2;}samples++;
   for(let i=0;i<o.segments.length;i++)for(let j=i+1;j<o.segments.length;j++)maxOverlapPx=Math.max(maxOverlapPx,
    rectangleContact(o.segments[i],o.genome.parts[i],o.segments[j],o.genome.parts[j])?.depth??0);
  }
 };
 const trace:SolverTrace={detailed:false,begin(s){sub=s;},emit(e){
  if(e.stage==='after-guards'){momentumBefore=momentum();const c=calculateOrganismCOM(o,'passive-work-v3');comBefore=[c.x,c.y];}
  if(e.stage==='joint-accept'){const p=momentum();maxSolverMomentumChange=Math.max(maxSolverMomentumChange,Math.hypot(p[0]-momentumBefore[0],p[1]-momentumBefore[1]));}
  if(e.stage==='substep-end'){const c=calculateOrganismCOM(o,'passive-work-v3'),dt=1/(60*r.substeps);
   maxSolverCOMShiftPx=Math.max(maxSolverCOMShiftPx,Math.hypot(c.x-comBefore[0]-c.vxCOM*dt,c.y-comBefore[1]-c.vyCOM*dt));}
 }};
 const diagnostic:IntegrationDiagnostic={substeps:r.substeps,splitting:'motor-drag',matched:{version:'matched-drag-v1',law:r.law,integration:r.integration,fluidOff:r.fluidOff??false,anchors},
 outputs:new Map([[o.id,new Array(o.neuralOutputs.length).fill(0)]]),...(audit?{trace}:{}),torqueAt(_id,s){sub=s;const stride=r.substeps/4;
  if(s%stride===0){const index=tick*4+s/stride,target=targets(r.body,index/240),q=matchedAngles(o);
   if(r.tape)held=r.tape[index];else if(r.passive)held=new Array(n).fill(0);
   else held=target.map((desired,j)=>{const child=j+1,parent=o.genome.parts[child].parentIndex;
    const I=(reference.parts[child].inertia+reference.parts[parent].inertia)/2;
    const raw=I*(100*(desired-q[j])-20*(o.segments[child].angVel-o.segments[parent].angVel));
    saturatedCommands+=Number(Math.abs(raw)>reference.ceiling[j]);return Math.max(-reference.ceiling[j],Math.min(reference.ceiling[j],raw));});
   tape.push([...held]);}return held;}};
 const started=performance.now();
 for(tick=0;tick<r.cycles*240;tick++){
  host.tick(audit?observe:undefined,audit?physics:undefined,diagnostic);
  if(host.state.organisms.length!==1||o.dissolving||host.state.eggs.length)throw new Error('Matched fixture population changed');
  const c=calculateOrganismCOM(o,'passive-work-v3'),q=matchedAngles(o);
  maxChemicalErrorJ=Math.max(maxChemicalErrorJ,Math.abs(totalAccountedEnergy(host.state)-host.state.ledger.externalInflow));
  trajectory.push({time:(tick+1)/60,x:c.x-start.x,y:c.y-start.y,q,target:targets(r.body,(tick+1)/60),angles:o.segments.map(p=>p.angle),positiveJ,brakingJ,motorJ});
  if((tick+1)%240===0){const frames=trajectory.slice(tick+1-240),prev=trajectory[tick-240]?.q??initialQ;
   cycles.push({cycle:(tick+1)/240,x:c.x-start.x,y:c.y-start.y,dx:c.x-cycleStart.x,dy:c.y-cycleStart.y,q,
    positiveJ:positiveJ-cyclePositive,shapeAreaRad2:n===2?shapeLoopArea([prev,...frames.map(p=>p.q)]):null});
   cycleStart={x:c.x,y:c.y};cyclePositive=positiveJ;}
 }
 const runtimeMs=performance.now()-started,end=calculateOrganismCOM(o,'passive-work-v3'),finalK=kinetic();
 return {version:'matched-drag-v1',body:r.body,law:r.law,integration:r.integration,hz:r.substeps*60,cyclesRequested:r.cycles,passive:r.passive??false,fluidOff:r.fluidOff??false,
 runtimeMs,reference,initialState,finalState:statePacket(),brainUnchanged:initialNeural===JSON.stringify([o.neuralHidden,o.neuralOutputs]),
 displacementPx:Math.hypot(end.x-start.x,end.y-start.y),dx:end.x-start.x,dy:end.y-start.y,rotationRad:o.segments.reduce((s,p)=>s+p.angle,0)/o.segments.length-initialAngle,
 angleMin,angleMax,trackingRms:trackingSquares.map(x=>audit?Math.sqrt(x/samples):null),positiveJ,brakingJ,motorJ,
 ledgerMotorJ:host.state.ledger.mechanicalWorkHeat,reserveSpentJ:initialEnergy-o.energy,metabolicJ:host.state.ledger.metabolicDissipation,
 initialK,finalK,mechanicalResidualJ:audit?finalK-initialK-Object.values(phases).reduce((s,v)=>s+v.netJ,0):null,
 explicitDragWorkJ,dragPositiveWorkJ,fluidPhysicalJ,fluidNumericalJ,fluidBalanceErrorJ,guardEvents,guardLossJ,maxOmega,maxAnchorPx,maxLimitRad,overspeedSteps,
 limitedBatches,poseRepairs,energyLimited,saturatedCommands,torqueMismatch,maxChemicalErrorJ,maxOverlapPx,maxSolverMomentumChange,maxSolverCOMShiftPx,phases,trajectory,cycles,tape};
}
