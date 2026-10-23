/** Read-only derivation from archived Worker output; never runs a simulation. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root='docs/experiments/',path=root+'brain-free-scissor-v2.json.gz';
const source=readFileSync(path),d=JSON.parse(gunzipSync(source));
const deg=x=>x*180/Math.PI;
const rows=d.rows.map(r=>{
 const c=d.criteria.interpretability,passive=d.rows.find(p=>p.regime===r.regime&&p.label===(r.hz===240?'passive':'passive-refined'));
 const flags={noGuards:r.guardEvents===0,anchor:r.maxAnchorPx<=c.anchorPx,overlap:r.maxOverlapPx<=c.overlapPx,
   chemical:r.maxChemicalErrorJ<c.chemicalErrorJ,prepaid:Math.abs(r.motorJ-4*r.positiveJ)<1e-12};
 const last=r.trajectory.slice(720),p=r.phases,net=k=>p[k]?.netJ??0;
 return {...Object.fromEntries(['regime','label','hz','dx','dy','displacementPx','rotationRad','positiveJ','brakingJ','motorJ','metabolicJ','fluidPhysicalJ','fluidNumericalJ','guardEvents','maxOmega','maxAnchorPx','maxOverlapPx','maxLimitRad','maxChemicalErrorJ','maxSolverMomentumChange','maxSolverCOMShiftPx','limitedBatches','poseRepairs','runtimeMs'].map(k=>[k,r[k]])),
   lastCycle:{minDeg:deg(Math.min(...last.map(s=>s.tickMinAperture))),maxDeg:deg(Math.max(...last.map(s=>s.tickMaxAperture))),
     closeEndDeg:deg(r.trajectory[929].aperture),pauseEndDeg:deg(last.at(-1).aperture)},
   passiveVectorDeltaPx:Math.hypot(r.dx-passive.dx,r.dy-passive.dy),flags,
   contactSamples:p['contact-impulse']?.samples??0,contactLossJ:-net('contact-impulse'),constraintNetLossJ:-net('constraint-batch'),
   v3SignedFluidWorkJ:r.regime==='passive-work-v3'?net('forces-and-motors')-(r.positiveJ-r.brakingJ):null,
   note:r.regime==='passive-work-v3'?'v3 signed external drag-work estimate; physical/numerical losses are not separately resolved.':null};
});
const cov=d.rows.filter(r=>r.label==='native-feedback').map(n=>{const a=d.rows.find(r=>r.regime===n.regime&&r.label==='rotated-native-tape');return {regime:n.regime,rotatedVectorErrorPx:Math.hypot(n.dx+a.dx,n.dy+a.dy),
  rotatedApertureRmsDeg:deg(Math.sqrt(n.trajectory.reduce((s,x,i)=>s+(x.aperture-a.trajectory[i].aperture)**2,0)/n.trajectory.length))};});
const timings=['passive-work-v3','prism-resistance-v4'].map(regime=>({regime,ms:d.timings.filter(r=>r.regime===regime).map(r=>r.runtimeMs)}));
const ratio=timings[1].ms.reduce((s,x)=>s+x,0)/timings[0].ms.reduce((s,x)=>s+x,0);
const result={protocol:d.protocol,rawSha256:createHash('sha256').update(source).digest('hex'),criteria:d.criteria,checks:d.checks,
 comparisons:d.comparisons,rotationCovariance:cov,timings:{...Object.fromEntries(timings.map(t=>[t.regime,t.ms])),ratio,
 limitation:'Two reversed-order instrument-disabled16s fixture pairs only, same Worker after warmup. Not a browser FPS/ecosystem/default-throughput estimate.'},rows,
 conclusion:'Fluid-mediated COM movement exists under this prescribed mechanical program; v4 held-tape finest pair passes the declared local check, v3 fails and has orientation/contact sensitivity. Neither controller reaches the full requested stroke. No global physical validation, v3/v4 drag-only causal comparison, stable scissor gait, biological fitness or promotion follows.'};
writeFileSync(root+'brain-free-scissor-v2-summary.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({completed:d.completed,comparisons:d.comparisons,covariance:cov,timingRatio:ratio}));
