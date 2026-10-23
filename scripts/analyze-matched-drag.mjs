/** Frozen-data-only consolidation. Does not rerun physics or change a coefficient. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root='docs/experiments/',index=JSON.parse(readFileSync(root+'matched-drag-v1.json'));
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)],deg=x=>x*180/Math.PI;
const rows=[];
for(const b of index.bodies){
 const bytes=readFileSync(root+b.archive);if(createHash('sha256').update(bytes).digest('hex')!==b.sha256)throw new Error('Archive hash');
 const d=JSON.parse(gunzipSync(bytes));
 for(const r of d.rows){const c=index.criteria;
  rows.push({...Object.fromEntries(['body','law','integration','label','hz','displacementPx','dx','dy','rotationRad','positiveJ','brakingJ','motorJ','metabolicJ','explicitDragWorkJ','dragPositiveWorkJ','fluidPhysicalJ','fluidNumericalJ','maxOmega','maxAnchorPx','maxLimitRad','maxOverlapPx','guardEvents','overspeedSteps','limitedBatches','poseRepairs','energyLimited','torqueMismatch','maxChemicalErrorJ','mechanicalResidualJ','maxSolverMomentumChange','maxSolverCOMShiftPx','finalStateSha256','initialStateSha256'].map(k=>[k,r[k]])),
  angleRangesDeg:r.angleMin.map((q,j)=>[deg(q),deg(r.angleMax[j])]),trackingRmsDeg:r.trackingRms.map(deg),lastCycle:r.cycles.at(-1),
  constraintLossJ:-(r.phases['constraint-batch']?.netJ??0),contactLossJ:-(r.phases['contact-impulse']?.netJ??0),
  flags:{guard:r.guardEvents===0,anchor:r.maxAnchorPx<=c.anchorPx,overlap:r.maxOverlapPx<=c.overlapPx,chemical:r.maxChemicalErrorJ<c.chemicalJ,
   ...(r.fluidOff?{dryCOM:r.displacementPx<=c.dryCOMPx}:{})}});
 }
}
const cost=index.bodies.map(b=>{
 const times=Object.fromEntries(['v3','v4'].map(law=>[law,index.timings.filter(r=>r.body===b.body&&r.law===law).map(r=>r.runtimeMs)]));
 return {body:b.body,...times,medianV3:median(times.v3),medianV4:median(times.v4),ratio:median(times.v4)/median(times.v3)};
});
const grid=JSON.parse(readFileSync(root+'matched-drag-wrenches-v1.json'));
const forceExamples=grid.rows.filter(r=>r.width===1&&r.height===7&&r.angle===0&&((r.vx===1&&r.vy===0&&r.omega===0)||(r.vx===0&&r.vy===1&&r.omega===0)||(r.vx===20&&r.vy===0&&r.omega===0)||(r.vx===0&&r.vy===20&&r.omega===0)||(r.vx===0&&r.vy===0&&r.omega===1)));
const summary={version:index.version,recommendation:'Keep existing v3 for VIDA gameplay; do not promote v4 or tune coefficients in this experiment.',
 basis:'Matched mechanics shows stable serpent/paddle response with v3, less constraint/contact dependence and cheaper explicit drag. Current v4 constants are weak in the common game reference, have poor tracking and more contact sensitivity, and cost more. Scissor v3 still fails its trajectory gate. Neither is certified exploit-proof, and these v3-origin torque tapes do not rank optimally evolved controllers.',
 goal:index.goal,criteria:index.criteria,forceExamples,forceGridRows:grid.rows.length,maxGridPower:Math.max(...grid.rows.map(r=>r.powerJPerS)),
 comparisons:index.comparisons,cost,rows,checks:index.checks,protectedHashes:index.protectedHashes};
writeFileSync(root+'matched-drag-v1-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({recommendation:summary.recommendation,cost,forceExamples,finest:index.comparisons.filter(x=>x.fineHz===960)}));
