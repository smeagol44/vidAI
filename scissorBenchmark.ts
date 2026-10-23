/** #80 private, brain-free fixture. No persistent setting, imported genome or live-world action. */
import {SimulationHost} from './simulationHost';
import {createInitialWorld,addExternalOrganism} from './world';
import {createFounderGenome} from './founders';
import {DEFAULT_SETTINGS,totalAccountedEnergy} from './persistence';
import {BASE_PART_DENSITY,calculateBodyCost,calculateMaxEnergyCapacity,calculateOrganismCOM,remapBrain,type SimulationSettings} from './simulation';
import {bodyMass,mechanicalJoules} from './foundationPhysics';
import {organismKineticEnergy,type MechanicalPhase} from './mechanicalObservation';
import {rectangleContact} from './contacts';
import type {IntegrationDiagnostic,PhysicsObserver} from './physicsObservation';
import type {SolverTrace} from './solverTrace';

export const SCISSOR = Object.freeze({version:'corner-scissor-v2' as const,width:1,height:7,
  closed:5*Math.PI/180,open:175*Math.PI/180,cycleSeconds:4,controlHz:240,kp:100,kd:20,
  seed:801,viscosity:.18,reserveJ:10000});
export type ScissorProgram='slow-open'|'reverse'|'symmetric'|'passive';
export interface ScissorRequest {
  version:'corner-scissor-v2';regime:'passive-work-v3'|'prism-resistance-v4';
  program:ScissorProgram;substeps:4|8|16;cycles:1|2|3|4;fluidOff?:boolean;heading?:0|180;
  /** Native240Hz requested torque tape; prevalidated before fixture creation. */
  tape?:number[];audit?:boolean;
}
export function scissorTarget(time:number,program:ScissorProgram) {
  const t=((time%4)+4)%4,openTime=program==='reverse'?.5:program==='symmetric'?1.75:3;
  const closeTime=3.5-openTime,span=SCISSOR.open-SCISSOR.closed;
  if(t<openTime)return {aperture:SCISSOR.closed+span*(1-Math.cos(Math.PI*t/openTime))/2,phase:'open'};
  if(t<3.5)return {aperture:SCISSOR.open-span*(1-Math.cos(Math.PI*(t-openTime)/closeTime))/2,phase:'close'};
  return {aperture:SCISSOR.closed,phase:'pause'};
}
export function scissorAperture(a:number,b:number) {return Math.PI+b-a;}
export function scissorFixture(regime:ScissorRequest['regime'],heading=0) {
  const settings:SimulationSettings={...DEFAULT_SETTINGS,physicsRegime:regime,ecologyRegime:undefined,
    targetNutrients:0,inflowRate:0,waterViscosity:SCISSOR.viscosity,gravity:0,mutationSeverity:0};
  const state=createInitialWorld(settings,SCISSOR.seed,'balanced','standard',0);
  // Only private artificial anatomy. No founder definition or public save validator is changed.
  const g=createFounderGenome('FND-001');g.id='BENCH-SCISSOR-1';g.name='Offline 1x7 scissor';
  g.parts=g.parts.slice(0,2).map((p,i)=>({...p,id:'BENCH-P'+i,parentIndex:i-1,attachmentPoint:'SOUTH',
    dimN:1/7,dimM:1,width:1,height:7,baseAngleOffset:i?-Math.PI/2:0,maxAngle:Math.PI/2,
    cpgAmp:0,cpgFreqMult:1,cpgPhaseOffset:0,oscillatorMix:0}));
  g.eyes=[];g.mouths=[];g.motorForce=0;g.motorFrequency=0;g.plasticityRate=0;g.sensoryPlasticityRate=0;
  g.maturityAge=1e6;g.bodyCost=calculateBodyCost(g.parts,[],[]);g.maxEnergyCapacity=calculateMaxEnergyCapacity(g.parts,g.storageTraitMultiplier);
  remapBrain(g);
  const o=addExternalOrganism(state,g,settings,1200,750,0)!;
  // Correct initial assembly only. Never set angles or translation during a run.
  o.energy=SCISSOR.reserveJ;state.ledger.externalInflow=o.energy+o.structuralBiomass;
  const h=heading*Math.PI/180,q=SCISSOR.closed-Math.PI;
  o.segments[0]={x:1200,y:750,vx:0,vy:0,angle:h,angVel:0};
  const a=o.segments[0],angle=h+q,c=Math.cos(angle),s=Math.sin(angle);
  const hx=a.x+Math.cos(h)*.5-Math.sin(h)*3.5,hy=a.y+Math.sin(h)*.5+Math.cos(h)*3.5;
  o.segments[1]={x:hx-c*.5-s*3.5,y:hy-s*.5+c*3.5,vx:0,vy:0,angle,angVel:0};
  const host=new SimulationHost();host.state=state;host.settings=settings;
  // This object deliberately cannot be passed to normal snapshot/reset: 1px widths
  // are outside the inherited7px anatomy grid, as are the external corner anchors.
  return {host,o,settings};
}
function validate(r:ScissorRequest) {
  if(!r||r.version!==SCISSOR.version||!['passive-work-v3','prism-resistance-v4'].includes(r.regime)||
    !['slow-open','reverse','symmetric','passive'].includes(r.program)||![4,8,16].includes(r.substeps)||
    ![1,2,3,4].includes(r.cycles)||(r.fluidOff!==undefined&&typeof r.fluidOff!=='boolean')||
    (r.audit!==undefined&&typeof r.audit!=='boolean')||(r.heading!==undefined&&![0,180].includes(r.heading)))
    throw new Error('Invalid scissor benchmark request');
  if(r.tape!==undefined&&(!Array.isArray(r.tape)||r.tape.length!==r.cycles*4*240||
    !r.tape.every(x=>Number.isFinite(x)&&Math.abs(x)<=2200*bodyMass({width:1,height:7,dimN:1/7,dimM:1} as Parameters<typeof bodyMass>[0],BASE_PART_DENSITY,r.regime)*50/12*(1+1e-12))||
    (r.program==='passive'&&r.tape.some(x=>x!==0))))throw new Error('Invalid scissor benchmark tape');
}
export function runScissorBenchmark(r:ScissorRequest) {
  validate(r);
  const {host,o,settings}=scissorFixture(r.regime,r.heading??0),audit=r.audit!==false;
  const mass=bodyMass(o.genome.parts[0],BASE_PART_DENSITY,r.regime),inertia=mass*50/12,ceiling=inertia*2200;
  const start=calculateOrganismCOM(o,r.regime),initialEnergy=o.energy,initialK=organismKineticEnergy(o,BASE_PART_DENSITY,r.regime);
  const initialNeural=JSON.stringify([o.neuralHidden,o.neuralOutputs]);
  let tick=0,sub=0,held=0,positiveJ=0,brakingJ=0,motorJ=0,fluidPhysicalJ=0,fluidNumericalJ=0,fluidBalanceErrorJ=0;
  let guardEvents=0,guardLossJ=0,maxOmega=0,maxAnchorPx=0,maxLimitRad=0,postGuardOverspeedSteps=0;
  let limitedBatches=0,poseRepairs=0,energyLimited=0,saturatedCommands=0,torqueMismatch=0;
  let maxChemicalErrorJ=0,maxOverlapPx=0,maxConstraintDeltaOmega=0,maxSolverMomentumChange=0,maxSolverCOMShiftPx=0;
  let momentumBefore=[0,0],comBefore=[0,0],angleMin=Infinity,angleMax=-Infinity;
  let sampleMin=Infinity,sampleMax=-Infinity,sampleError=0;
  const tape:number[]=[],trajectory:Array<Record<string,unknown>>=[],cycles:Array<Record<string,unknown>>=[];
  let cycleStart={x:start.x,y:start.y},cyclePositive=0;
  const phases:Partial<Record<MechanicalPhase,{samples:number;netJ:number;addedJ:number;removedJ:number}>>={};
  const observe=(p:MechanicalPhase,b:number,a:number)=>{const v=phases[p]??={samples:0,netJ:0,addedJ:0,removedJ:0};v.samples++;v.netJ+=a-b;v.addedJ+=Math.max(0,a-b);v.removedJ+=Math.max(0,b-a);};
  const momentum=()=>[mass*(o.segments[0].vx+o.segments[1].vx),mass*(o.segments[0].vy+o.segments[1].vy)];
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
      const ap=scissorAperture(o.segments[0].angle,o.segments[1].angle);angleMin=Math.min(angleMin,ap);angleMax=Math.max(angleMax,ap);
      sampleMin=Math.min(sampleMin,ap);sampleMax=Math.max(sampleMax,ap);
      sampleError=Math.max(sampleError,Math.abs(ap-scissorTarget((tick+(sub+1)/r.substeps)/60,r.program).aperture));
      const contact=rectangleContact(o.segments[0],o.genome.parts[0],o.segments[1],o.genome.parts[1]);
      maxOverlapPx=Math.max(maxOverlapPx,contact?.depth??0);
    }
  };
  const trace:SolverTrace={detailed:false,begin(s){sub=s;},emit(e){
    if(e.stage==='after-guards'){momentumBefore=momentum();const c=calculateOrganismCOM(o,r.regime);comBefore=[c.x,c.y];}
    if(e.stage==='joint-accept'){const p=momentum();maxSolverMomentumChange=Math.max(maxSolverMomentumChange,Math.hypot(p[0]-momentumBefore[0],p[1]-momentumBefore[1]));}
    if(e.stage==='substep-end'){
      // Compare COM after pose/projection/integration with pure velocity integration.
      const c=calculateOrganismCOM(o,r.regime),dt=1/(60*r.substeps);
      maxSolverCOMShiftPx=Math.max(maxSolverCOMShiftPx,Math.hypot(c.x-comBefore[0]-c.vxCOM*dt,c.y-comBefore[1]-c.vyCOM*dt));
    }
  }};
  const diagnostic:IntegrationDiagnostic={substeps:r.substeps,splitting:'motor-drag',scissor:{version:SCISSOR.version,fluidOff:r.fluidOff??false},
    outputs:new Map([[o.id,new Array(o.neuralOutputs.length).fill(0)]]),...(audit?{trace}:{}),
    torqueAt(_id,s){sub=s;const stride=r.substeps/4;
      if(s%stride===0){const index=tick*4+s/stride,target=scissorTarget(index/240,r.program);
        if(r.tape)held=r.tape[index];else if(r.program==='passive'||target.phase==='pause')held=0;
        else {const aperture=scissorAperture(o.segments[0].angle,o.segments[1].angle),speed=o.segments[1].angVel-o.segments[0].angVel;
          const raw=inertia*(SCISSOR.kp*(target.aperture-aperture)-SCISSOR.kd*speed);
          saturatedCommands+=Number(Math.abs(raw)>ceiling);held=Math.max(-ceiling,Math.min(ceiling,raw));}
        tape.push(held);
      }return [held];}
  };
  const started=performance.now();
  for(tick=0;tick<r.cycles*240;tick++){
    sampleMin=Infinity;sampleMax=-Infinity;sampleError=0;
    host.tick(audit?observe:undefined,audit?physics:undefined,diagnostic);
    if(host.state.organisms.length!==1||o.dissolving||host.state.eggs.length)throw new Error('Scissor fixture population changed');
    const c=calculateOrganismCOM(o,r.regime),ap=scissorAperture(o.segments[0].angle,o.segments[1].angle);
    maxChemicalErrorJ=Math.max(maxChemicalErrorJ,Math.abs(totalAccountedEnergy(host.state)-host.state.ledger.externalInflow));
    trajectory.push({time:(tick+1)/60,x:c.x-start.x,y:c.y-start.y,vx:c.vxCOM,vy:c.vyCOM,
      aperture:ap,angle0:o.segments[0].angle,angle1:o.segments[1].angle,
      requestedAperture:scissorTarget((tick+1)/60,r.program).aperture,
      tickMinAperture:audit?sampleMin:ap,tickMaxAperture:audit?sampleMax:ap,maxTargetError:audit?sampleError:null,
      positiveJ,motorJ,energy:o.energy});
    if((tick+1)%240===0){cycles.push({cycle:(tick+1)/240,x:c.x-start.x,y:c.y-start.y,dx:c.x-cycleStart.x,dy:c.y-cycleStart.y,
      positiveJ:positiveJ-cyclePositive,aperture:ap});cycleStart={x:c.x,y:c.y};cyclePositive=positiveJ;}
  }
  const runtimeMs=performance.now()-started,end=calculateOrganismCOM(o,r.regime),finalK=organismKineticEnergy(o,BASE_PART_DENSITY,r.regime);
  // Exact ephemeral state receipt, deliberately WITHOUT a public save schema.
  const stateReceipt={version:SCISSOR.version,request:{...r,tape:undefined,audit:undefined},state:JSON.parse(JSON.stringify({...host.state,
    prng:host.state.prng.getState(),lineage:[...host.state.lineage]}))};
  return {version:SCISSOR.version,regime:r.regime,program:r.program,hz:r.substeps*60,cyclesRequested:r.cycles,fluidOff:r.fluidOff??false,heading:r.heading??0,
    runtimeMs,massUnits:mass,inertiaUnits:inertia,joulesPerMechanicalUnit:mechanicalJoules(r.regime),ceiling,
    brainUnchanged:initialNeural===JSON.stringify([o.neuralHidden,o.neuralOutputs]),
    displacementPx:Math.hypot(end.x-start.x,end.y-start.y),dx:end.x-start.x,dy:end.y-start.y,
    rotationRad:(o.segments[0].angle+o.segments[1].angle)/2-((r.heading??0)*Math.PI/180+(SCISSOR.closed-Math.PI)/2),
    angleMin,angleMax,positiveJ,brakingJ,motorJ,ledgerMotorJ:host.state.ledger.mechanicalWorkHeat,
    reserveSpentJ:initialEnergy-o.energy,metabolicJ:host.state.ledger.metabolicDissipation,
    initialK,finalK,mechanicalResidualJ:audit?finalK-initialK-Object.values(phases).reduce((s,v)=>s+v.netJ,0):null,
    fluidPhysicalJ,fluidNumericalJ,fluidBalanceErrorJ,guardEvents,guardLossJ,maxOmega,maxAnchorPx,maxLimitRad,postGuardOverspeedSteps,
    limitedBatches,poseRepairs,energyLimited,saturatedCommands,torqueMismatch,maxChemicalErrorJ,maxOverlapPx,
    maxConstraintDeltaOmega,maxSolverMomentumChange,maxSolverCOMShiftPx,phases,trajectory,cycles,tape,stateReceipt};
}
