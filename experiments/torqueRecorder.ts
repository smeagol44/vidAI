import type {ActuationObserver, ActuationSample} from '../actuationObservation';
type Demand = Extract<ActuationSample, {kind: 'demand'}>;
function moments() {return {count: 0, sum: 0, square: 0, maxAbs: 0};}
function add(m: ReturnType<typeof moments>, x: number) {m.count++; m.sum += x; m.square += x*x; m.maxAbs = Math.max(m.maxAbs, Math.abs(x));}
function read(m: ReturnType<typeof moments>) {return {count:m.count, mean:m.sum/Math.max(1,m.count),rms:Math.sqrt(m.square/Math.max(1,m.count)),maxAbs:m.maxAbs};}
function group() {return {samples:0,dt:0, neural: moments(),raw: moments(),requested: moments(),applied: moments(),
  utilization:moments(),freeDelta:moments(),coupledMotorDelta:moments(),externalDelta:moments(),
  proportional:moments(),damping:moments(),clipSamples:0,nearCeiling:0,waveClipSamples:0,
  opposingMotion:0,pushingNearLimit:0,zeroRequest:0,energyLimited:0, deliveryErrorMax:0};}
/** Ephemeral receipt reduction. It neither receives mutable world objects nor
 * returns a control value. Histories are bounded; aggregate totals cover all receipts. */
