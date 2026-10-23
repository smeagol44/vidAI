import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createFounderGenome} from '../founders';
import {makeRetainedGenome} from '../experiments/retainedHead';
import {retainedSource} from '../experiments/retainedSetup';
import {torqueAuditSource,TORQUE_AUDIT_CONDITIONS} from '../experiments/torqueAuditSetup';
import {SimulationHost} from '../simulationHost';
import {createSnapshot,restoreSnapshot,validateGenome} from '../persistence';
import {brainEdgeKey,plasticMotorEdges,mutateGenome,XoshiroPRNG,remapBrain,stepSimulation} from '../simulation';
import {measureWorkerTrial} from '../experiments/workerMetrics';
import {createTorqueRecorder} from '../experiments/torqueRecorder';
import {enableClosedEconomy} from '../energyEconomy';

export function projectLegacy(o:any,legacyKeys:string[]){
 const c=structuredClone(o);c.neuralOutputs=legacyKeys.map(k=>c.neuralOutputs[c.genome.outputKeys.indexOf(k)]);
 for(const j of c.joints)delete j.gateMode;
 delete c.genome;return c;
}
test('retained legacy meanings, masks and active learning survive expansion; no torque-row copying',()=>{
 const parent=createFounderGenome('CUR-002');
 parent.disabledConnections!.push(brainEdgeKey('ho',parent.outputKeys![0],parent.hiddenIds![0]));parent.hiddenTimeConstants![0]=.4;
 const saved=structuredClone(parent),g=makeRetainedGenome(parent,17);
 assert.deepEqual(parent,saved);assert.deepEqual(validateGenome(g),g);
 for(const k of parent.outputKeys!){const a=parent.outputKeys!.indexOf(k),b=g.outputKeys!.indexOf(k);assert.deepEqual(g.weightsHO[b],parent.weightsHO[a]);assert.equal(g.biasesO[b],parent.biasesO[a]);}
 for(const k of ['parts','weightsIH','weightsHH','biasesH','hiddenIds','hiddenTimeConstants','inputKeys','disabledConnections'] as const)assert.deepEqual(g[k],parent[k]);
 for(const scope of ['angle','all'] as const){parent.plasticityRate=g.plasticityRate=.1;parent.plasticMotorScope=g.plasticMotorScope=scope;
  assert.deepEqual(plasticMotorEdges(g).map(e=>e.edge),plasticMotorEdges(parent).map(e=>e.edge));}
 assert.throws(()=>makeRetainedGenome(g,17));
 assert.ok(g.outputKeys!.some((k,i)=>k.endsWith(':DirectTorque')&&g.weightsHO[i].some(x=>x!==0)));
 // Explicit selector changes invalidate the active-learner cache; no old row is reinterpreted.
 if(g.motorController?.version!=='retained-head-v1')throw Error();g.motorController.signedJoints=[g.parts[1].id];
 assert.ok(plasticMotorEdges(g).some(e=>g.outputKeys![e.output].endsWith(':DirectTorque')));
 assert.ok(!plasticMotorEdges(g).some(e=>g.outputKeys![e.output]===`joint:${g.parts[1].id}:Angle`));
});

test('all-legacy retained policy is exact through nonzero within-life learning in both scopes',()=>{
 for(const scope of ['angle','all'] as const){
  const a=new SimulationHost(),b=new SimulationHost();a.reset(torqueAuditSource('CUR-002','legacy-six-output',TORQUE_AUDIT_CONDITIONS[0]),1);b.reset(retainedSource('CUR-002','retained-legacy'),1);
  for(const host of [a,b]){const o=host.state.organisms[0];o.genome.plasticityRate=.1;o.genome.plasticMotorScope=scope;o.genome.memoryConsolidationRate=.3;}
  const keys=a.state.organisms[0].genome.outputKeys!;
  for(let i=0;i<12;i++){
   for(const host of [a,b]){const o=host.state.organisms[0];o.biteFeedbackJ=5;for(const m of o.genome.mouths)o.mouthFeedback![m.id]={contact:1,intake:1};}
   a.tick();b.tick();assert.deepEqual(projectLegacy(b.state.organisms[0],keys),projectLegacy(a.state.organisms[0],keys));
   assert.deepEqual(b.state.ledger,a.state.ledger);assert.deepEqual(b.state.prng.getState(),a.state.prng.getState());
  }
  assert.ok(a.state.organisms[0].learnedMotorWeights?.some(e=>e.delta!==0));
 }
});

