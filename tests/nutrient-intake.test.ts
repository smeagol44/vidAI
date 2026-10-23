import assert from 'node:assert/strict';import {test} from 'node:test';
import {INTAKE_ARCHITECTURES,intakeNetwork,intakeMutation,intakeSource,intakeMetrics,chooseIntakeElite,mutationSeed,parameterCount} from '../experiments/nutrientIntake';
import {createIntakeEvaluation} from '../experiments/intakeEvaluation';
import {SimulationHost} from '../simulationHost';import {measureWorkerTrial} from '../experiments/workerMetrics';
import {createFoodObservation} from '../experiments/foodObservation';import {createTorqueRecorder} from '../experiments/torqueRecorder';
import {restoreSnapshot,totalAccountedEnergy} from '../persistence';
function packet(h:SimulationHost,n=3){const f=createFoodObservation(h),a=createIntakeEvaluation(h,n),t=createTorqueRecorder();const metrics=measureWorkerTrial(h,n,t.observe,i=>{f.afterTick(i);a.afterTick(i);},a.mortality);return{metrics,foodAudit:f.report(),intakeAudit:a.report(),torqueAudit:t.report(),snapshot:h.snapshot()};}
test('paired fresh whole brains and ordinary neural mutations preserve legacy/hybrid semantics and fixed habitat',()=>{
 const [l,h]=INTAKE_ARCHITECTURES.map(a=>intakeNetwork(a));assert.deepEqual([l,h].map(parameterCount),[2172,1972]);assert.deepEqual(l.weightsIH,h.weightsIH);assert.deepEqual(l.weightsHH,h.weightsHH);assert.deepEqual(l.parts,h.parts);assert.equal(l.motorController,undefined);assert.equal(h.motorController?.version,'neural-motor-v1');assert.equal(h.motorController?.architecture,'two-output');
 assert.equal(l.outputKeys!.length,12);assert.equal(h.outputKeys!.length,4);
 for(const g of [l,h])for(let i=0;i<15;i++){const m=intakeMutation(g,mutationSeed(17,1,i),i);assert.equal(m.mutation.kind,'neural');assert.equal(m.mutation.kind==='neural'&&m.mutation.changes.length,8);assert.deepEqual(m.genome.parts,g.parts);assert.deepEqual(m.genome.motorController,g.motorController);}
 const [a,b]=[l,h].map(g=>intakeSource(g));assert.deepEqual(a.state.nutrients,b.state.nutrients);assert.deepEqual(a.state.prngState,b.state.prngState);assert.equal(a.state.nutrients.length,240);assert.ok(a.state.nutrients.every(n=>n.energyValue===3000));assert.equal(a.state.organisms[0].energy,10000);
 for(const s of [a,b]){const r=restoreSnapshot(s);assert.equal(totalAccountedEnergy(r.state),r.state.ledger.externalInflow);assert.equal(s.settings.nutrientPattern,'blooms');}
});
test('intake-only strict elitism preserves zero ties despite distance, reserves or nutrient visibility',()=>{
 const parent={valid:true,absorbedJ:0,distance:0},tie={valid:true,absorbedJ:0,distance:999},bad={valid:false,absorbedJ:9999,distance:0},better={valid:true,absorbedJ:48,distance:0};
 assert.deepEqual(chooseIntakeElite(parent,[tie,bad]),{best:parent,index:-1});assert.deepEqual(chooseIntakeElite(parent,[tie,bad,better]),{best:better,index:2});assert.equal(chooseIntakeElite(null,[bad]).best,null);
});
test('nonlethal is ephemeral; zero reserves remain zero with paid limits and exact chemical conservation; normal death unchanged',()=>{
 for(const architecture of INTAKE_ARCHITECTURES){const source=intakeSource(intakeNetwork(architecture)),o=source.state.organisms[0];source.state.ledger.externalInflow-=o.energy;o.energy=0;source.state.ledger.recordedLosses+=source.state.nutrients.reduce((a,n)=>a+n.energyValue,0);source.state.nutrients=[];
  const h=new SimulationHost();h.reset(source,1);const r=packet(h,120),m=intakeMetrics(r,2);assert.equal(h.state.organisms.length,1);assert.equal(h.state.organisms[0].energy,0);assert.ok(!h.state.organisms[0].dissolving);assert.equal(m.motorJ,0);assert.equal(m.positiveJ,0);assert.ok(m.energyLimited>0);assert.equal(r.intakeAudit.wouldBeDeaths[0].ticks,120);assert.ok(m.chemicalErrorJ<1e-8);assert.ok(Math.abs(m.partitionResidualJ)<1e-8);assert.ok(!m.reasons.includes('energy limiting'));assert.ok(!m.reasons.includes('invalid living state'));
  // Protection is not present in the snapshot: the next ordinary tick kills it.
  const normal=new SimulationHost();normal.reset(h.snapshot(),1);normal.tick();assert.equal(normal.state.organisms[0].dissolving,true);measureWorkerTrial(normal,60);assert.equal(normal.state.organisms.length,0);assert.equal(normal.state.totalDeaths,1);
 }
});
test('senescence protection does not reset age; normal unprotected snapshots exact and no world flags persist',()=>{
 const source=intakeSource(intakeNetwork('legacy')),h=new SimulationHost(),q=new SimulationHost();h.reset(source,1);q.reset(source,1);packet(h,3);measureWorkerTrial(q,3);assert.deepEqual(h.snapshot(),q.snapshot());
 h.state.organisms[0].age=h.state.organisms[0].maxLifespan;const before=h.state.organisms[0].age,r=packet(h,3);assert.ok(h.state.organisms[0].age>before);assert.equal(r.intakeAudit.wouldBeDeaths[0].cause,'Old Age');assert.ok(!h.state.organisms[0].dissolving);assert.throws(()=>createIntakeEvaluation(h,721));
});
test('ordinary physical mouth intake is absorbed score, not removed food; residual depletion closes energy and learning is normal',()=>{
 for(const a of INTAKE_ARCHITECTURES){const source=intakeSource(intakeNetwork(a)),s=source.state; // Verification fixture ONLY, never a training layout.
  s.ledger.recordedLosses+=s.nutrients.slice(1).reduce((a,n)=>a+n.energyValue,0);s.nutrients=s.nutrients.slice(0,1);const n=s.nutrients[0];s.ledger.recordedLosses+=n.energyValue-60.5;n.energyValue=60.5;n.radius=4;n.x=500+17.5*Math.cos(.37);n.y=400+17.5*Math.sin(.37);
  const h=new SimulationHost();h.reset(source,1);const r=packet(h,3),m=intakeMetrics(r,3/60);assert.equal(m.absorbedJ,48);assert.equal(m.food.grossFoodJ,60.5);assert.equal(m.recordedLossesJ,.5);assert.equal(m.food.assimilationHeatJ,12);assert.ok(m.nonlethal.contacts.length>0);assert.ok(m.food.learnedMotorL1>0);assert.ok(Math.abs(m.partitionResidualJ)<1e-8);assert.ok(Math.abs(m.motorJ-4*m.positiveJ)<1e-9);
 }
});
