import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {startPhysicsWorker} from './physics-worker-client.mjs';
import {mechanicalFixture} from '../mechanicalAudit.ts';
import {createSnapshot} from '../persistence.ts';
import {prescribedDragGrid,MATCHED_UNITS} from '../matchedDrag.ts';
const root='docs/experiments/',hash=b=>createHash('sha256').update(b).digest('hex');
const paths=['prism-worker-v4.json','prism-integration-v1.json','solver-stop-checks-v1.json','brain-free-scissor-v2.json.gz','brain-free-scissor-v2-summary.json','brain-free-serpent-v1.json.gz','brain-free-serpent-v1-summary.json'];
const protectedHashes=Object.fromEntries(paths.map(p=>[p,hash(readFileSync(root+p))]));
const report={version:'matched-drag-v1',base:'0b772cdbd582375ef42bbc0d968e88e4e1f93191',units:MATCHED_UNITS,
 goal:'Gameplay: affordable stable believable passive fluid resistance and discoverable locomotion; no biological/SI accuracy release requirement.',
 criteria:{vectorAbsolutePx:.01,vectorRelative:.01,jointRmsDeg:1,positiveWorkRelative:.05,anchorPx:.001,overlapPx:.001,guards:0,dryCOMPx:1e-7,chemicalJ:1e-8},
 protectedHashes,bodies:[],comparisons:[],timings:[],checks:{},completed:false};
