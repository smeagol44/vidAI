import assert from 'node:assert/strict';import {test} from 'node:test';
import {foodNetwork,foodSource,foodMutation,foodMetrics,FOOD_ARCHITECTURES,parameterCount,mutationSeed} from '../experiments/neuralFood';
import {createFounderGenome} from '../founders';import {SimulationHost} from '../simulationHost';
import {createSnapshot,restoreSnapshot,totalAccountedEnergy,validateGenome} from '../persistence';
import {measureWorkerTrial} from '../experiments/workerMetrics';import {createFoodObservation} from '../experiments/foodObservation';import {createTorqueRecorder} from '../experiments/torqueRecorder';
import {stepSimulation,mutateGenome,XoshiroPRNG,plasticMotorEdges} from '../simulation';
function packet(h:SimulationHost,ticks=3){const torque=createTorqueRecorder(),food=createFoodObservation(h);const metrics=measureWorkerTrial(h,ticks,torque.observe,food.afterTick);return{metrics,torqueAudit:torque.report(),foodAudit:food.report(),snapshot:h.snapshot()};}
test('corrected one/one/two independent outputs, paired fresh trunk/command; eight neural events for EVERY offspring',()=>{
 const donor=createFounderGenome('CUR-001');for(const seed of [17,71,1901]){
  const [o,d,h]=FOOD_ARCHITECTURES.map(a=>foodNetwork(a,seed));assert.deepEqual([o,d,h].map(parameterCount),[1922,1922,1972]);
  assert.deepEqual(o.weightsIH,d.weightsIH);assert.deepEqual(o.weightsHH,h.weightsHH);assert.notDeepEqual(d.weightsHH,donor.weightsHH);
  assert.deepEqual(o.weightsHO,d.weightsHO);for(let j=0;j<2;j++)assert.deepEqual(d.weightsHO[j],h.weightsHO[j*2+1]);
  for(const g of [o,d,h]){assert.deepEqual(g.parts,donor.parts);assert.equal(g.motorForce,donor.motorForce);assert.equal(g.motorFrequency,donor.motorFrequency);assert.ok(!('signedJoints' in g.motorController!));assert.equal(plasticMotorEdges(g).length,48);}
  for(const a of FOOD_ARCHITECTURES)for(let i=0;i<16;i++){const p=foodNetwork(a,seed),before=structuredClone(p),r=foodMutation(p,mutationSeed(seed,1,i),i);assert.equal(r.mutation.kind,'neural');assert.equal(r.mutation.kind==='neural'&&r.mutation.changes.length,8);assert.deepEqual(r.genome.parts,p.parts);assert.deepEqual(p,before);}
 }
});
test('new save contract rejects old schemas/genetic selector smuggling and continues exactly; oscillator genetics still mutable',()=>{
 for(const a of FOOD_ARCHITECTURES){const source=foodSource(foodNetwork(a,17),'A');assert.equal(source.schemaVersion,'19.0.0');const restored=restoreSnapshot(source);assert.deepEqual(createSnapshot(restored.state,restored.settings),source);
  for(const change of [(s:any)=>s.schemaVersion='18.0.0',(s:any)=>s.state.organisms[0].genome.motorController.signedJoints=[],(s:any)=>s.state.organisms[0].genome.motorController.architecture='three-output',(s:any)=>delete s.settings.motorExperiment]){const s=structuredClone(source);change(s);assert.throws(()=>restoreSnapshot(s));}
  const h=new SimulationHost();h.reset(source,1);packet(h);const mid=h.snapshot(),fork=new SimulationHost();fork.reset(mid,1);packet(h);packet(fork);assert.deepEqual(h.snapshot(),fork.snapshot());
  let changed=false;const g=foodNetwork(a,17);for(let i=1;i<=8;i++){const c=mutateGenome(g,.25,new XoshiroPRNG(i),'passive-work-v3');validateGenome(c);assert.deepEqual(c.motorController,g.motorController);changed ||= c.motorFrequency!==g.motorFrequency||c.parts.some((p,j)=>p.cpgFreqMult!==g.parts[j]?.cpgFreqMult);}assert.ok(changed);
 }
});
test('A/B/C exact ordinary nutrient counts/properties, matched initial placements, finite funded conservation',()=>{
 for(const env of ['A','B','C'] as const){let previous:any;for(const a of FOOD_ARCHITECTURES){const s=foodSource(foodNetwork(a,17),env),r=restoreSnapshot(s);assert.equal(s.state.nutrients.length,env==='A'?0:env==='B'?1:800);assert.equal(totalAccountedEnergy(r.state),r.state.ledger.externalInflow);assert.equal(s.state.organisms[0].energy,50000);assert.ok(s.state.nutrients.every(n=>n.energyValue===3000&&n.vx===0&&n.vy===0));if(previous)assert.deepEqual(s.state.nutrients,previous);previous=s.state.nutrients;
   const h=new SimulationHost();h.reset(s,1);const p=packet(h);assert.ok(!foodMetrics(p,3/60).reasons.includes('food/work partition'));
  }}
});
test('direct has no waveform contribution, opposite commands independent; oscillator only is wave torque; hybrid decisive OFF/OSC transitions',()=>{
 for(const a of FOOD_ARCHITECTURES){const s=restoreSnapshot(foodSource(foodNetwork(a,17),'A')),o=s.state.organisms[0],g=o.genome;g.weightsHO.forEach(r=>r.fill(0));g.biasesO.fill(0);
  if(a==='direct-only'){g.biasesO=[Math.atanh(.001),Math.atanh(-.001)];stepSimulation(s.state,s.settings,1/60);assert.ok(o.joints[0].appliedTorque>0&&o.joints[1].appliedTorque<0);const t=o.joints.map(j=>j.appliedTorque);g.parts[1].cpgPhaseOffset=99;o.joints[0].phase=99;stepSimulation(s.state,s.settings,1/60);assert.deepEqual(o.joints.map(j=>j.appliedTorque),t);}
  if(a==='oscillator-only'){stepSimulation(s.state,s.settings,1/60);assert.ok(o.joints.every(j=>j.gateMode==='oscillator'&&j.stiffness===0));assert.ok(o.joints.some(j=>j.appliedTorque!==0));}
  if(a==='two-output'){g.biasesO=[-3,1,-3,1];stepSimulation(s.state,s.settings,1/60);assert.ok(o.joints.every(j=>j.gateMode==='off'&&j.appliedTorque===0));g.biasesO=[3,1,3,1];stepSimulation(s.state,s.settings,1/60);assert.ok(o.joints.every(j=>j.gateMode==='oscillator'));g.biasesO=[-3,1,0,Math.atanh(-.001)];stepSimulation(s.state,s.settings,1/60);assert.equal(o.joints[0].appliedTorque,0);assert.ok(o.joints[1].appliedTorque<0);}
  const h=new SimulationHost();h.reset(foodSource(foodNetwork(a,17),'A',undefined,true),1);const p=packet(h);assert.equal(p.metrics.motorJ,0);assert.ok(p.metrics.founders[0].displacementPx<1e-8);
 }
});
test('physical nutrient contact funds intake normally; read-only food observations preserve state and exact partition',()=>{
 for(const a of FOOD_ARCHITECTURES){const source=foodSource(foodNetwork(a,17),'B');source.state.nutrients[0].x=2400+17.5*Math.cos(.37);source.state.nutrients[0].y=1500+17.5*Math.sin(.37);
  const h=new SimulationHost(),quiet=new SimulationHost();h.reset(source,1);quiet.reset(source,1);const p=packet(h);measureWorkerTrial(quiet,3);assert.deepEqual(h.snapshot(),quiet.snapshot());assert.ok(p.foodAudit.absorbedJ>0);assert.ok(p.foodAudit.contactTicks>0);assert.ok(p.foodAudit.assimilationLossJ>0);const m=foodMetrics(p,3/60);assert.ok(Math.abs(m.partitionResidualJ)<1e-5);assert.ok(!m.reasons.includes('food/work partition'));assert.ok(Math.abs(m.motorJ-4*m.positiveJ)<1e-9);
 }
});

test('ordinary neural proposals can mutate both mode and shared command connections together',()=>{const g=foodNetwork('two-output',17);let both=false;for(let seed=1;seed<=512&&!both;seed++){const m=foodMutation(g,seed,0).mutation;if(m.kind!=='neural')throw Error('Unexpected selector');const rows=m.changes.filter(e=>e.field==='weightsHO'||e.field==='biasesO').map(e=>e.row);both=rows.some(i=>i%2===0)&&rows.some(i=>i%2===1);}assert.ok(both);});
