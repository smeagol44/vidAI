/** Explicit paused-Worker experiment only. Read-only measurements, no scores,
 * neural input, selection, force modification or saved observer state. */
import type {SimulationHost} from './simulationHost';
import type {PhysicsObserver} from './physicsObservation';
import {calculateOrganismCOM, getCardinalAnchor, getChildAnchorForParentDir, type Organism} from './simulation';
import {mechanicalJoules} from './foundationPhysics';
import {totalAccountedEnergy} from './persistence';
import {collectWorldStats} from './world';
import {EcologyIntakeObserver, readEcologyState} from './ecologyAudit';
function jointErrors(org:Organism) {
  let anchorPx=0,limitRad=0;
  for(let i=1;i<org.segments.length;i++) {
    const d=org.genome.parts[i],pd=org.genome.parts[d.parentIndex],a=org.segments[d.parentIndex],b=org.segments[i];
    const pa=getCardinalAnchor(d.attachmentPoint,pd.width,pd.height),pb=getChildAnchorForParentDir(d.attachmentPoint,d.width,d.height);
    anchorPx=Math.max(anchorPx,Math.hypot(b.x+Math.cos(b.angle)*pb.x-Math.sin(b.angle)*pb.y-a.x-Math.cos(a.angle)*pa.x+Math.sin(a.angle)*pa.y,
      b.y+Math.sin(b.angle)*pb.x+Math.cos(b.angle)*pb.y-a.y-Math.sin(a.angle)*pa.x-Math.cos(a.angle)*pa.y));
    const relative=b.angle-a.angle-d.baseAngleOffset;
    limitRad=Math.max(limitRad,Math.abs(Math.atan2(Math.sin(relative),Math.cos(relative)))-d.maxAngle);
  }
  return {anchorPx,limitRad};
}