writeFileSync(root+'matched-drag-wrenches-v1.json',JSON.stringify(prescribedDragGrid(),null,2)+'\n');
const worker=await startPhysicsWorker();report.workerAsset=worker.bundle.split('/').pop();
const f=mechanicalFixture(),snapshot=createSnapshot(f.state,f.config);await worker.reset(snapshot);
const oldScissor=JSON.parse(gunzipSync(readFileSync(root+'brain-free-scissor-v2.json.gz')));
const oldSerpent=JSON.parse(gunzipSync(readFileSync(root+'brain-free-serpent-v1.json.gz')));
const save=()=>writeFileSync(root+'matched-drag-v1.json',JSON.stringify(report,null,2)+'\n');
const tapes=new Map();
try{
 for(const body of ['scissor','serpent','paddles']){
  const common={version:'matched-drag-v1',body,cycles:4,integration:'explicit',substeps:4};
  let capture,old;
  if(body==='scissor'){old=oldScissor.rows.find(r=>r.regime==='passive-work-v3'&&r.label==='native-feedback');tapes.set(body,old.tape.map(x=>[x]));}
  else if(body==='serpent'){old=oldSerpent.rows.find(r=>r.regime==='passive-work-v3'&&r.label==='native-feedback');tapes.set(body,old.tape);}
  else {capture=await worker.request('matched-benchmark',{request:{...common,law:'v3'}});tapes.set(body,capture.tape);}
  const tape=tapes.get(body),data={body,reference:null,tape,tapeSha256:hash(JSON.stringify(tape)),rows:[],checks:{}};
  let initial;
  async function trial(law,substeps,integration='explicit',extra={},label='primary'){
   const r=label==='primary'&&law==='v3'&&substeps===4&&capture?capture:await worker.request('matched-benchmark',{request:{...common,law,substeps,integration,...extra,...(!extra.passive?{tape}:{})}});
   assert.ok(r.brainUnchanged&&r.maxChemicalErrorJ<1e-8&&Math.abs(r.mechanicalResidualJ)<1e-12);
   assert.equal(r.metabolicJ,0);assert.equal(r.energyLimited,0);assert.equal(r.torqueMismatch,0);
   assert.ok(Math.abs(r.motorJ-4*r.positiveJ)<1e-12&&Math.abs(r.motorJ-r.ledgerMotorJ)<1e-12);
   assert.ok(Math.abs(r.reserveSpentJ-r.motorJ)<1e-8);
   if(initial)assert.deepEqual(r.initialState,initial);else {initial=r.initialState;data.reference=r.reference;}
   assert.deepEqual(r.reference,data.reference);
   if(!extra.passive)assert.deepEqual(r.tape,tape);
   const {initialState,finalState,tape:unused,...row}=r;row.label=label;row.finalStateSha256=hash(JSON.stringify(finalState));row.initialStateSha256=hash(JSON.stringify(initialState));
   data.rows.push(row);writeFileSync(root+`matched-drag-v1-${body}.json.gz`,gzipSync(JSON.stringify(data)+'\n',{level:9}));
   console.log(JSON.stringify({body,law,label,hz:r.hz,method:integration,travel:r.displacementPx,vector:[r.dx,r.dy],work:r.positiveJ,guards:r.guardEvents,anchor:r.maxAnchorPx,overlap:r.maxOverlapPx}));
   return r;
  }
  for(const law of ['v3','v4'])for(const substeps of [4,8,16])await trial(law,substeps);
  for(const law of ['v3','v4']){await trial(law,4,'explicit',{passive:true},'passive');await trial(law,4,'explicit',{fluidOff:true},'dry');await trial(law,4,'implicit',{},'implicit-control');}
  const native=data.rows.find(r=>r.law==='v3'&&r.label==='primary'&&r.hz===240);
  if(old){
   // Same old motor tape and geometry, only private chemical overhead removed.
   assert.deepEqual(native.trajectory.map(p=>[p.x,p.y]),old.trajectory.map(p=>[p.x,p.y]));data.checks.archivedV3MotionExact=true;
  }
  const quiet=await worker.request('matched-benchmark',{request:{...common,law:'v3',tape,audit:false}});
  assert.equal(hash(JSON.stringify(quiet.finalState)),native.finalStateSha256);data.checks.telemetryQuietExact=true;
  const quietV4=await worker.request('matched-benchmark',{request:{...common,law:'v4',tape,audit:false}});
  const nativeV4=data.rows.find(r=>r.law==='v4'&&r.label==='primary'&&r.hz===240);
  assert.equal(hash(JSON.stringify(quietV4.finalState)),nativeV4.finalStateSha256);data.checks.telemetryQuietV4Exact=true;
  const dry=data.rows.filter(r=>r.label==='dry');assert.equal(dry[0].finalStateSha256,dry[1].finalStateSha256);data.checks.dragOffLawStatesExact=true;
  for(const law of ['v3','v4']){
   const rows=data.rows.filter(r=>r.label==='primary'&&r.law===law);
   for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i],n=b.trajectory[0].q.length;
    const vectorErrorPx=Math.hypot(a.dx-b.dx,a.dy-b.dy),jointRmsDeg=Math.sqrt(a.trajectory.reduce((s,p,k)=>s+p.q.reduce((u,q,j)=>u+(q-b.trajectory[k].q[j])**2,0),0)/(n*a.trajectory.length))*180/Math.PI;
    const workRelative=Math.abs(a.positiveJ-b.positiveJ)/Math.max(b.positiveJ,1e-30);
    report.comparisons.push({body,law,coarseHz:a.hz,fineHz:b.hz,vectorErrorPx,jointRmsDeg,workRelative,
     pass:vectorErrorPx<=Math.max(.01,.01*b.displacementPx)&&jointRmsDeg<=1&&workRelative<=.05});
   }
  }
  const archive=`matched-drag-v1-${body}.json.gz`;writeFileSync(root+archive,gzipSync(JSON.stringify(data)+'\n',{level:9}));
  report.bodies.push({body,archive,sha256:hash(readFileSync(root+archive)),tapeSha256:data.tapeSha256,reference:data.reference,checks:data.checks});save();
 }
 assert.deepEqual(await worker.request('snapshot'),snapshot);report.checks.hostUnchanged=true;
 // Bounded warmed counterbalanced cost: identical external tapes, no observers.
 for(const body of ['scissor','serpent','paddles']){
  const request={version:'matched-drag-v1',body,cycles:4,integration:'explicit',substeps:4,tape:tapes.get(body),audit:false};
  for(const law of ['v3','v4'])await worker.request('matched-benchmark',{request:{...request,law}});
  for(const order of [['v3','v4'],['v4','v3'],['v3','v4']])for(const law of order){const r=await worker.request('matched-benchmark',{request:{...request,law}});report.timings.push({body,law,hz:240,method:'explicit',runtimeMs:r.runtimeMs});}
 }
 // Prior isolated experiments must retain their native complete state, not just motion.
 for(const [type,old] of [['scissor',oldScissor],['serpent',oldSerpent]])for(const regime of ['passive-work-v3','prism-resistance-v4']){
  const request={version:type==='scissor'?'corner-scissor-v2':'corner-serpent-v1',regime,program:type==='scissor'?'slow-open':'traveling',substeps:4,cycles:4};
  const r=await worker.request(type+'-benchmark',{request});
  assert.equal(hash(JSON.stringify(r.stateReceipt.state)),old.rows.find(r=>r.regime===regime&&r.label==='native-feedback').finalStateSha256);
 }
 report.checks.fourPriorNativeFullStatesExact=true;
 await assert.rejects(worker.request('matched-benchmark',{request:{version:'wrong'}}),/Invalid/);assert.deepEqual(await worker.request('snapshot'),snapshot);
 for(const p of paths)assert.equal(hash(readFileSync(root+p)),protectedHashes[p]);
 report.completed=true;save();
}finally{await worker.close();}
