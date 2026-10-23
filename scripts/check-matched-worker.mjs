import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {startPhysicsWorker} from './physics-worker-client.mjs';
import {mechanicalFixture} from '../mechanicalAudit.ts';
import {createSnapshot} from '../persistence.ts';
const worker=await startPhysicsWorker();
try{
 const f=mechanicalFixture(),snapshot=createSnapshot(f.state,f.config);await worker.reset(snapshot);
 const common={version:'matched-drag-v1',body:'paddles',law:'v3',integration:'explicit',substeps:4,cycles:1};
 const a=await worker.request('matched-benchmark',{request:common});
 for(const law of ['v3','v4'])for(const integration of ['explicit','implicit']){
  const r=await worker.request('matched-benchmark',{request:{...common,law,integration,tape:a.tape}});
  assert.deepEqual(r.initialState,a.initialState);assert.deepEqual(r.reference,a.reference);assert.deepEqual(r.tape,a.tape);
  assert.ok(r.brainUnchanged&&r.maxChemicalErrorJ<1e-8&&Math.abs(r.mechanicalResidualJ)<1e-12);
  assert.equal(r.metabolicJ,0);assert.equal(r.energyLimited,0);assert.equal(r.torqueMismatch,0);
  assert.ok(Math.abs(r.motorJ-4*r.positiveJ)<1e-12&&Math.abs(r.motorJ-r.ledgerMotorJ)<1e-12);
  const quiet=await worker.request('matched-benchmark',{request:{...common,law,integration,tape:a.tape,audit:false}});assert.deepEqual(quiet.finalState,r.finalState);
 }
 // Frozen implicit controls also guard the read-only residual receipt: final states stay exact.
 const archived=JSON.parse(gunzipSync(readFileSync('docs/experiments/matched-drag-v1-paddles.json.gz')));
 for(const law of ['v3','v4']){
  const r=await worker.request('matched-benchmark',{request:{...common,cycles:4,law,integration:'implicit',tape:archived.tape}});
  assert.equal(createHash('sha256').update(JSON.stringify(r.finalState)).digest('hex'),archived.rows.find(x=>x.law===law&&x.label==='implicit-control').finalStateSha256);
 }
 const p=await worker.request('matched-benchmark',{request:{...common,law:'v4',passive:true}});assert.ok(p.displacementPx<1e-9);assert.equal(p.motorJ,0);
 await assert.rejects(worker.request('matched-benchmark',{request:{...common,tape:a.tape.map((row,i)=>i===959?[row[0],NaN]:row)}}),/Invalid/);
 assert.deepEqual(await worker.request('snapshot'),snapshot);
 console.log('Matched built Worker: common initial state/mass/inertia/capacity, identical two-joint torque replay, both laws/methods, prepaid work, no biology, exact observation and host/save isolation passed.');
}finally{await worker.close();}
