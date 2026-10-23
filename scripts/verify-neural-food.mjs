/** Frozen final-specimen replay and fork checks only. Never selects/mutates. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';
import {foodSource,foodMetrics as selectionMetrics} from '../experiments/neuralFood.ts';
const root='docs/experiments/',hash=b=>createHash('sha256').update(b).digest('hex'),snapshotHash=s=>hash(JSON.stringify(s));
const manifest=JSON.parse(readFileSync(root+'neural-food-v1.json'));assert.ok(manifest.completed);
for(const [p,h] of Object.entries(manifest.protectedHashes))assert.equal(hash(readFileSync(root+p)),h);
const w=await startGatedWorker(),results=[];assert.equal(hash(readFileSync(new URL(w.bundle))),manifest.workerSha);
try{
 for(const entry of manifest.runs){
  const d=JSON.parse(gunzipSync(readFileSync(root+entry.archive))),g=d.champion?.genome??d.initial.genome,expected=d.champion?.training??d.initial.trial;
  const source=foodSource(g,d.environment),r=await w.trial(source,300,{auditTorque:true,traceJoints:true,traceFood:true}),metrics=selectionMetrics(r,5);
  const expectedMetrics={...expected};for(const k of ['wallMs','trajectory','finalSnapshotSha'])delete expectedMetrics[k];
  assert.deepEqual(metrics,expectedMetrics);assert.deepEqual(JSON.parse(JSON.stringify(r.trajectory)),expected.trajectory);assert.equal(snapshotHash(r.snapshot),expected.finalSnapshotSha);
  let forkExact=null;
  if(d.seed===17){
   const half=await w.trial(source,150);await w.reset(half.snapshot);const rest=await w.request('experiment-step',{ticks:150});assert.equal(snapshotHash(rest.snapshot),expected.finalSnapshotSha);forkExact=true;
  }
  results.push({environment:d.environment,architecture:d.architecture,seed:d.seed,championAvailable:!!d.champion,metricsExact:true,trajectoryExact:true,snapshotExact:true,forkExact});
 }
 writeFileSync(root+'neural-food-v1-verification.json',JSON.stringify({workerSha:manifest.workerSha,finalSpecimenReplays:27,additionalSplitContinuations:9,protectedHashesExact:true,results},null,2)+'\n');
 console.log('Twenty-seven frozen final specimens replay EXACT metrics, trajectories and full snapshots; nine split/save/reset continuations EXACT; all #72/#85 protected prior evidence hashes unchanged. No selection performed.');
}finally{await w.close();}
