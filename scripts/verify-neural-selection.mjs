/** Frozen final-specimen replay and fork checks only. Never selects/mutates. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';
import {selectionSource} from '../experiments/neuralSelection.ts';
import {selectionMetrics} from '../experiments/selectionMetrics.ts';
const root='docs/experiments/',hash=b=>createHash('sha256').update(b).digest('hex'),snapshotHash=s=>hash(JSON.stringify(s));
const manifest=JSON.parse(readFileSync(root+'neural-selection-v1.json'));assert.ok(manifest.completed);
for(const [p,h] of Object.entries(manifest.protectedHashes))assert.equal(hash(readFileSync(root+p)),h);
const w=await startGatedWorker(),results=[];assert.equal(hash(readFileSync(new URL(w.bundle))),manifest.workerSha);
try{
 for(const entry of manifest.runs){
  const d=JSON.parse(gunzipSync(readFileSync(root+entry.archive))),g=d.champion?.genome??d.initial.genome,expected=d.champion?.training??d.initial.trial;
  const source=selectionSource(g),r=await w.trial(source,300,{auditTorque:true,traceJoints:true}),metrics=selectionMetrics(r,5);
  const expectedMetrics={...expected};for(const k of ['wallMs','trajectory','finalSnapshotSha'])delete expectedMetrics[k];
  assert.deepEqual(metrics,expectedMetrics);assert.deepEqual(JSON.parse(JSON.stringify(r.trajectory)),expected.trajectory);assert.equal(snapshotHash(r.snapshot),expected.finalSnapshotSha);
  let forkExact=null;
  if(d.seed===17){
   const half=await w.trial(source,150);await w.reset(half.snapshot);const rest=await w.request('experiment-step',{ticks:150});assert.equal(snapshotHash(rest.snapshot),expected.finalSnapshotSha);forkExact=true;
  }
  results.push({architecture:d.architecture,seed:d.seed,championAvailable:!!d.champion,metricsExact:true,trajectoryExact:true,snapshotExact:true,forkExact});
 }
 writeFileSync(root+'neural-selection-v1-verification.json',JSON.stringify({workerSha:manifest.workerSha,finalSpecimenReplays:9,additionalSplitContinuations:3,protectedHashesExact:true,results},null,2)+'\n');
 console.log('Nine frozen final specimens replay EXACT metrics, trajectories and full snapshots; three split/save/reset continuations EXACT; four protected prior evidence hashes unchanged. No selection performed.');
}finally{await w.close();}
