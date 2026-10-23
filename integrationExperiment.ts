import type {SolverTraceEvent,SolverTrace} from './solverTrace';
/** Paused offline diagnostic. No saved integrator setting or controller semantics.
 * A captured native 60Hz neural / 240Hz bounded torque tape is externally replayed.
 * The live brain/learning still runs; only local actuator inputs use the tape. */
import type {SimulationHost} from './simulationHost';
import type {IntegrationDiagnostic, PhysicsObserver} from './physicsObservation';
import {calculateOrganismCOM, BASE_PART_DENSITY} from './simulation';
import {bodyMass, mechanicalJoules} from './foundationPhysics';
import {totalAccountedEnergy} from './persistence';

interface CommandFrame {id:string;outputs:number[];torques:number[][]}
export interface CommandTape {
  version:'prism-held-torque-1';startTime:number;controlHz:60;torqueHz:240;
  topology:Array<{id:string;outputs:string[];parts:number}>;
  frames:CommandFrame[][];
}
export interface IntegrationRequest {
  ticks:number;substeps:number;splitting:IntegrationDiagnostic['splitting'];
  tape?:CommandTape;offset?:number;probe?:boolean;
  jointLimits?:'unilateral-stop-v1';
  solverTrace?:{mode:'scan'}|{mode:'window';startTime:number;endTime:number};
}
const methods=['motor-drag','motor-half-half','half-motor-half'];
function validate(host:SimulationHost,r:IntegrationRequest) {
  const bad=()=>{throw new Error('Invalid integration experiment request/tape');};
  if(!r||typeof r!=='object'||host.state.organisms.length!==1||host.state.organisms[0].dissolving||
    host.state.organisms[0].joints.length<1||host.state.eggs.length>0||host.running||host.settings.physicsRegime!=='prism-resistance-v4'||!Number.isInteger(r.ticks)||r.ticks<1||r.ticks>300||
    ![4,8,16,32,64].includes(r.substeps)||!methods.includes(r.splitting)||
    (r.probe!==undefined&&typeof r.probe!=='boolean')||(r.probe&&r.ticks>60))bad();
  if(r.jointLimits!==undefined&&(r.jointLimits!=='unilateral-stop-v1'||!r.tape||r.ticks>60||
    ![32,64].includes(r.substeps)||r.splitting!=='motor-drag'))bad();
  if(r.solverTrace) {
    const trace=r.solverTrace,begin=(r.tape?.startTime??0)+(r.offset??0)/60,finish=begin+r.ticks/60;
    if(!r.tape||r.ticks>60||![32,64].includes(r.substeps)||r.splitting!=='motor-drag'||!['scan','window'].includes(trace.mode))bad();
    if(trace.mode==='window'&&(!Number.isFinite(trace.startTime)||!Number.isFinite(trace.endTime)||
      trace.startTime<begin-1e-12||trace.endTime>finish+1e-12||trace.endTime<=trace.startTime||trace.endTime-trace.startTime>4/60+1e-12))bad();
  }
  if(!r.tape) {if(r.substeps!==4||r.splitting!=='motor-drag'||(r.offset??0)!==0)bad();return;}
  const t=r.tape,offset=r.offset??0,orgs=host.state.organisms.filter(o=>!o.dissolving);
  if(t.version!=='prism-held-torque-1'||t.controlHz!==60||t.torqueHz!==240||!Number.isFinite(t.startTime)||
    !Number.isInteger(offset)||offset<0||!Array.isArray(t.frames)||t.frames.length>300||offset+r.ticks>t.frames.length||
    Math.abs(host.state.simTime-t.startTime-offset/60)>1e-10||!Array.isArray(t.topology)||t.topology.length!==orgs.length)bad();
  for(let i=0;i<orgs.length;i++) {
    const o=orgs[i],top=t.topology[i];
    if(!top||top.id!==o.id||top.parts!==o.segments.length||JSON.stringify(top.outputs)!==JSON.stringify(o.genome.outputKeys))bad();
  }
  // Validate every requested frame before advancing any state, including capacity.
  for(const frames of t.frames.slice(offset,offset+r.ticks)) {
    if(!Array.isArray(frames)||frames.length!==orgs.length)bad();
    for(let i=0;i<orgs.length;i++) {
      const o=orgs[i],f=frames[i],n=o.joints.length;
      if(!f||f.id!==o.id||!Array.isArray(f.outputs)||f.outputs.length!==o.neuralOutputs.length||
        !f.outputs.every(x=>Number.isFinite(x)&&Math.abs(x)<=1)||!Array.isArray(f.torques)||f.torques.length!==4)bad();
      for(const row of f.torques) {
        if(!Array.isArray(row)||row.length!==n||!row.every(Number.isFinite))bad();
        for(let j=0;j<n;j++) {
          const d=o.genome.parts[j+1],p=o.genome.parts[d.parentIndex];
          const inertia=(a:typeof d)=>bodyMass(a,BASE_PART_DENSITY,'prism-resistance-v4')*(a.width*a.width+a.height*a.height)/12;
          const max=(inertia(d)+inertia(p))*.5*2200*Math.max(.5,Math.min(1.6,1+f.outputs[j*6+2]*.4));
          if(Math.abs(row[j])>max*(1+1e-12))bad();
        }
      }
    }
  }
}
export function runIntegrationExperiment(host:SimulationHost,request:IntegrationRequest) {
  validate(host,request);
  const {ticks,substeps,splitting}=request,offset=request.offset??0;
  const source=host.state.organisms.filter(o=>!o.dissolving);
  const tape:CommandTape=request.tape??{version:'prism-held-torque-1',startTime:host.state.simTime,controlHz:60,torqueHz:240,
    topology:source.map(o=>({id:o.id,outputs:[...o.genome.outputKeys!],parts:o.segments.length})),frames:[]};
  const initial=source.map(o=>({id:o.id,com:calculateOrganismCOM(o,host.settings.physicsRegime),energy:o.energy}));
  const trajectory:Array<Array<{id:string;x:number;y:number;angle:number}>>=[];
  let positiveJ=0,brakingJ=0,motorJ=0,fluidPhysicalJ=0,fluidNumericalJ=0,fluidBalanceErrorJ=0,guardLossJ=0;
  let partSeconds=0,angularGuardSeconds=0,linearGuardSeconds=0,postContactOverspeedSeconds=0,guardEvents=0;
  let maxAnchorPx=0,maxLimitRad=0,maxPostContactOmega=0,maxConstraintOmega=0,maxConstraintDeltaV=0,maxConstraintDeltaOmega=0;
  let constraintLossJ=0,constraintGainJ=0,contactLossJ=0,contactGainJ=0,energyLimited=0,maxChemicalErrorJ=0,requests=0,mismatches=0;
  let signedTorqueImpulse=0,absoluteTorqueImpulse=0,maxNewtonIterations=0,finite=true;
  let current:CommandFrame[]=[];
  let jointBatches=0,jointLimited=0,poseRepairs=0,minScale=1,maxBias=0,maxAngularBias=0;
  const probe:Array<{tick:number;limited:number;repairs:number;minScale:number;maxBias:number;maxAngularBias:number}>=[];
  let tickLimited=0,tickRepairs=0,tickMinScale=1,tickMaxBias=0,tickMaxAngularBias=0;
  const observer:PhysicsObserver=r=>{
    if(request.solverTrace&&trace.detailed&&['fluid','budget','motor','guard'].includes(r.stage))
      trace.emit(Object.freeze({...r,stage:'physics-'+r.stage}));
    if(r.stage==='joint-batch') {
      jointBatches++;jointLimited+=Number(r.scale<1);poseRepairs+=Number(r.repairPose);
      minScale=Math.min(minScale,r.scale);maxBias=Math.max(maxBias,r.maxBias);maxAngularBias=Math.max(maxAngularBias,r.maxAngularBias);
      tickLimited+=Number(r.scale<1);tickRepairs+=Number(r.repairPose);tickMinScale=Math.min(tickMinScale,r.scale);
      tickMaxBias=Math.max(tickMaxBias,r.maxBias);tickMaxAngularBias=Math.max(tickMaxAngularBias,r.maxAngularBias);
    }else if(r.stage==='motor') {
      requests++;mismatches+=Number(r.requested!==r.applied);
      signedTorqueImpulse+=r.requested*r.dt;absoluteTorqueImpulse+=Math.abs(r.requested)*r.dt;
      if(!request.tape) {
        const f=current.find(f=>f.id===r.id)!;
        if(r.joint===0)f.torques.push([]);
        f.torques[f.torques.length-1].push(r.requested);
      }
    }else if(r.stage==='budget') {
      positiveJ+=r.positiveJ;brakingJ+=r.negativeJ;motorJ+=r.costJ;energyLimited+=Number(r.scale<1);
    }else if(r.stage==='fluid') {
      fluidPhysicalJ+=r.physicalDissipationJ;fluidNumericalJ+=r.numericalDissipationJ;
      fluidBalanceErrorJ=Math.max(fluidBalanceErrorJ,Math.abs(r.beforeJ-r.afterJ-r.physicalDissipationJ-r.numericalDissipationJ));
      maxNewtonIterations=Math.max(maxNewtonIterations,r.iterations);
    }else if(r.stage==='guard') {
      guardEvents++;angularGuardSeconds+=r.dt*Number(Math.abs(r.omega)>20);linearGuardSeconds+=r.dt*Number(r.speed>400);guardLossJ+=r.lossJ;
    }else if(r.stage==='constraint') {
      maxConstraintOmega=Math.max(maxConstraintOmega,Math.abs(r.afterOmega));
      maxConstraintDeltaV=Math.max(maxConstraintDeltaV,r.deltaV);maxConstraintDeltaOmega=Math.max(maxConstraintDeltaOmega,Math.abs(r.deltaOmega));
    }else if(r.stage==='substep') {
      partSeconds+=r.dt*r.parts;postContactOverspeedSeconds+=r.dt*r.overspeedParts;
      maxAnchorPx=Math.max(maxAnchorPx,r.anchorPx);maxLimitRad=Math.max(maxLimitRad,r.limitRad);maxPostContactOmega=Math.max(maxPostContactOmega,r.maxOmega);
    }
  };
  const traceSteps:Array<Record<string,unknown>>=[],traceEvents:Array<Record<string,unknown>>=[];
  let traceStep:Record<string,unknown>={},traceTick=0,traceSub=0;
  let firstContact:Record<string,unknown>|undefined,firstOverspeed:Record<string,unknown>|undefined,firstLimited:Record<string,unknown>|undefined,firstRepair:Record<string,unknown>|undefined;
  const timing=()=>({tick:offset+traceTick,substep:traceSub,hz:substeps*60,
    startTime:tape.startTime+(offset+traceTick)/60+traceSub/(60*substeps),
    endTime:tape.startTime+(offset+traceTick)/60+(traceSub+1)/(60*substeps)});
  const detail=()=>{const s=request.solverTrace,t=timing();return s?.mode==='window'&&t.endTime>s.startTime+1e-12&&t.startTime<s.endTime-1e-12;};
  const trace:SolverTrace={
    get detailed(){return detail();},
    begin(sub){traceSub=sub;traceStep={...timing(),contacts:[],projections:0};},
    emit(e:Readonly<SolverTraceEvent>) {
      const packet={...timing(),...e};
      if(detail())traceEvents.push(packet);
      if(e.stage==='contact-impulse') {
        (traceStep.contacts as unknown[]).push([e.a,e.b]);firstContact??=packet;
      }
      if(e.stage==='joint-accept') {
        traceStep.jointOmega=e.maxOmega;traceStep.scale=e.scale;
        if(Number(e.scale)<1)firstLimited??=packet;
        if(e.repairPose)firstRepair??=packet;
      }
      if(e.stage==='after-guards')traceStep.guardOmega=e.maxOmega;
      if(e.stage==='contact-projection')traceStep.projections=Number(traceStep.projections)+1;
      if(typeof e.maxOmega==='number'&&e.maxOmega>20.001)firstOverspeed??=packet;
      if(e.stage==='substep-end') {
        const parts=e.parts as Array<{x:number;y:number;angle:number;vx:number;vy:number;omega:number}>;
        if(parts.some(p=>Math.abs(p.omega)>20.001))firstOverspeed??=packet;
        traceStep.parts=parts.map(p=>[p.x,p.y,p.angle,p.vx,p.vy,p.omega]);traceStep.com=e.com;
        // Shared physical clock: retain every1920Hz end, both finer halves are
        // still inspected for first contact/overspeed/branch events above.
        if((traceSub+1)%(substeps/32)===0)traceSteps.push(traceStep);
      }
    }
  };
  const start=performance.now(),initialMotor=host.state.ledger.mechanicalWorkHeat;
  for(let tick=0;tick<ticks;tick++) {
    traceTick=tick;
    tickLimited=0;tickRepairs=0;tickMinScale=1;tickMaxBias=0;tickMaxAngularBias=0;
    if(request.tape)current=tape.frames[offset+tick];
    else {current=[];tape.frames.push(current);}
    const diagnostic:IntegrationDiagnostic={substeps,splitting,...(request.jointLimits?{jointLimits:request.jointLimits}:{}),...(request.solverTrace?{trace}:{}),
      ...(request.tape?{outputs:new Map(current.map(f=>[f.id,f.outputs])),torqueAt:(id:string,sub:number)=>{
        const f=current.find(f=>f.id===id);if(!f)throw new Error('Tape population changed');
        return f.torques[Math.floor(sub*4/substeps)];
      }}:{captureOutputs:(id:string,outputs:readonly number[])=>current.push({id,outputs:[...outputs],torques:[]})})};
    host.tick((phase,before,after)=>{
      if(phase==='constraint-batch') {constraintLossJ+=Math.max(0,before-after);constraintGainJ+=Math.max(0,after-before);}
      if(phase==='contact-impulse') {contactLossJ+=Math.max(0,before-after);contactGainJ+=Math.max(0,after-before);}
    },observer,diagnostic);
    if(request.probe)probe.push({tick:offset+tick,limited:tickLimited,repairs:tickRepairs,minScale:tickMinScale,maxBias:tickMaxBias,maxAngularBias:tickMaxAngularBias});
    if(host.state.organisms.length!==source.length||host.state.organisms.some(o=>o.dissolving)||host.state.eggs.length)
      throw new Error('Integration experiment population changed');
    trajectory.push(host.state.organisms.map(o=>{const c=calculateOrganismCOM(o,host.settings.physicsRegime),a=initial.find(a=>a.id===o.id)!;
      finite&&=o.segments.every(p=>Object.values(p).every(Number.isFinite))&&Number.isFinite(o.energy);
      return {id:o.id,x:c.x-a.com.x,y:c.y-a.com.y,angle:o.segments[0].angle};}));
    maxChemicalErrorJ=Math.max(maxChemicalErrorJ,Math.abs(totalAccountedEnergy(host.state)-(host.state.energyPool?.budget??host.state.ledger.externalInflow)));
  }
  const runtimeMs=performance.now()-start;
  let pathPx=0;
  for(let i=0;i<trajectory.length;i++)for(let j=0;j<trajectory[i].length;j++)
    pathPx+=Math.hypot(trajectory[i][j].x-(trajectory[i-1]?.[j].x??0),trajectory[i][j].y-(trajectory[i-1]?.[j].y??0));
  return {substeps,hz:substeps*60,splitting,...(request.jointLimits?{jointLimits:request.jointLimits}:{}),ticks,offset,runtimeMs,trajectory,pathPx,finite,
    displacementPx:Math.hypot(trajectory.at(-1)![0].x,trajectory.at(-1)![0].y),
    reserveSpentJ:initial.reduce((s,a)=>s+a.energy-host.state.organisms.find(o=>o.id===a.id)!.energy,0),
    positiveJ,brakingJ,motorJ,ledgerMotorJ:host.state.ledger.mechanicalWorkHeat-initialMotor,fluidPhysicalJ,fluidNumericalJ,fluidBalanceErrorJ,
    guardLossJ,partSeconds,angularGuardFraction:angularGuardSeconds/partSeconds,linearGuardFraction:linearGuardSeconds/partSeconds,
    postContactOverspeedFraction:postContactOverspeedSeconds/partSeconds,guardEvents,maxAnchorPx,maxLimitRad,maxPostContactOmega,maxConstraintOmega,
    maxConstraintDeltaV,maxConstraintDeltaOmega,constraintLossJ,constraintGainJ,contactLossJ,contactGainJ,
    energyLimited,maxChemicalErrorJ,requests,mismatches,signedTorqueImpulse,absoluteTorqueImpulse,maxNewtonIterations,
    ...(request.probe?{probe,jointBatches,jointLimited,poseRepairs,minScale,maxBias,maxAngularBias}:{}),
    ...(request.solverTrace?{solverTrace:{version:'solver-event-trace-v1',mode:request.solverTrace.mode,
      steps:traceSteps,events:traceEvents,firstContact,firstOverspeed,firstLimited,firstRepair}}:{}),
    ...(!request.tape?{tape}:{})};
}
