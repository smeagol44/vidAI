import assert from 'node:assert/strict';
import {startPhysicsWorker} from './physics-worker-client.mjs';
import {mechanicalFixture} from '../mechanicalAudit.ts';
import {createSnapshot} from '../persistence.ts';
import {SERPENT} from '../serpentBenchmark.ts';
const worker=await startPhysicsWorker();
try{
 const f=mechanicalFixture();const snapshot=createSnapshot(f.state,f.config);await worker.reset(snapshot);
 for(const regime of ['passive-work-v3','prism-resistance-v4']){
  const request={version:SERPENT.version,regime,program:'traveling',substeps:4,cycles:1};
  const a=await worker.request('serpent-benchmark',{request});
  const b=await worker.request('serpent-benchmark',{request:{...request,audit:false,tape:a.tape}});
  assert.deepEqual(a.stateReceipt.state,b.stateReceipt.state);
  assert.ok(a.brainUnchanged&&a.positiveJ>0&&a.brakingJ>=0);assert.equal(a.energyLimited,0);
  assert.ok(Math.abs(a.motorJ-a.positiveJ*4)<1e-12&&a.maxChemicalErrorJ<1e-8);
  const p=await worker.request('serpent-benchmark',{request:{...request,program:'passive',substeps:16}});
  assert.ok(p.displacementPx<1e-9);assert.equal(p.motorJ,0);
  await assert.rejects(worker.request('serpent-benchmark',{request:{...request,tape:a.tape.map((row,i)=>i===959?[row[0],NaN]:row)}}),/Invalid/);
 }
 assert.deepEqual(await worker.request('snapshot'),snapshot,'private benchmark never alters main host including PRNG');
 await assert.rejects(worker.request('serpent-benchmark',{request:{version:'unknown'}}),/Invalid/);
 assert.deepEqual(await worker.request('snapshot'),snapshot);
 console.log('Serpent built Worker: separate private fixture, both regimes, observed/unobserved/replayed full fixture-state equality, prepaid work, passive rest and invalid request/host isolation passed.');
}finally{await worker.close();}