export function measurePhysicsTrial(host:SimulationHost,ticks:number,audit=true) {
  const regime=host.settings.physicsRegime;
  const initial=host.state.organisms.map(o=>({id:o.id,com:calculateOrganismCOM(o,regime),energy:o.energy}));
  const previous=new Map(initial.map(o=>[o.id,o.com]));
  const intake=new EcologyIntakeObserver();
  let pathPx=0,guards=0,limitedBatches=0,energyLimited=0,positiveWorkJ=0,negativeWorkJ=0;
  let maxTickAnchorPx=0,maxTickLimitRad=0,maxEnergyErrorJ=0,finite=true;
  let guardAngular=0,guardLinear=0,incomingOverspeed=0,constraintCrossings=0,guardLossJ=0;
  let maxConstraintOmega=0,maxSubstepOmega=0,maxSubstepAnchorPx=0,maxSubstepLimitRad=0,maxForceOmega=0;
  let fluidSamples=0,fluidPhysicalJ=0,fluidNumericalJ=0,fluidBalanceErrorJ=0,maxFluidIterations=0,maxFluidResidual=0;
  let requests=0,requestAppliedMismatch=0,nearCeiling=0,maxTorqueNm=0,requestRmsSum=0;
  let maxConstraintGainJ=0,budgetCostJ=0;
  const physics:PhysicsObserver=r=>{
    if(r.stage==='guard') {
      guardAngular+=Number(Math.abs(r.omega)>20);guardLinear+=Number(r.speed>400);
      incomingOverspeed+=Number(Math.abs(r.incomingOmega)>20);guardLossJ+=r.lossJ;
      maxForceOmega=Math.max(maxForceOmega,Math.abs(r.forceOmega));
    }else if(r.stage==='constraint') {
      constraintCrossings+=Number(Math.abs(r.beforeOmega)<=20&&Math.abs(r.afterOmega)>20);
      maxConstraintOmega=Math.max(maxConstraintOmega,Math.abs(r.afterOmega));
    }else if(r.stage==='substep') {
      maxSubstepOmega=Math.max(maxSubstepOmega,r.maxOmega);
      maxSubstepAnchorPx=Math.max(maxSubstepAnchorPx,r.anchorPx);maxSubstepLimitRad=Math.max(maxSubstepLimitRad,r.limitRad);
    }else if(r.stage==='fluid') {
      fluidSamples++;fluidPhysicalJ+=r.physicalDissipationJ;fluidNumericalJ+=r.numericalDissipationJ;
      fluidBalanceErrorJ=Math.max(fluidBalanceErrorJ,Math.abs(r.beforeJ-r.afterJ-r.physicalDissipationJ-r.numericalDissipationJ));
      maxFluidIterations=Math.max(maxFluidIterations,r.iterations);maxFluidResidual=Math.max(maxFluidResidual,r.residual);
    }else if(r.stage==='motor') {
      requests++;requestAppliedMismatch+=Number(r.requested!==r.applied);
      nearCeiling+=Number(r.ceiling>0&&Math.abs(r.requested)/r.ceiling>=.95);
      maxTorqueNm=Math.max(maxTorqueNm,Math.abs(r.applied)*mechanicalJoules(regime));
      requestRmsSum+=(r.ceiling>0?r.requested/r.ceiling:0)**2;
    }else if(r.stage==='budget')budgetCostJ+=r.costJ;
  };
  const initialMotorJ=host.state.ledger.mechanicalWorkHeat,started=performance.now();
  for(let tick=0;tick<ticks;tick++) {
    host.tick(audit?(phase,before,after)=>{if(phase==='constraint-batch')maxConstraintGainJ=Math.max(maxConstraintGainJ,after-before);}:undefined,
      audit?physics:undefined);
    const state=host.state;intake.sample(state);
    maxEnergyErrorJ=Math.max(maxEnergyErrorJ,Math.abs(totalAccountedEnergy(state)-(state.energyPool?.budget??state.ledger.externalInflow)));
    for(const org of state.organisms) {
      const com=calculateOrganismCOM(org,regime),old=previous.get(org.id);
      if(old)pathPx+=Math.hypot(com.x-old.x,com.y-old.y);previous.set(org.id,com);
      const d=org.motorDiagnostics;guards+=d?.numericalGuardEvents??0;limitedBatches+=d?.constraintLimitedBatches??0;
      energyLimited+=d?.energyLimitedImpulses??0;positiveWorkJ+=d?.positiveWorkJ??0;negativeWorkJ+=d?.negativeWorkJ??0;
      const error=jointErrors(org);maxTickAnchorPx=Math.max(maxTickAnchorPx,error.anchorPx);maxTickLimitRad=Math.max(maxTickLimitRad,error.limitRad);
      finite&&=org.segments.every(p=>Object.values(p).every(Number.isFinite))&&Number.isFinite(org.energy);
    }
  }
  const runtimeMs=performance.now()-started;
  const founders=initial.map(o=>{
    const org=host.state.organisms.find(a=>a.id===o.id),end=org?calculateOrganismCOM(org,regime):o.com;
    return {id:o.id,alive:!!org&&!org.dissolving,displacementPx:Math.hypot(end.x-o.com.x,end.y-o.com.y),
      reserveSpentJ:o.energy-(org?.energy??0)};
  });
  return {ticks,audit,runtimeMs,founders,pathPx,guards,limitedBatches,energyLimited,positiveWorkJ,negativeWorkJ,
    motorJ:host.state.ledger.mechanicalWorkHeat-initialMotorJ,maxTickAnchorPx,maxTickLimitRad,maxEnergyErrorJ,finite,
    receipts:{guardAngular,guardLinear,incomingOverspeed,constraintCrossings,guardLossJ,maxConstraintOmega,maxSubstepOmega,
      maxSubstepAnchorPx,maxSubstepLimitRad,maxForceOmega,fluidSamples,fluidPhysicalJ,fluidNumericalJ,fluidBalanceErrorJ,
      maxFluidIterations,maxFluidResidual,requests,requestAppliedMismatch,nearCeiling,maxTorqueNm,
      normalizedRequestRms:requests?Math.sqrt(requestRmsSum/requests):0,maxConstraintGainJ,budgetCostJ},
    ecology:readEcologyState(host.state),stats:collectWorldStats(host.state,host.settings.targetNutrients),absorbedJ:intake.totals()};
}
