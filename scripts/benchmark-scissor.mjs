import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {startPhysicsWorker} from './physics-worker-client.mjs';
import {mechanicalFixture} from '../mechanicalAudit.ts';
import {createSnapshot} from '../persistence.ts';
import {SCISSOR} from '../scissorBenchmark.ts';
const root='docs/experiments/',output=root+'brain-free-scissor-v2.json.gz';
const paths=['prism-worker-v4.json','prism-integration-v1.json','solver-event-summary-v1.json','solver-stop-checks-v1.json'];
const hash=p=>createHash('sha256').update(readFileSync(root+p)).digest('hex');
const protectedHashes=Object.fromEntries(paths.map(p=>[p,hash(p)]));
const report={protocol:SCISSOR.version,base:'21c5a5484dd39c5f31255f223a72e3139c447495',controls:SCISSOR,protectedHashes,
 criteria:{fixedTapeFinestPair:{vectorAbsolutePx:.01,vectorRelative:.01,apertureRmsDeg:1,positiveWorkRelative:.05},
   interpretability:{guards:0,overlapPx:.001,anchorPx:.001,dryDriftPx:1e-7,chemicalErrorJ:1e-8},
   note:'Declared before evaluation. Passing is numerical evidence only; net propulsion is not required. No adaptive refinement/tuning.'},
 rows:[],comparisons:[],checks:{},timings:[]};
const worker=await startPhysicsWorker();report.workerAsset=worker.bundle.split('/').pop();
const source=mechanicalFixture();source.config.physicsRegime='passive-work-v3';
const snapshot=createSnapshot(source.state,source.config);await worker.reset(snapshot);
const save=()=>writeFileSync(output,gzipSync(JSON.stringify(report)+'\n',{level:9}));
async function trial(request,label){
 const r=await worker.request('scissor-benchmark',{request:{version:SCISSOR.version,cycles:4,...request}});
 assert.ok(r.brainUnchanged);assert.ok(r.maxChemicalErrorJ<1e-8);assert.ok(Math.abs(r.motorJ-r.ledgerMotorJ)<1e-12);
 assert.ok(Math.abs(r.motorJ-r.positiveJ*4)<1e-12);assert.equal(r.torqueMismatch,0);assert.equal(r.energyLimited,0);
 assert.ok(Math.abs(r.mechanicalResidualJ??0)<1e-12);
 const {stateReceipt,tape,...row}=r;row.label=label;row.finalStateSha256=createHash('sha256').update(JSON.stringify(stateReceipt.state)).digest('hex');
 row.tape=tape;report.rows.push(row);save();
 console.log(JSON.stringify({label,regime:r.regime,hz:r.hz,travel:r.displacementPx,aperture:[r.angleMin,r.angleMax].map(x=>x*180/Math.PI),guards:r.guardEvents,overlap:r.maxOverlapPx,anchor:r.maxAnchorPx,positiveJ:r.positiveJ,runtimeMs:r.runtimeMs}));
 return r;
}
try{
 for(const regime of ['passive-work-v3','prism-resistance-v4']){
   const common={regime,program:'slow-open',substeps:4};
   const native=await trial(common,'native-feedback');
   for(const substeps of [8,16])await trial({...common,substeps,tape:native.tape},'held-native-tape');
   await trial({...common,substeps:16},'refined-feedback');
   await trial({...common,program:'passive'},'passive');
   await trial({...common,program:'passive',substeps:16},'passive-refined');
   await trial({...common,heading:180,tape:native.tape},'rotated-native-tape');
   await trial({...common,fluidOff:true,tape:native.tape},'fluid-off-native-tape');
   await trial({...common,substeps:16,fluidOff:true,tape:native.tape},'fluid-off-refined-tape');
   await trial({...common,program:'reverse'},'reverse-feedback');
   await trial({...common,program:'symmetric'},'symmetric-feedback');
   // Actual built-Worker telemetry/no-telemetry and native-tape replay exactness.
   const quiet=await worker.request('scissor-benchmark',{request:{version:SCISSOR.version,cycles:4,...common,audit:false,tape:native.tape}});
   assert.deepEqual(quiet.stateReceipt.state,native.stateReceipt.state);
   report.checks[regime]={observedUnobservedTapeExact:true};save();
 }
 assert.deepEqual(await worker.request('snapshot'),snapshot,'private fixture leaves authoritative user world exactly unchanged');
 await assert.rejects(worker.request('scissor-benchmark',{request:{version:'unknown'}}),/Invalid/);
 assert.deepEqual(await worker.request('snapshot'),snapshot);
 report.checks.hostUnchanged=true;report.checks.invalidRejected=true;
 for(const regime of ['passive-work-v3','prism-resistance-v4']){
   const rows=report.rows.filter(r=>r.regime===regime),native=rows.find(r=>r.label==='native-feedback');
   const held=rows.filter(r=>r.label==='held-native-tape');
   for(const [a,b] of [[native,held[0]],[held[0],held[1]]]){
     const vectorErrorPx=Math.hypot(a.dx-b.dx,a.dy-b.dy),apertureRmsDeg=Math.sqrt(a.trajectory.reduce((s,v,i)=>s+(v.aperture-b.trajectory[i].aperture)**2,0)/a.trajectory.length)*180/Math.PI;
     const positiveWorkRelative=Math.abs(a.positiveJ-b.positiveJ)/Math.max(1e-30,b.positiveJ);
     report.comparisons.push({regime,coarseHz:a.hz,fineHz:b.hz,vectorErrorPx,apertureRmsDeg,positiveWorkRelative,
       pass:vectorErrorPx<=Math.max(.01,.01*b.displacementPx)&&apertureRmsDeg<=1&&positiveWorkRelative<=.05});
   }
 }
 // Bounded reversed-order timing, with instrumentation disabled; no FPS assertion.
 for(const order of [['passive-work-v3','prism-resistance-v4'],['prism-resistance-v4','passive-work-v3']])for(const regime of order){
   const r=await worker.request('scissor-benchmark',{request:{version:SCISSOR.version,regime,program:'slow-open',cycles:4,substeps:4,audit:false}});
   report.timings.push({regime,hz:r.hz,runtimeMs:r.runtimeMs});
 }
 for(const p of paths)assert.equal(hash(p),protectedHashes[p]);
 report.completed=true;save();
}finally{await worker.close();}
