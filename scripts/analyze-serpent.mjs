/** Read-only analysis of the frozen actual-Worker archive. Never reruns physics. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root='docs/experiments/',raw=readFileSync(root+'brain-free-serpent-v1.json.gz'),d=JSON.parse(gunzipSync(raw));
const deg=x=>x*180/Math.PI;
const rows=d.rows.map(r=>{
 const c=d.criteria.interpretability,net=k=>r.phases[k]?.netJ??0;
 const last=r.cycles.at(-1),points=r.trajectory.slice(720);
 return {...Object.fromEntries(['regime','label','hz','dx','dy','displacementPx','rotationRad','positiveJ','brakingJ','motorJ','metabolicJ','fluidPhysicalJ','fluidNumericalJ','guardEvents','maxOmega','maxAnchorPx','maxOverlapPx','maxLimitRad','maxChemicalErrorJ','maxSolverMomentumChange','maxSolverCOMShiftPx','limitedBatches','poseRepairs','runtimeMs'].map(k=>[k,r[k]])),
  rootAngleDeg:deg(r.trajectory.at(-1).angles[0]-(r.heading??0)*Math.PI/180),
  angleRangesDeg:[0,1].map(j=>[deg(r.angleMin[j]),deg(r.angleMax[j])]),trackingRmsDeg:r.trackingRms.map(deg),
  lastCycle:{...last,minQDeg:last.minQ.map(deg),maxQDeg:last.maxQ.map(deg),shapeClosureDeg:deg(last.shapeClosureRad),
    trackingRmsDeg:[0,1].map(j=>deg(Math.sqrt(points.reduce((s,p)=>s+(p.q[j]-p.target[j])**2,0)/points.length)))},
  flags:{noGuards:r.guardEvents===0,anchor:r.maxAnchorPx<=c.anchorPx,overlap:r.maxOverlapPx<=c.overlapPx,
    chemical:r.maxChemicalErrorJ<c.chemicalErrorJ,prepaid:Math.abs(r.motorJ-4*r.positiveJ)<1e-12,
    ...(r.fluidOff?{dryCOM:r.displacementPx<=c.dryDriftPx}:{})},
  contactSamples:r.phases['contact-impulse']?.samples??0,contactLossJ:-net('contact-impulse'),constraintNetLossJ:-net('constraint-batch'),
  v3SignedFluidWorkJ:r.regime==='passive-work-v3'?net('forces-and-motors')-(r.positiveJ-r.brakingJ):null};
});
const cov=d.rows.filter(r=>r.label==='native-feedback').map(n=>{
 const a=d.rows.find(r=>r.regime===n.regime&&r.label==='rotated-native-tape');
 return {regime:n.regime,rotatedVectorErrorPx:Math.hypot(n.dx+a.dx,n.dy+a.dy),
  rotatedJointRmsDeg:deg(Math.sqrt(n.trajectory.reduce((s,p,i)=>s+p.q.reduce((sum,q,j)=>sum+(q-a.trajectory[i].q[j])**2,0),0)/(2*n.trajectory.length)))};
});
const timings=[240,960].map(hz=>{
 const times=Object.fromEntries(['passive-work-v3','prism-resistance-v4'].map(regime=>[regime,d.timings.filter(r=>r.hz===hz&&r.regime===regime).map(r=>r.runtimeMs)]));
 return {hz,...times,ratio:times['prism-resistance-v4'].reduce((s,x)=>s+x,0)/times['passive-work-v3'].reduce((s,x)=>s+x,0)};
});
const summary={protocol:d.protocol,rawSha256:createHash('sha256').update(raw).digest('hex'),criteria:d.criteria,checks:d.checks,comparisons:d.comparisons,
 rotationCovariance:cov,timings,rows,
 limits:'Two reversed-order timing pairs per resolution only; JIT/GC/noisy short trials do not establish universal scaling, browser FPS or ecology throughput. 1250x physical mass/ceiling mismatch unchanged; not a drag-only comparison. Private artificial fixture is not an importable save. No solver correction, tuning or promotion.',
 conclusion:'Both regimes show funded non-reciprocal, brain-free displacement with passive/dry controls at numerical COM rest, wave-reversed axial travel and negligible late in-phase-control travel. Both fixed-tape numerical pairs pass the declared local criterion; neither proves the provisional fluid law correct. v4 is slower and swims less in the opposite axial direction. Stop for review.'};
writeFileSync(root+'brain-free-serpent-v1-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({completed:d.completed,comparisons:d.comparisons,covariance:cov,timings}));
