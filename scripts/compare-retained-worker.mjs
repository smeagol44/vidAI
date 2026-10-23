import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {startGatedWorker} from './gated-worker-client.mjs';
import {retainedSource,legacyComparisonSnapshot} from '../experiments/retainedSetup.ts';
import {torqueAuditSource,TORQUE_AUDIT_IDS,TORQUE_AUDIT_CONDITIONS} from '../experiments/torqueAuditSetup.ts';
const hash=b=>createHash('sha256').update(b).digest('hex'),root='docs/experiments/';
const old=JSON.parse(readFileSync(root+'torque-demand-v1.json'));
const protectedPaths=['torque-demand-v1.json','gated-worker-v1.json','gated-controller-comparison.md','torque-demand-audit.md'];
const hashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(readFileSync(root+p))]));
const report={version:'retained-head-v1',base:'73f73981b61f37db6a439e5802e11ff7d5efe44f',condition:TORQUE_AUDIT_CONDITIONS[0],ticks:300,
 scope:'3 frozen body plans x 5 cases; same v3 mechanics, original costs, capacity, genes and old neural row meanings; no search or coefficient/strength tuning.',protectedHashes:hashes,rows:[],checks:{}};
const w=await startGatedWorker();report.workerAsset=w.bundle.split('/').pop();report.workerSha256=hash(readFileSync(new URL(w.bundle)));
try{
 for(const id of TORQUE_AUDIT_IDS){let legacy;
  for(const variant of ['legacy-six-output','legacy-fresh-head','retained-legacy','retained-first-signed','retained-all-signed']){
   const source=variant.startsWith('retained')?retainedSource(id,variant):torqueAuditSource(id,variant,report.condition);
   const r=await w.trial(source,300,{auditTorque:true,traceJoints:true});
   assert.ok(r.metrics.finite&&r.metrics.maxEnergyErrorJ<1e-6);assert.equal(r.torqueAudit.totals.deliveryErrorMax,0);
   assert.ok(Math.abs(r.torqueAudit.costJ-4*r.torqueAudit.positiveJ)<1e-9);
   const checks={};
   if(variant.startsWith('legacy')){const frozen=old.rows.find(x=>x.id===id&&x.variant===variant&&x.condition.seed===17);assert.deepEqual(r.metrics,frozen.metrics);assert.deepEqual(JSON.parse(JSON.stringify(r.torqueAudit)),frozen.torque);checks.archivedMetricsAndAuditExact=true;}
   if(variant==='legacy-six-output')legacy=r;
   if(variant==='retained-legacy'){
    assert.deepEqual(r.metrics,legacy.metrics);assert.deepEqual(r.torqueAudit,legacy.torqueAudit);
    assert.deepEqual(legacyComparisonSnapshot(r.snapshot),legacy.snapshot);checks.fullLegacyProjectionExact=true;
    const trace=r.trajectory.map(p=>({...p,organisms:p.organisms.map(o=>({...o,joints:o.joints.map(({mode,...j})=>j)}))}));
    const ref=legacy.trajectory.map(p=>({...p,organisms:p.organisms.map(o=>({...o,joints:o.joints.map(({mode,...j})=>j)}))}));assert.deepEqual(trace,ref);checks.trajectoryExact=true;
   }
   if(variant==='retained-all-signed'){
    const frozen=old.rows.find(x=>x.id===id&&x.variant==='three-output/hysteresis'&&x.condition.seed===17);
    assert.deepEqual(r.metrics,frozen.metrics);assert.deepEqual(JSON.parse(JSON.stringify(r.torqueAudit)),frozen.torque);checks.archivedAllSignedExact=true;
   }
   if(variant==='retained-first-signed'){
    const groups=Object.keys(r.torqueAudit.groups);assert.ok(groups.some(k=>k.includes('/J0/')&&!k.endsWith('/servo')));assert.ok(groups.some(k=>k.includes('/J1/servo')));checks.mixedJointControllers=true;
   }
   const row={id,variant,source,metrics:r.metrics,torque:r.torqueAudit,trajectory:r.trajectory,finalSnapshot:r.snapshot,checks};
   report.rows.push(row);console.log(JSON.stringify({id,variant,travel:r.metrics.founders[0].displacementPx,motorJ:r.metrics.motorJ,guards:r.metrics.guards,anchor:r.torqueAudit.maxAnchorPx}));
  }
 }
 for(const p of protectedPaths)assert.equal(hash(readFileSync(root+p)),hashes[p]);report.checks.previousEvidenceExact=true;
 const bytes=gzipSync(JSON.stringify(report)+'\n',{level:9});writeFileSync(root+'retained-head-v1.json.gz',bytes);
 const summary={...report,archiveSha256:hash(bytes),rows:report.rows.map(({source,finalSnapshot,...r})=>({...r,sourceSha256:hash(JSON.stringify(source)),finalSnapshotSha256:hash(JSON.stringify(finalSnapshot))}))};
 writeFileSync(root+'retained-head-v1-summary.json',JSON.stringify(summary,null,2)+'\n');
 console.log('15 bounded built-Worker cases saved; archived controls, retained legacy motion/learning state, prepaid work and prior evidence exact.');
}finally{await w.close();}
