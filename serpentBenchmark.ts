/** #80 private three-part fixture, independently actuated at two hinges. */
import {SimulationHost} from './simulationHost';
import {createInitialWorld,addExternalOrganism} from './world';
import {createFounderGenome} from './founders';
import {DEFAULT_SETTINGS,totalAccountedEnergy} from './persistence';
import {BASE_PART_DENSITY,calculateBodyCost,calculateMaxEnergyCapacity,calculateOrganismCOM,remapBrain,type SimulationSettings,type Organism} from './simulation';
import {bodyMass,mechanicalJoules} from './foundationPhysics';
import {organismKineticEnergy,type MechanicalPhase} from './mechanicalObservation';
import {rectangleContact} from './contacts';
import type {IntegrationDiagnostic,PhysicsObserver} from './physicsObservation';
import type {SolverTrace} from './solverTrace';

export const SERPENT=Object.freeze({version:'corner-serpent-v1' as const,width:1,height:7,
  amplitude:Math.PI/6,phaseDelay:Math.PI/2,period:4,startupSeconds:4,controlHz:240,
  kp:100,kd:20,seed:801,viscosity:.18,reserveJ:10000});
export type SerpentProgram='traveling'|'reverse'|'reciprocal'|'passive';
export interface SerpentRequest {
  version:'corner-serpent-v1';regime:'passive-work-v3'|'prism-resistance-v4';
  program:SerpentProgram;substeps:4|8|16;cycles:1|2|3|4;fluidOff?:boolean;heading?:0|180;
  tape?:number[][];audit?:boolean;
}
export function serpentTarget(time:number,program:SerpentProgram):[number,number] {
  if(program==='passive')return [0,0];
  const envelope=time>=SERPENT.startupSeconds?1:Math.sin(Math.PI/2*Math.max(0,time)/SERPENT.startupSeconds)**2;
  const phase=(program==='reverse'?-1:1)*2*Math.PI*time/SERPENT.period;
  return [SERPENT.amplitude*envelope*Math.sin(phase),
    SERPENT.amplitude*envelope*Math.sin(phase-(program==='reciprocal'?0:SERPENT.phaseDelay))];
}
export function serpentAngles(o:Organism):[number,number] {
  return [o.segments[1].angle-o.segments[0].angle,o.segments[2].angle-o.segments[1].angle];
}
/** Initial assembly only, also used by static geometry tests. Never called during stepping. */
export function assembleSerpent(o:Organism,q:readonly[number,number]=[0,0],heading=0) {
  o.segments[0]={x:1200,y:750,vx:0,vy:0,angle:heading*Math.PI/180,angVel:0};
  for(let i=1;i<3;i++){
    const a=o.segments[i-1],angle=a.angle+q[i-1],c=Math.cos(angle),s=Math.sin(angle);
    const hx=a.x+Math.cos(a.angle)*.5-Math.sin(a.angle)*3.5;
    const hy=a.y+Math.sin(a.angle)*.5+Math.cos(a.angle)*3.5;
    o.segments[i]={x:hx+c*.5-s*3.5,y:hy+s*.5+c*3.5,vx:0,vy:0,angle,angVel:0};
  }
}
export function serpentFixture(regime:SerpentRequest['regime'],heading=0) {
  const settings:SimulationSettings={...DEFAULT_SETTINGS,physicsRegime:regime,ecologyRegime:undefined,
    targetNutrients:0,inflowRate:0,waterViscosity:SERPENT.viscosity,gravity:0,mutationSeverity:0};
  const state=createInitialWorld(settings,SERPENT.seed,'balanced','standard',0);
  const g=createFounderGenome('FND-001');g.id='BENCH-SERPENT-1';g.name='Offline 1x7 two-joint serpent';
  const prototype=g.parts[0];
  g.parts=Array.from({length:3},(_,i)=>({...prototype,id:'BENCH-P'+i,parentIndex:i-1,attachmentPoint:'SOUTH',
    dimN:1/7,dimM:1,width:1,height:7,baseAngleOffset:0,maxAngle:Math.PI/2,
    cpgAmp:0,cpgFreqMult:1,cpgPhaseOffset:0,oscillatorMix:0}));
  g.eyes=[];g.mouths=[];g.motorForce=0;g.motorFrequency=0;g.plasticityRate=0;g.sensoryPlasticityRate=0;
  g.maturityAge=1e6;g.bodyCost=calculateBodyCost(g.parts,[],[]);g.maxEnergyCapacity=calculateMaxEnergyCapacity(g.parts,g.storageTraitMultiplier);
  remapBrain(g);
  const o=addExternalOrganism(state,g,settings,1200,750,0)!;
  o.energy=SERPENT.reserveJ;state.ledger.externalInflow=o.energy+o.structuralBiomass;
  assembleSerpent(o,[0,0],heading);
  const host=new SimulationHost();host.state=state;host.settings=settings;
  // Not a normal genome/save: sub-grid width and external corner anchors are explicit.
  return {host,o,settings};
}
function validate(r:SerpentRequest) {
  if(!r||r.version!==SERPENT.version||!['passive-work-v3','prism-resistance-v4'].includes(r.regime)||
    !['traveling','reverse','reciprocal','passive'].includes(r.program)||![4,8,16].includes(r.substeps)||
    ![1,2,3,4].includes(r.cycles)||(r.fluidOff!==undefined&&typeof r.fluidOff!=='boolean')||
    (r.audit!==undefined&&typeof r.audit!=='boolean')||(r.heading!==undefined&&![0,180].includes(r.heading)))
    throw new Error('Invalid serpent benchmark request');
  const ceiling=2200*bodyMass({width:1,height:7,dimN:1/7,dimM:1} as Parameters<typeof bodyMass>[0],BASE_PART_DENSITY,r.regime)*50/12;
  if(r.tape!==undefined&&(!Array.isArray(r.tape)||r.tape.length!==r.cycles*SERPENT.period*240||
    !r.tape.every(row=>Array.isArray(row)&&row.length===2&&row.every(x=>Number.isFinite(x)&&Math.abs(x)<=ceiling*(1+1e-12)))||
    (r.program==='passive'&&r.tape.some(row=>row.some(x=>x!==0)))))throw new Error('Invalid serpent benchmark tape');
}
export function shapeLoopArea(points:readonly(readonly number[])[]) {
  return points.reduce((s,p,i)=>{const n=points[(i+1)%points.length];return s+.5*(p[0]*n[1]-p[1]*n[0]);},0);
}
export function runSerpentBenchmark(r:SerpentRequest) {
  validate(r);
  const {host,o}=serpentFixture(r.regime,r.heading??0),audit=r.audit!==false;
  const mass=bodyMass(o.genome.parts[0],BASE_PART_DENSITY,r.regime),inertia=mass*50/12,ceiling=inertia*2200;
  const start=calculateOrganismCOM(o,r.regime),initialEnergy=o.energy,initialK=organismKineticEnergy(o,BASE_PART_DENSITY,r.regime);
  const initialNeural=JSON.stringify([o.neuralHidden,o.neuralOutputs]);
  let tick=0,sub=0,positiveJ=0,brakingJ=0,motorJ=0,fluidPhysicalJ=0,fluidNumericalJ=0,fluidBalanceErrorJ=0;
  let guardEvents=0,guardLossJ=0,maxOmega=0,maxAnchorPx=0,maxLimitRad=0,postGuardOverspeedSteps=0;
  let limitedBatches=0,poseRepairs=0,energyLimited=0,saturatedCommands=0,torqueMismatch=0;
  let maxChemicalErrorJ=0,maxOverlapPx=0,maxConstraintDeltaOmega=0,maxSolverMomentumChange=0,maxSolverCOMShiftPx=0;
  let momentumBefore=[0,0],comBefore=[0,0],held=[0,0];
  const angleMin=[Infinity,Infinity],angleMax=[-Infinity,-Infinity];
  const trackingSquares=[0,0],trackingMax=[0,0];let trackingSamples=0;
  const tape:number[][]=[],trajectory:Array<{time:number;x:number;y:number;vx:number;vy:number;q:number[];target:number[];angles:number[];positiveJ:number;brakingJ:number;motorJ:number;energy:number}>=[];
  const cycles:Array<Record<string,unknown>>=[];let cycleStart={x:start.x,y:start.y},cyclePositive=0;
  const phases:Partial<Record<MechanicalPhase,{samples:number;netJ:number;addedJ:number;removedJ:number}>>={};
  const observe=(p:MechanicalPhase,b:number,a:number)=>{const v=phases[p]??={samples:0,netJ:0,addedJ:0,removedJ:0};v.samples++;v.netJ+=a-b;v.addedJ+=Math.max(0,a-b);v.removedJ+=Math.max(0,b-a);};
  const momentum=()=>[mass*o.segments.reduce((s,p)=>s+p.vx,0),mass*o.segments.reduce((s,p)=>s+p.vy,0)];
  const physics:PhysicsObserver=e=>{
    if(e.stage==='budget'){positiveJ+=e.positiveJ;brakingJ+=e.negativeJ;motorJ+=e.costJ;energyLimited+=Number(e.scale<1);}
    if(e.stage==='motor')torqueMismatch+=Number(e.requested!==e.applied);
    if(e.stage==='fluid'){fluidPhysicalJ+=e.physicalDissipationJ;fluidNumericalJ+=e.numericalDissipationJ;
      fluidBalanceErrorJ=Math.max(fluidBalanceErrorJ,Math.abs(e.beforeJ-e.afterJ-e.physicalDissipationJ-e.numericalDissipationJ));}
    if(e.stage==='guard'){guardEvents++;guardLossJ+=e.lossJ;}
    if(e.stage==='joint-batch'){limitedBatches+=Number(e.scale<1);poseRepairs+=Number(e.repairPose);}
    if(e.stage==='constraint')maxConstraintDeltaOmega=Math.max(maxConstraintDeltaOmega,Math.abs(e.deltaOmega));
    if(e.stage==='substep'){
      maxOmega=Math.max(maxOmega,e.maxOmega);maxAnchorPx=Math.max(maxAnchorPx,e.anchorPx);maxLimitRad=Math.max(maxLimitRad,e.limitRad);
      postGuardOverspeedSteps+=Number(e.overspeedParts>0);
      const q=serpentAngles(o),target=serpentTarget((tick+(sub+1)/r.substeps)/60,r.program);
      for(let j=0;j<2;j++){angleMin[j]=Math.min(angleMin[j],q[j]);angleMax[j]=Math.max(angleMax[j],q[j]);
        trackingSquares[j]+=(q[j]-target[j])**2;trackingMax[j]=Math.max(trackingMax[j],Math.abs(q[j]-target[j]));}trackingSamples++;
      for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)maxOverlapPx=Math.max(maxOverlapPx,
        rectangleContact(o.segments[i],o.genome.parts[i],o.segments[j],o.genome.parts[j])?.depth??0);
    }
  };
  const trace:SolverTrace={detailed:false,begin(s){sub=s;},emit(e){
    if(e.stage==='after-guards'){momentumBefore=momentum();const c=calculateOrganismCOM(o,r.regime);comBefore=[c.x,c.y];}
    if(e.stage==='joint-accept'){const p=momentum();maxSolverMomentumChange=Math.max(maxSolverMomentumChange,Math.hypot(p[0]-momentumBefore[0],p[1]-momentumBefore[1]));}
    if(e.stage==='substep-end'){const c=calculateOrganismCOM(o,r.regime),dt=1/(60*r.substeps);
      maxSolverCOMShiftPx=Math.max(maxSolverCOMShiftPx,Math.hypot(c.x-comBefore[0]-c.vxCOM*dt,c.y-comBefore[1]-c.vyCOM*dt));}
  }};
  const diagnostic:IntegrationDiagnostic={substeps:r.substeps,splitting:'motor-drag',serpent:{version:SERPENT.version,fluidOff:r.fluidOff??false},
    outputs:new Map([[o.id,new Array(o.neuralOutputs.length).fill(0)]]),...(audit?{trace}:{}),
    torqueAt(_id,s){sub=s;const stride=r.substeps/4;
      if(s%stride===0){const index=tick*4+s/stride,target=serpentTarget(index/240,r.program),q=serpentAngles(o);
        if(r.tape)held=r.tape[index];else if(r.program==='passive')held=[0,0];
        else held=target.map((desired,j)=>{
          const speed=o.segments[j+1].angVel-o.segments[j].angVel;
          const raw=inertia*(SERPENT.kp*(desired-q[j])-SERPENT.kd*speed);
          saturatedCommands+=Number(Math.abs(raw)>ceiling);return Math.max(-ceiling,Math.min(ceiling,raw));});
        tape.push([...held]);
      }return held;}
  };
  const started=performance.now();
  for(tick=0;tick<r.cycles*240;tick++){
    host.tick(audit?observe:undefined,audit?physics:undefined,diagnostic);
    if(host.state.organisms.length!==1||o.dissolving||host.state.eggs.length)throw new Error('Serpent fixture population changed');
    const c=calculateOrganismCOM(o,r.regime),q=serpentAngles(o);
    maxChemicalErrorJ=Math.max(maxChemicalErrorJ,Math.abs(totalAccountedEnergy(host.state)-host.state.ledger.externalInflow));
    trajectory.push({time:(tick+1)/60,x:c.x-start.x,y:c.y-start.y,vx:c.vxCOM,vy:c.vyCOM,q,
      target:serpentTarget((tick+1)/60,r.program),angles:o.segments.map(p=>p.angle),positiveJ,brakingJ,motorJ,energy:o.energy});
    if((tick+1)%240===0){const frames=trajectory.slice(tick+1-240),previous=trajectory[tick-240]?.q??[0,0];
      cycles.push({cycle:(tick+1)/240,x:c.x-start.x,y:c.y-start.y,dx:c.x-cycleStart.x,dy:c.y-cycleStart.y,
        positiveJ:positiveJ-cyclePositive,q,
        minQ:[0,1].map(j=>Math.min(...frames.map(v=>v.q[j]))),maxQ:[0,1].map(j=>Math.max(...frames.map(v=>v.q[j]))),
        shapeAreaRad2:shapeLoopArea([previous,...frames.map(v=>v.q)]),shapeClosureRad:Math.hypot(q[0]-previous[0],q[1]-previous[1])});
      cycleStart={x:c.x,y:c.y};cyclePositive=positiveJ;}
  }
  const runtimeMs=performance.now()-started,end=calculateOrganismCOM(o,r.regime),finalK=organismKineticEnergy(o,BASE_PART_DENSITY,r.regime);
  const stateReceipt={version:SERPENT.version,request:{...r,tape:undefined,audit:undefined},state:JSON.parse(JSON.stringify({...host.state,
    prng:host.state.prng.getState(),lineage:[...host.state.lineage]}))};
  return {version:SERPENT.version,regime:r.regime,program:r.program,hz:r.substeps*60,cyclesRequested:r.cycles,fluidOff:r.fluidOff??false,heading:r.heading??0,
    runtimeMs,massUnits:mass,inertiaUnits:inertia,joulesPerMechanicalUnit:mechanicalJoules(r.regime),ceiling,
    brainUnchanged:initialNeural===JSON.stringify([o.neuralHidden,o.neuralOutputs]),
    displacementPx:Math.hypot(end.x-start.x,end.y-start.y),dx:end.x-start.x,dy:end.y-start.y,
    rotationRad:o.segments.reduce((s,p)=>s+p.angle,0)/3-(r.heading??0)*Math.PI/180,
    angleMin,angleMax,trackingRms:trackingSquares.map(x=>audit?Math.sqrt(x/trackingSamples):null),trackingMax,
    positiveJ,brakingJ,motorJ,ledgerMotorJ:host.state.ledger.mechanicalWorkHeat,
    reserveSpentJ:initialEnergy-o.energy,metabolicJ:host.state.ledger.metabolicDissipation,
    initialK,finalK,mechanicalResidualJ:audit?finalK-initialK-Object.values(phases).reduce((s,v)=>s+v.netJ,0):null,
    fluidPhysicalJ,fluidNumericalJ,fluidBalanceErrorJ,guardEvents,guardLossJ,maxOmega,maxAnchorPx,maxLimitRad,postGuardOverspeedSteps,
    limitedBatches,poseRepairs,energyLimited,saturatedCommands,torqueMismatch,maxChemicalErrorJ,maxOverlapPx,
    maxConstraintDeltaOmega,maxSolverMomentumChange,maxSolverCOMShiftPx,phases,trajectory,cycles,tape,stateReceipt};
}
