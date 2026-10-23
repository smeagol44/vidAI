import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';
import {gatedBiteFixture} from '../experiments/gatedBiteFixture.ts';
import {makeRetainedGenome} from '../experiments/retainedHead.ts';
import {createFounderGenome} from '../founders.ts';
import {createSnapshot} from '../persistence.ts';
import {retainedSource} from '../experiments/retainedSetup.ts';
import {SimulationHost} from '../simulationHost.ts';
import {measureWorkerTrial} from '../experiments/workerMetrics.ts';
const w=await startGatedWorker();
try{
 for(const variant of ['retained-legacy','retained-first-signed','retained-all-signed']){
  const source=retainedSource('CUR-002',variant),host=new SimulationHost();host.reset(source,1);
  const metrics=measureWorkerTrial(host,30),r=await w.trial(source,30,{auditTorque:true,traceJoints:true});
  assert.deepEqual(r.snapshot,host.snapshot());assert.deepEqual(r.metrics,metrics);assert.equal(r.trajectory.length,3);
  const quiet=await w.trial(source,30);assert.deepEqual(quiet.snapshot,r.snapshot);assert.deepEqual(quiet.metrics,r.metrics);
  assert.equal(r.torqueAudit.totals.deliveryErrorMax,0);assert.ok(Math.abs(r.torqueAudit.costJ-4*r.torqueAudit.positiveJ)<1e-10);
  await w.reset(r.snapshot);const continued=await w.request('experiment-step',{ticks:30});measureWorkerTrial(host,30);assert.deepEqual(continued.snapshot,host.snapshot());
  await assert.rejects(w.request('control',{settings:{...source.settings,motorExperiment:'gated-torque-v1'},running:false}),/experiment/);
 }
 const large=retainedSource('FND-005','retained-legacy');assert.equal(large.state.organisms[0].neuralOutputs.length,54);
 const lr=await w.trial(large,3);const lh=new SimulationHost();lh.reset(lr.snapshot,1);measureWorkerTrial(lh,3);await w.reset(lr.snapshot);assert.deepEqual((await w.request('experiment-step',{ticks:3})).snapshot,lh.snapshot());
 const archive=JSON.parse(gunzipSync(readFileSync('docs/experiments/retained-head-v1.json.gz')));
 const frozen=archive.rows.find(x=>x.id==='CUR-002'&&x.variant==='retained-all-signed');
 const exact=await w.trial(frozen.source,300);assert.equal(createHash('sha256').update(JSON.stringify(exact.snapshot)).digest('hex'),createHash('sha256').update(JSON.stringify(frozen.finalSnapshot)).digest('hex'));
 // Two independent direct signs, then immediate OFF/OSCILLATOR on one joint only.
 const source=retainedSource('CUR-002','retained-all-signed'),o=source.state.organisms[0],g=o.genome;
 g.weightsHO.forEach(row=>row.fill(0));g.biasesO.fill(0);g.biasesO[7]=Math.atanh(.01);g.biasesO[16]=Math.atanh(-.01);
 let r=await w.trial(source,1,{auditTorque:true});let j=r.snapshot.state.organisms[0].joints;
 assert.ok(j[0].appliedTorque>0&&j[1].appliedTorque<0);
 const before=j[1].appliedTorque;
 r.snapshot.state.organisms[0].genome.biasesO[6]=Math.atanh(-.99);r=await w.trial(r.snapshot,1,{auditTorque:true});j=r.snapshot.state.organisms[0].joints;
 assert.equal(j[0].appliedTorque,0);assert.ok(j[1].appliedTorque<0);assert.ok(before<0);
 r.snapshot.state.organisms[0].genome.biasesO[6]=Math.atanh(.99);r=await w.trial(r.snapshot,1);assert.equal(r.snapshot.state.organisms[0].joints[0].gateMode,'oscillator');
 const bite=gatedBiteFixture('three-output',.06),old=bite.victim.genome;
 const bg=makeRetainedGenome(createFounderGenome('FND-001'),711,old.parts.slice(1).map(p=>p.id));
 bg.weightsIH=structuredClone(old.weightsIH);bg.weightsHH=structuredClone(old.weightsHH);bg.biasesH=[...old.biasesH];bg.hiddenTimeConstants=[...old.hiddenTimeConstants];bg.disabledConnections=[];
 bg.weightsHO.forEach(row=>row.fill(0));bg.biasesO.fill(0);
 for(let i=0;i<bg.parts.length-1;i++){bg.biasesO[i*9+6]=-1.5;bg.biasesO[i*9+7]=bg.biasesO[i*9+8]=1.5;bg.weightsHO[i*9+6][0]=3;}
 bite.config.motorExperiment='retained-head-v1';bite.victim.genome=bg;bite.victim.neuralOutputs=bg.outputKeys.map(()=>0);
 bite.state.lineage.get(bite.victim.id).genome=structuredClone(bg);
 r=await w.trial(createSnapshot(bite.state,bite.config),1);let victim=r.snapshot.state.organisms.find(o=>o.id===bite.victim.id);
 assert.ok(victim.biteFeedbackJ>0&&victim.joints.every(j=>j.gateMode==='off'));
 r=await w.request('experiment-step',{ticks:1});victim=r.snapshot.state.organisms.find(o=>o.id===bite.victim.id);
 assert.ok(victim.neuralInputs[bite.input]>0&&victim.joints.every(j=>j.gateMode==='oscillator')&&victim.joints.some(j=>j.appliedTorque!==0));
 console.log('Retained built Worker: exact host/quiet/trace/schema18 fork, prepaid signed work, three per-joint selector cases, independent +/- torques and one-update OFF/OSCILLATOR, regime-switch rejection and actual-bite next-update OFF→OSCILLATOR passed.');
}finally{await w.close();}
