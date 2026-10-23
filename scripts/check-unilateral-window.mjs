/** Four same-state, same-command short controls. No old swim/study rerun. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {startPhysicsWorker} from './physics-worker-client.mjs';
const legacy=JSON.parse(gunzipSync(readFileSync('docs/experiments/solver-event-windows-v1.json.gz')));
const {tape}=JSON.parse(readFileSync('docs/experiments/prism-integration-v1-CUR-006.json'));
const worker=await startPhysicsWorker(),report={protocol:'unilateral-stop-windows-v1',source:'53ecc5b3651b642b9247cb0dbea9af5e5c796bb3',correction:'unilateral-stop-v1',inputSha256:legacy.inputSha256,workerAsset:worker.bundle.split('/').pop(),windows:[]};
try {
 for(const w of legacy.windows) {
  const {substeps,ticks,offset}=w.measured,request={substeps,ticks,offset,splitting:'motor-drag',tape};
  await worker.reset(w.startSnapshot);await worker.request('integration-experiment',{request});
  assert.deepEqual(await worker.request('snapshot'),w.endSnapshot,'native historical window unchanged under new code');
  await worker.reset(w.startSnapshot);
  const r=await worker.request('integration-experiment',{request:{...request,jointLimits:'unilateral-stop-v1',solverTrace:{mode:'window',startTime:w.startTime,endTime:w.endTime}}});
  assert.ok(r.finite&&r.maxChemicalErrorJ<1e-6&&r.fluidBalanceErrorJ<1e-12);
  assert.equal(r.mismatches,0);assert.equal(r.energyLimited,0);
  assert.ok(Math.abs(r.motorJ-4*r.positiveJ)<1e-12&&Math.abs(r.motorJ-r.ledgerMotorJ)<1e-12);
  const end=await worker.request('snapshot');
  await worker.reset(w.startSnapshot);await worker.request('integration-experiment',{request:{...request,jointLimits:'unilateral-stop-v1'}});
  assert.deepEqual(await worker.request('snapshot'),end,'candidate observed/unobserved exact');
  if(w.name==='first-contact')assert.deepEqual(end,w.endSnapshot,'negative control with no active angular limit exactly unchanged');
  // External method/version must be explicitly resupplied after snapshot/reset.
  await worker.reset(end);await worker.request('integration-experiment',{request:{...request,ticks:1,offset:offset+ticks,jointLimits:'unilateral-stop-v1'}});
  const fork=await worker.request('snapshot');await worker.reset(w.startSnapshot);
  await worker.request('integration-experiment',{request:{...request,ticks:ticks+1,jointLimits:'unilateral-stop-v1'}});
  assert.deepEqual(await worker.request('snapshot'),fork,'versioned external-method continuation exact');
  const {solverTrace:legacyTrace,...legacyMetrics}=w.measured;
  report.windows.push({name:w.name,startTime:w.startTime,endTime:w.endTime,startSnapshot:w.startSnapshot,endSnapshot:end,measured:r,
   observedUnobservedExact:true,nativeWindowExact:true,externalMethodForkExact:true,legacyMetrics});
  console.log(JSON.stringify({name:w.name,hz:r.hz,oldOmega:w.measured.maxPostContactOmega,newOmega:r.maxPostContactOmega,oldAnchor:w.measured.maxAnchorPx,newAnchor:r.maxAnchorPx,oldPositive:w.measured.positiveJ,newPositive:r.positiveJ,oldGuards:w.measured.guardEvents,newGuards:r.guardEvents,chemical:r.maxChemicalErrorJ}));
 }
 writeFileSync('docs/experiments/solver-stop-windows-v1.json.gz',gzipSync(JSON.stringify(report)+'\n'));
}finally{await worker.close();}
