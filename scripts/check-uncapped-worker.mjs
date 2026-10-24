/** Focused short verification only; never evolutionary selection. */
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {startGatedWorker} from './gated-worker-client.mjs';import {uncappedSource,intakeNetwork,UNCAPPED_OPTIONS} from '../experiments/uncappedIntake.ts';
import {SimulationHost} from '../simulationHost.ts';import {measureWorkerTrial} from '../experiments/workerMetrics.ts';import {createIntakeEvaluation} from '../experiments/intakeEvaluation.ts';import {createFoodObservation} from '../experiments/foodObservation.ts';import {createTorqueRecorder} from '../experiments/torqueRecorder.ts';import {createUncappedObservation} from '../experiments/uncappedObservation.ts';
import {intakeSource} from '../experiments/nutrientIntake.ts';import {geneHash} from './intake-archive.mjs';
const w=await startGatedWorker(),results={};
try{
 const source=uncappedSource(intakeNetwork('neural-hybrid')),h=new SimulationHost();h.reset(source,1);
 const a=createIntakeEvaluation(h,3),f=createFoodObservation(h),t=createTorqueRecorder(),u=createUncappedObservation(h);
 const metrics=measureWorkerTrial(h,3,s=>{t.observe(s);u.observe(s);},i=>{a.afterTick(i);f.afterTick(i);u.afterTick(i);},a.mortality);
 const r=await w.trial(source,3,UNCAPPED_OPTIONS);
 assert.deepEqual(r.snapshot,h.snapshot());assert.deepEqual(r.metrics,metrics);assert.deepEqual(r.foodAudit,f.report());assert.deepEqual(r.intakeAudit,a.report());assert.deepEqual(r.torqueAudit,t.report());assert.deepEqual(r.uncappedAudit,u.report());
 const q=await w.trial(source,3);assert.deepEqual(q.snapshot,r.snapshot);assert.deepEqual(q.metrics,r.metrics);
 const half=await w.trial(source,1,UNCAPPED_OPTIONS);await w.reset(half.snapshot);const rest=await w.request('experiment-step',{ticks:2,...UNCAPPED_OPTIONS});assert.deepEqual(rest.snapshot,r.snapshot);results.hostQuietForkExact=true;
 const hot=structuredClone(source);hot.settings.waterViscosity=0;hot.state.organisms[0].segments.forEach(p=>{p.vx=900;p.vy=0;p.angVel=55;});
 const hr=await w.trial(hot,1,UNCAPPED_OPTIONS);assert.ok(hr.uncappedAudit.maxLinearSpeed>800);assert.ok(hr.uncappedAudit.maxAngularSpeed>20);assert.equal(hr.uncappedAudit.guardLossJ,0);results.workerUncapped={maxSpeed:hr.uncappedAudit.maxLinearSpeed,maxOmega:hr.uncappedAudit.maxAngularSpeed,guardLossJ:hr.uncappedAudit.guardLossJ};
 const contact=structuredClone(source);contact.state.nutrients[0].x=500+17.5*Math.cos(.37);contact.state.nutrients[0].y=400+17.5*Math.sin(.37);
 const feeding=await w.trial(contact,3,UNCAPPED_OPTIONS);assert.equal(feeding.foodAudit.absorbedJ,144);assert.ok(feeding.foodAudit.learnedMotorL1>0);results.physicalFeeding144JAndLearning=true;
 await w.reset(source);await assert.rejects(w.request('experiment-step',{ticks:1,traceUncapped:'true'}),/Uncapped trace/);
 await assert.rejects(w.request('control',{settings:{...source.settings,experimentalVelocityMode:undefined},running:false,speed:1,selected:null}),/Velocity mode/);
 const old=intakeSource(intakeNetwork('neural-hybrid'));await w.reset(old);await assert.rejects(w.request('experiment-step',{ticks:1,traceUncapped:true}),/Uncapped trace/);results.modeIsolation=true;
 // Original HYBRID founder only; historical legacy is never rerun.
 const d=JSON.parse(gunzipSync(readFileSync('docs/experiments/nutrient-intake-v1-neural-hybrid-initial.json.gz')));
 const original=await w.trial(intakeSource(d.initial.genome),720,{auditTorque:true,traceJoints:true,traceFood:true,nonlethalEvaluation:'nutrient-intake-v1'});
 assert.equal(geneHash(original.snapshot),d.initial.trial.finalSnapshotSha);assert.deepEqual(JSON.parse(JSON.stringify(original.trajectory)),d.initial.trial.trajectory);results.original88HybridSnapshotAndPRNGExact=true;
 writeFileSync('docs/experiments/uncapped-hybrid-v1-worker-check.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{await w.close();}
