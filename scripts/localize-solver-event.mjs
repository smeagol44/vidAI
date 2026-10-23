/** Bounded first-second CUR-006 event scan, not the completed swim experiment. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {startPhysicsWorker} from './physics-worker-client.mjs';
const inputPath='docs/experiments/prism-integration-v1-CUR-006.json',raw=readFileSync(inputPath),{snapshot,tape}=JSON.parse(raw);
const worker=await startPhysicsWorker(),scan=[];
try {
 for(const substeps of [32,64]) {
  await worker.reset(snapshot);
  const r=await worker.request('integration-experiment',{request:{ticks:60,substeps,splitting:'motor-drag',tape,solverTrace:{mode:'scan'}}});
  scan.push(r);
  console.log(JSON.stringify({hz:r.hz,firstContact:r.solverTrace.firstContact,firstOverspeed:r.solverTrace.firstOverspeed,firstLimited:r.solverTrace.firstLimited,firstRepair:r.solverTrace.firstRepair}));
 }
 const archived=JSON.parse(readFileSync('docs/experiments/prism-integration-v1.json'));
 for(const row of scan) {
  const old=archived.bodies.find(b=>b.id==='CUR-006').rows.find(r=>r.hz===row.hz&&r.splitting==='motor-drag');
  assert.deepEqual(row.trajectory,old.trajectory.slice(0,60),'prefix exactly matches saved historical trajectory');
 }
 const [a,b]=scan.map(r=>r.solverTrace.steps),delta=[];
 for(let i=0;i<a.length;i++) {
  assert.ok(Math.abs(a[i].endTime-b[i].endTime)<1e-12);
  let maxAngle=0,maxOmega=0,maxPartPose=0,anglePart=-1,omegaPart=-1;
  for(let j=0;j<a[i].parts.length;j++) {
   const p=a[i].parts[j],q=b[i].parts[j],angle=Math.abs(Math.atan2(Math.sin(p[2]-q[2]),Math.cos(p[2]-q[2]))),omega=Math.abs(p[5]-q[5]);
   if(angle>maxAngle){maxAngle=angle;anglePart=j;}if(omega>maxOmega){maxOmega=omega;omegaPart=j;}
   maxPartPose=Math.max(maxPartPose,Math.hypot(p[0]-q[0],p[1]-q[1]));
  }
  delta.push({time:a[i].endTime,comPx:Math.hypot(a[i].com.x-b[i].com.x,a[i].com.y-b[i].com.y),maxAngle,maxOmega,maxPartPose,anglePart,omegaPart});
 }
 const first={com:delta.find(r=>r.comPx>=.25),angle:delta.find(r=>r.maxAngle>=.05),omega:delta.find(r=>r.maxOmega>=.5)};
 const report={protocol:'solver-event-scan-v1',source:'d2826d7966a76564bf05d57e0cd2aeabb545bacf',inputSha256:createHash('sha256').update(raw).digest('hex'),workerAsset:worker.bundle.split('/').pop(),archivePrefixExact:true,thresholds:{comPx:.25,angleRad:.05,omegaDifferenceRadS:.5,overspeedRadS:20.001},first,delta,scan};
 writeFileSync('docs/experiments/solver-event-scan-v1.json.gz',gzipSync(JSON.stringify(report)+'\n'));
 console.log('FIRST DIVERGENCE',JSON.stringify(first));
}finally{await worker.close();}
