/** Recover ONLY missing post-selection validation rows in stale checkpoints.
 * No mutation, generation or selection evaluation is permitted here. */
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';import {gzipSync,gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';import {foodSource,foodMetrics,TRAINING,HELD_OUT} from '../experiments/neuralFood.ts';
const root='docs/experiments/',hash=b=>createHash('sha256').update(b).digest('hex'),index=root+'neural-food-v1.json',original=readFileSync(index),m=JSON.parse(original),repairs=[];assert.ok(m.completed);
const save=(d,p)=>{writeFileSync(p+'.tmp',gzipSync(JSON.stringify(d)+'\n',{level:9}));renameSync(p+'.tmp',p);};
const w=await startGatedWorker();assert.equal(hash(readFileSync(new URL(w.bundle))),m.workerSha);
async function evaluate(g,env,c,passive){const source=foodSource(g,env,c,passive),start=performance.now(),r=await w.trial(source,Math.round(c.seconds*60),{auditTorque:true,traceJoints:true,traceFood:true});return{...foodMetrics(r,c.seconds),wallMs:performance.now()-start,trajectory:r.trajectory,finalSnapshotSha:hash(JSON.stringify(r.snapshot))};}
try{
 for(const entry of m.runs){const p=root+entry.archive,b=readFileSync(p);if(hash(b)===entry.sha256)continue;
  const d=JSON.parse(gunzipSync(b));assert.equal(d.completed,false);assert.equal(d.generations.length,12);assert.equal(d.generations.flatMap(g=>g.offspring).length,192);assert.equal(d.best?.distance??null,entry.finalDistance);
  if(!existsSync(root+'neural-food-v1-original-manifest.json'))writeFileSync(root+'neural-food-v1-original-manifest.json',original);
  const partial=entry.archive.replace('.json.gz','.partial.json.gz');if(!existsSync(root+partial))writeFileSync(root+partial,b);
  const recovered=[];
  for(let i=0;i<HELD_OUT.length;i++)for(const role of ['initial','final']){
   if(d.heldOut.some(x=>x.conditionIndex===i&&x.role===role))continue;
   const g=role==='initial'?d.initial.genome:d.champion?.genome??d.initial.genome;
   d.heldOut.push({conditionIndex:i,condition:HELD_OUT[i],role,championAvailable:!!d.champion,genomeSha:hash(JSON.stringify(g)),recovered:true,trial:await evaluate(g,d.environment,HELD_OUT[i],false)});recovered.push({kind:'held-out',conditionIndex:i,role});
  }
  for(const control of ['passive','fluid-off',...(d.environment==='A'?[]:['food-removed'])]){
   if(d.controls.some(x=>x.control===control))continue;
   const g=d.champion?.genome??d.initial.genome,c={...TRAINING,...(control==='fluid-off'?{viscosity:0}:{})};
   d.controls.push({control,championAvailable:!!d.champion,recovered:true,trial:await evaluate(g,control==='food-removed'?'A':d.environment,c,control==='passive')});recovered.push({kind:'control',control});
  }
  assert.equal(d.heldOut.length,6);assert.equal(d.controls.length,d.environment==='A'?2:3);d.completed=true;save(d,p);
  repairs.push({archive:entry.archive,partial,previousSha256:hash(b),originalRecordedSha256:entry.sha256,recoveredRows:recovered,finalSha256:hash(readFileSync(p)),trainingRowsChanged:0});
  entry.originalArchiveSha256=entry.sha256;entry.sha256=hash(readFileSync(p));
 }
 if(repairs.length){const recovery={trainingEvaluationsRepeated:0,validationRowsRecovered:repairs.reduce((s,r)=>s+r.recoveredRows.length,0),note:'Four stale finalization checkpoints detected after original runner completed. Original unavailable validation rows excluded; same frozen conditions remeasured. Timing of recovered rows is new. Cause of stale files not established.',repairs};m.recovery=recovery;writeFileSync(root+'neural-food-v1-finalization.json',JSON.stringify(recovery,null,2)+'\n');writeFileSync(index,JSON.stringify(m,null,2)+'\n');}
 console.log(JSON.stringify({archivesRecovered:repairs.length,validationRowsRecovered:repairs.reduce((s,r)=>s+r.recoveredRows.length,0),trainingEvaluationsRepeated:0}));
}finally{await w.close();}
