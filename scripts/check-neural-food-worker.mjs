import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';import {FOOD_ARCHITECTURES,ENVIRONMENTS,foodNetwork,foodSource,foodMetrics} from '../experiments/neuralFood.ts';
import {SimulationHost} from '../simulationHost.ts';import {measureWorkerTrial} from '../experiments/workerMetrics.ts';import {selectionSource} from '../experiments/neuralSelection.ts';
const w=await startGatedWorker(),sha=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
try{
 for(const a of FOOD_ARCHITECTURES)for(const e of ENVIRONMENTS){
  const source=foodSource(foodNetwork(a,17),e),h=new SimulationHost();h.reset(source,1);const metrics=measureWorkerTrial(h,3),r=await w.trial(source,3,{auditTorque:true,traceJoints:true,traceFood:true});assert.deepEqual(r.snapshot,h.snapshot());assert.deepEqual(r.metrics,metrics);
  const quiet=await w.trial(source,3);assert.deepEqual(quiet.snapshot,r.snapshot);assert.deepEqual(quiet.metrics,r.metrics);
  await w.reset(r.snapshot);const fork=await w.request('experiment-step',{ticks:3,traceFood:true});measureWorkerTrial(h,3);assert.deepEqual(fork.snapshot,h.snapshot());
  const p=await w.trial(foodSource(foodNetwork(a,17),e,undefined,true),3,{auditTorque:true,traceFood:true});assert.equal(p.metrics.motorJ,0);assert.ok(p.metrics.founders[0].displacementPx<1e-8);
  assert.ok(!foodMetrics(r,3/60).reasons.includes('food/work partition'));
 }
 for(const a of FOOD_ARCHITECTURES){const source=foodSource(foodNetwork(a,17),'B');source.state.nutrients[0].x=2400+17.5*Math.cos(.37);source.state.nutrients[0].y=1500+17.5*Math.sin(.37);const r=await w.trial(source,3,{auditTorque:true,traceFood:true});assert.ok(r.foodAudit.absorbedJ>0);assert.ok(Math.abs(foodMetrics(r,3/60).partitionResidualJ)<1e-5);}
 // Justified compatibility replays after changing runtime: no previous search is repeated.
 for(const a of ['legacy','signed','hybrid']){const d=JSON.parse(gunzipSync(readFileSync(`docs/experiments/neural-selection-v1-${a}-17.json.gz`))),r=await w.trial(selectionSource(d.champion.genome),300);assert.equal(sha(r.snapshot),d.champion.training.finalSnapshotSha);}
 console.log('New built Worker: all NINE architecture/environment combinations exact host/audit/quiet/fork; passive zero and physical feeding partition passed; three #85 final snapshots remain EXACT despite new Worker bundle. No search executed.');
}finally{await w.close();}