export function createTorqueRecorder() {
  const totals=group(), groups=new Map<string,ReturnType<typeof group>>(), pending=new Map<string,Demand>();
  let batches=0, limitedBatches=0, positiveJ=0,negativeJ=0,costJ=0;
  let guards=0,angularGuards=0,linearGuards=0,guardLossJ=0,maxAngularSpeed=0,maxLinearSpeed=0;
  let maxAnchorPx=0,maxLimitRad=0,maxPostContactAngularSpeed=0;
  let motorNecessaryGuards=0,motorAloneCrossings=0,incomingOverspeedGuards=0,constraintOverspeedSamples=0;
  let maxConstraintAngularSpeed=0,guardDecompositionError=0; const firstGuards: Array<{guard:ActuationSample; demands:Demand[]}>=[];
  const firstDemands: Demand[]=[];
  const get=(d:Demand) => {
    const key=`${d.organism}/J${d.joint}/${d.mode}`;
    let g=groups.get(key);if(!g){g=group();groups.set(key,g);}return g;
  };
  const observe:ActuationObserver = s => {
    if(s.kind==='uncapped-part') return;
    if(s.kind==='demand') {
      pending.set(`${s.organism}/${s.joint}`,s); if(firstDemands.length<24)firstDemands.push(s);
      for(const g of [totals,get(s)]) {
        g.samples++;g.dt+=s.dt;
        add(g.neural,s.neuralCommand);add(g.raw,s.rawTorque/s.baseCeiling);
        add(g.requested,s.requestedTorque/s.baseCeiling);add(g.utilization,s.requestedTorque/s.ceiling);
        add(g.freeDelta,s.freeRelativeDelta);add(g.proportional,s.proportionalTorque/s.baseCeiling);
        add(g.damping,s.dampingTorque/s.baseCeiling);
        g.clipSamples+=Number(Math.abs(s.rawTorque)>s.ceiling);
        g.waveClipSamples+=Number(s.mode==='oscillator'&&Math.abs(s.rawWave)>1);
        g.nearCeiling+=Number(Math.abs(s.requestedTorque)>=.95*s.ceiling);
        g.opposingMotion+=Number(s.requestedTorque*s.relativeSpeed<0);
        g.pushingNearLimit+=Number(Math.abs(s.relativeAngle)>=.95*s.maxAngle && s.requestedTorque*s.relativeAngle>0);
        g.zeroRequest+=Number(s.requestedTorque===0);
      }
    } else if(s.kind==='delivery') {
      const d=pending.get(`${s.organism}/${s.joint}`);if(!d)throw new Error('Delivery without a demand receipt');
      for(const g of [totals,get(d)]) {
        add(g.applied,s.appliedTorque/d.baseCeiling);add(g.coupledMotorDelta,s.motorRelativeDelta);
        add(g.externalDelta,s.externalRelativeDelta);g.energyLimited+=Number(s.budgetScale<1 && d.requestedTorque!==0);
        g.deliveryErrorMax=Math.max(g.deliveryErrorMax,Math.abs(s.appliedTorque-d.requestedTorque*s.budgetScale));
      }
    } else if(s.kind==='budget') {
      batches++;limitedBatches+=Number(s.scale<1);positiveJ+=s.positiveJ;negativeJ+=s.negativeJ;costJ+=s.costJ;
    } else if(s.kind==='guard') {
      if(Math.abs(s.angularSpeed)>20) {
        motorNecessaryGuards+=Number(Math.abs(s.withoutMotorAngularSpeed)<=20);
        motorAloneCrossings+=Number(Math.abs(s.incomingAngularSpeed)<=20 && Math.abs(s.incomingAngularSpeed+s.motorAngularDelta)>20);
        incomingOverspeedGuards+=Number(Math.abs(s.incomingAngularSpeed)>20);
      }
      guardDecompositionError=Math.max(guardDecompositionError,Math.abs(s.angularSpeed-s.incomingAngularSpeed-s.motorAngularDelta-s.externalAngularDelta));
      guards++;angularGuards+=Number(Math.abs(s.angularSpeed)>20);linearGuards+=Number(s.speed>400);
      guardLossJ+=s.lostJ;maxAngularSpeed=Math.max(maxAngularSpeed,Math.abs(s.angularSpeed));maxLinearSpeed=Math.max(maxLinearSpeed,s.speed);
      if(firstGuards.length<3)firstGuards.push({guard:s,demands:[...pending.values()].filter(d=>d.organism===s.organism)});
    } else if(s.kind==='constraint') {
      constraintOverspeedSamples+=Number(Math.abs(s.beforeAngularSpeed)<=20 && Math.abs(s.afterAngularSpeed)>20);
      maxConstraintAngularSpeed=Math.max(maxConstraintAngularSpeed,Math.abs(s.afterAngularSpeed));
    } else {maxAnchorPx=Math.max(maxAnchorPx,s.maxAnchorPx);maxLimitRad=Math.max(maxLimitRad,s.maxLimitRad);
      maxPostContactAngularSpeed=Math.max(maxPostContactAngularSpeed,s.maxAngularSpeed);}
  };
  function reduce(g:ReturnType<typeof group>) {
    return {samples:g.samples,jointSeconds:g.dt,neural:read(g.neural),rawNormalized:read(g.raw),
      requestedNormalized:read(g.requested),appliedNormalized:read(g.applied),utilization:read(g.utilization),
      freeRelativeDelta:read(g.freeDelta),coupledMotorDelta:read(g.coupledMotorDelta),externalDelta:read(g.externalDelta),
      proportionalNormalized:read(g.proportional),dampingNormalized:read(g.damping),
      clipSamples:g.clipSamples,nearCeiling:g.nearCeiling,waveClipSamples:g.waveClipSamples,
      opposingMotion:g.opposingMotion,pushingNearLimit:g.pushingNearLimit,zeroRequest:g.zeroRequest,
      energyLimited:g.energyLimited,deliveryErrorMax:g.deliveryErrorMax};
  }
  return {observe,report:()=>({totals:reduce(totals),groups:Object.fromEntries([...groups].map(([key,g])=>[key,reduce(g)])),
    batches,limitedBatches,positiveJ,negativeJ,costJ,guards,angularGuards,linearGuards,guardLossJ,
    maxAngularSpeed,maxLinearSpeed,maxAnchorPx,maxLimitRad,motorNecessaryGuards,motorAloneCrossings,
    incomingOverspeedGuards,constraintOverspeedSamples,maxConstraintAngularSpeed,maxPostContactAngularSpeed,
    guardDecompositionError,firstDemands,firstGuards})};
}
