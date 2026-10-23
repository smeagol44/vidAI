import assert from 'node:assert/strict';
import {startGatedWorker} from './gated-worker-client.mjs';
import {ARCHITECTURES,initialNetwork,selectionSource} from '../experiments/neuralSelection.ts';
import {SimulationHost} from '../simulationHost.ts';
import {measureWorkerTrial} from '../experiments/workerMetrics.ts';
const w=await startGatedWorker();
try{
 for(const a of ARCHITECTURES){
  const source=selectionSource(initialNetwork(a,17)),h=new SimulationHost();h.reset(source,1);
  const m=measureWorkerTrial(h,3),r=await w.trial(source,3,{auditTorque:true,traceJoints:true});
  assert.deepEqual(r.snapshot,h.snapshot());assert.deepEqual(r.metrics,m);
  const quiet=await w.trial(source,3);assert.deepEqual(quiet.snapshot,r.snapshot);assert.deepEqual(quiet.metrics,r.metrics);
  await w.reset(r.snapshot);const fork=await w.request('experiment-step',{ticks:3});measureWorkerTrial(h,3);assert.deepEqual(fork.snapshot,h.snapshot());
  const p=await w.trial(selectionSource(initialNetwork(a,17),undefined,true),3,{auditTorque:true});assert.equal(p.metrics.motorJ,0);assert.ok(p.metrics.founders[0].displacementPx<1e-8);
  assert.equal(r.torqueAudit.totals.deliveryErrorMax,0);assert.ok(Math.abs(r.torqueAudit.costJ-4*r.torqueAudit.positiveJ)<1e-9);
 }
 console.log('Neural-selection built Worker: all THREE randomized architectures, funded finite stocks, normal lifecycle, exact host/trace/quiet/fork, passive drift and prepaid work passed; no search executed.');
}finally{await w.close();}
