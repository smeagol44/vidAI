/** Focused #87 verification, never selection. Actual app-referenced built Worker. */
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';import {INTAKE_ARCHITECTURES,intakeNetwork,intakeSource,intakeMetrics,INTAKE_OPTIONS} from '../experiments/nutrientIntake.ts';
import {SimulationHost} from '../simulationHost.ts';import {measureWorkerTrial} from '../experiments/workerMetrics.ts';import {createIntakeEvaluation} from '../experiments/intakeEvaluation.ts';import {createFoodObservation} from '../experiments/foodObservation.ts';import {createTorqueRecorder} from '../experiments/torqueRecorder.ts';import {foodSource} from '../experiments/neuralFood.ts';
const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const w=await startGatedWorker(),results=[];
try{
 for(const architecture of INTAKE_ARCHITECTURES){
  const source=intakeSource(intakeNetwork(architecture)),h=new SimulationHost();h.reset(source,1);const f=createFoodObservation(h),a=createIntakeEvaluation(h,3),t=createTorqueRecorder();const metrics=measureWorkerTrial(h,3,t.observe,i=>{f.afterTick(i);a.afterTick(i);},a.mortality);
  const r=await w.trial(source,3,INTAKE_OPTIONS);assert.deepEqual(r.snapshot,h.snapshot());assert.deepEqual(r.metrics,metrics);assert.deepEqual(r.foodAudit,f.report());assert.deepEqual(r.intakeAudit,a.report());assert.deepEqual(r.torqueAudit,t.report());
  const q=await w.trial(source,3);assert.deepEqual(q.snapshot,r.snapshot);assert.deepEqual(q.metrics,r.metrics);
  await w.reset(r.snapshot);const fork=await w.request('experiment-step',{ticks:3,...INTAKE_OPTIONS});measureWorkerTrial(h,3);assert.deepEqual(fork.snapshot,h.snapshot());
  const contact=structuredClone(source);contact.state.nutrients[0].x=500+17.5*Math.cos(.37);contact.state.nutrients[0].y=400+17.5*Math.sin(.37);
  const feeding=await w.trial(contact,3,INTAKE_OPTIONS),m=intakeMetrics(feeding,3/60);assert.equal(m.absorbedJ,144);assert.equal(m.food.contactTicks,3);assert.ok(m.food.learnedMotorL1>0);assert.ok(Math.abs(m.partitionResidualJ)<1e-8);assert.equal(feeding.snapshot.state.organisms[0].recentFeedings.reduce((s,e)=>s+e.energyTransferred,0),144);
  const depleted=structuredClone(source),o=depleted.state.organisms[0];depleted.state.ledger.externalInflow-=o.energy;o.energy=0;depleted.state.ledger.recordedLosses+=depleted.state.nutrients.reduce((s,n)=>s+n.energyValue,0);depleted.state.nutrients=[];
  const zero=await w.trial(depleted,120,INTAKE_OPTIONS),zm=intakeMetrics(zero,2);assert.equal(zm.motorJ,0);assert.equal(zm.remainingJ,0);assert.ok(zm.energyLimited>0);assert.equal(zm.nonlethal.wouldBeDeaths[0].ticks,120);assert.ok(zm.chemicalErrorJ<1e-8);assert.ok(!zero.snapshot.state.organisms[0].dissolving);
  await w.reset(zero.snapshot);const normal=await w.request('experiment-step',{ticks:61});assert.equal(normal.snapshot.state.organisms.length,0);assert.equal(normal.snapshot.state.totalDeaths,1);
  const aged=structuredClone(source);aged.state.organisms[0].age=aged.state.organisms[0].maxLifespan;const old=await w.trial(aged,3,INTAKE_OPTIONS);assert.equal(old.intakeAudit.wouldBeDeaths[0].cause,'Old Age');assert.ok(old.snapshot.state.organisms[0].age>aged.state.organisms[0].age);assert.ok(!old.snapshot.state.organisms[0].dissolving);
  await w.reset(source);await assert.rejects(w.request('experiment-step',{ticks:721,...INTAKE_OPTIONS}),/at most12s/);await assert.rejects(w.request('experiment-step',{ticks:3,nonlethalEvaluation:'unknown'}),/Unknown offline/);
  results.push({architecture,hostAuditQuietForkExact:true,feeding:{absorbedJ:m.absorbedJ,contactTicks:m.food.contactTicks,learnedMotorL1:m.food.learnedMotorL1,partitionResidualJ:m.partitionResidualJ},zeroReserve:{motorJ:zm.motorJ,remainingJ:zm.remainingJ,limitedImpulses:zm.energyLimited,wouldBeDeaths:zm.nonlethal.wouldBeDeaths,chemicalErrorJ:zm.chemicalErrorJ},senescenceProtected:true,normalMortalityRestored:true,boundedRequestRejected:true});
 }
 for(const [architecture,file] of [['direct-only','neural-food-v1-A-direct-only-17.json.gz'],['two-output','neural-food-v1-A-two-output-17.json.gz']]){
  const d=JSON.parse(gunzipSync(readFileSync('docs/experiments/'+file))),g=d.champion?.genome??d.initial.genome,expected=d.champion?.training??d.initial.trial;
  const r=await w.trial(foodSource(g,'A'),300);assert.equal(sha(r.snapshot),expected.finalSnapshotSha);results.push({prior86:architecture,snapshotExact:true});
 }
 const out={version:'nutrient-intake-v1',results};writeFileSync('docs/experiments/nutrient-intake-v1-worker-check.json',JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify(out));
}finally{await w.close();}