test('schema18 gates, paid continuation, inheritance and pruning are explicit; old schemas unchanged',()=>{
 const large=retainedSource('FND-005','retained-legacy');assert.equal(large.state.organisms[0].neuralOutputs.length,54);restoreSnapshot(large);
 for(const closed of [false,true]){
  const r=restoreSnapshot(retainedSource('CUR-002','retained-first-signed'));
  if(closed){enableClosedEconomy(r.state);r.settings.ecologyRegime='closed-v1';r.settings.nutrientLimit=null;}
  const source=createSnapshot(r.state,r.settings);assert.equal(source.schemaVersion,'18.0.0');assert.deepEqual(createSnapshot(restoreSnapshot(source).state,r.settings),source);
  for(const alter of [(x:any)=>x.schemaVersion='16.0.0',(x:any)=>x.schemaVersion='17.0.0',(x:any)=>x.settings.motorExperiment='gated-torque-v1',(x:any)=>x.state.organisms[0].genome.motorController.signedJoints=['missing']]){const bad=structuredClone(source);alter(bad);assert.throws(()=>restoreSnapshot(bad));}
  const a=new SimulationHost(),b=new SimulationHost();a.reset(source,1);measureWorkerTrial(a,8);b.reset(a.snapshot(),1);measureWorkerTrial(a,8);measureWorkerTrial(b,8);assert.deepEqual(a.snapshot(),b.snapshot());
  const g=r.state.organisms[0].genome,original=structuredClone(g);
  const child=mutateGenome(g,0,new XoshiroPRNG(7),'passive-work-v3');assert.deepEqual(child.motorController,g.motorController);assert.notEqual(child.motorController,g.motorController);assert.deepEqual(g,original);validateGenome(child);
  let changed=false;for(let seed=1;seed<=24;seed++){const c=mutateGenome(g,1,new XoshiroPRNG(seed),'passive-work-v3');validateGenome(c);changed ||=JSON.stringify(c.parts.map(p=>p.id))===JSON.stringify(g.parts.map(p=>p.id)) && JSON.stringify(c.motorController)!==JSON.stringify(g.motorController);}
  assert.ok(changed,'selector can mutate without performance selection');
  const cut=structuredClone(g),old=structuredClone(cut);cut.parts=cut.parts.slice(0,1);cut.eyes=[];cut.mouths=[];
  if(cut.motorController?.version!=='retained-head-v1')throw Error();cut.motorController.signedJoints=[];remapBrain(cut,old);validateGenome(cut);
 }
});

test('signed joints are independent, respond in one neural update, OFF is passive and work stays prepaid',()=>{
 for(const reserve of [0,1e-12,.001,10000]){
  const r=restoreSnapshot(retainedSource('CUR-002','retained-all-signed')),o=r.state.organisms[0],g=o.genome;
  g.weightsHO.forEach(row=>row.fill(0));g.biasesO.fill(0);
  const set=(j:number,mode:number,command:number)=>{g.biasesO[j*9+6]=Math.atanh(mode);g.biasesO[j*9+7]=Math.atanh(command);};
  set(0,0,.01);set(1,-.99,.9);r.state.ledger.externalInflow+=reserve-o.energy;o.energy=reserve;
  const rec=createTorqueRecorder();stepSimulation(r.state,r.settings,1/60,undefined,undefined,rec.observe);
  assert.equal(o.joints[1].appliedTorque,0);assert.ok(r.state.ledger.mechanicalWorkHeat<=reserve+1e-10);
  if(reserve===0)assert.equal(o.joints[0].appliedTorque,0);else assert.ok(o.joints[0].appliedTorque>0);
  if(reserve===10000){set(0,0,-.01);stepSimulation(r.state,r.settings,1/60);assert.ok(o.joints[0].appliedTorque<0);
   const before=o.segments[1].angle;set(0,-.99,.99);stepSimulation(r.state,r.settings,1/60);assert.equal(o.joints[0].appliedTorque,0);assert.notEqual(o.segments[1].angle,before);
   set(0,.99,.99);g.biasesO[8]=Math.atanh(.5);stepSimulation(r.state,r.settings,1/60);assert.equal(o.joints[0].gateMode,'oscillator');assert.equal(o.joints[1].gateMode,'off');}
  const report=rec.report();assert.ok(report.costJ<=reserve+1e-10);assert.equal(report.totals.deliveryErrorMax,0);
 }
});
