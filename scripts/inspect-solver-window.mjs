import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {startPhysicsWorker} from './physics-worker-client.mjs';
const scan=JSON.parse(gunzipSync(readFileSync('docs/experiments/solver-event-scan-v1.json.gz')));
const {snapshot,tape}=JSON.parse(readFileSync('docs/experiments/prism-integration-v1-CUR-006.json'));
const firstContact=scan.first.omega.time;
const firstOverspeeds=scan.scan.map(x=>x.solverTrace.firstOverspeed.startTime);
// First contact/state separation: one common step before, two after. Also a
// bounded8ms window spanning both first accepted-joint overspeed times.
const windows=[{name:'first-contact',startTime:firstContact-2/1920,endTime:firstContact+2/1920},
 {name:'first-overspeed',startTime:Math.min(...firstOverspeeds)-1/1920,endTime:Math.max(...firstOverspeeds)+2/1920}];
const worker=await startPhysicsWorker(),result={protocol:'solver-event-windows-v1',source:scan.source,inputSha256:scan.inputSha256,workerAsset:worker.bundle.split('/').pop(),windows:[]};
try {
 for(const window of windows)for(const substeps of [32,64]) {
  const offset=Math.floor((window.startTime+1e-12)*60),ticks=Math.ceil((window.endTime-1e-12)*60)-offset;
  await worker.reset(snapshot);
  if(offset)await worker.request('integration-experiment',{request:{ticks:offset,substeps,splitting:'motor-drag',tape}});
  const startSnapshot=await worker.request('snapshot');
  const request={ticks,offset,substeps,splitting:'motor-drag',tape,solverTrace:{mode:'window',startTime:window.startTime,endTime:window.endTime}};
  const measured=await worker.request('integration-experiment',{request}),endSnapshot=await worker.request('snapshot');
  await worker.reset(startSnapshot);
  const plain=await worker.request('integration-experiment',{request:{ticks,offset,substeps,splitting:'motor-drag',tape}});
  assert.deepEqual(await worker.request('snapshot'),endSnapshot,'trace leaves every state/PRNG field unchanged');
  for(const k of ['positiveJ','brakingJ','motorJ','ledgerMotorJ','fluidPhysicalJ','fluidNumericalJ','guardLossJ','trajectory'])assert.deepEqual(measured[k],plain[k]);
  // Each tick in the captured window remains the previously archived trajectory.
  const previous=scan.scan.find(x=>x.substeps===substeps);
  for(let i=0;i<ticks;i++) {
   const absolute=measured.solverTrace.steps[(i+1)*32-1].com;
   const old=previous.solverTrace.steps[(offset+i+1)*32-1].com;
   assert.deepEqual(absolute,old,'localized continuation equals initial prefix scan');
  }
  result.windows.push({name:window.name,startTime:window.startTime,endTime:window.endTime,startSnapshot,endSnapshot,measured,observedUnobservedExact:true,prefixScanExact:true});
  console.log(JSON.stringify({name:window.name,hz:measured.hz,ticks,events:measured.solverTrace.events.length,exact:true}));
 }
 writeFileSync('docs/experiments/solver-event-windows-v1.json.gz',gzipSync(JSON.stringify(result)+'\n'));
}finally{await worker.close();}
