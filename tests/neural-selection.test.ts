import assert from 'node:assert/strict';import {test} from 'node:test';
import {initialNetwork,parameterCount,mutateNetwork,mutationSeed,selectionSource,chooseElite,ARCHITECTURES,BUDGET} from '../experiments/neuralSelection';
import {selectionMetrics} from '../experiments/selectionMetrics';
import {createFounderGenome} from '../founders';import {SimulationHost} from '../simulationHost';
import {createTorqueRecorder} from '../experiments/torqueRecorder';import {measureWorkerTrial} from '../experiments/workerMetrics';
import {createSnapshot,restoreSnapshot,totalAccountedEnergy} from '../persistence';
test('all three fresh full networks share paired trunks/semantic rows, never donor weights or capacity edits',()=>{
 const donor=createFounderGenome('CUR-001'),before=structuredClone(donor);
 for(const seed of [17,71,1901]){
  const [l,s,h]=ARCHITECTURES.map(a=>initialNetwork(a,seed));assert.deepEqual([parameterCount(l),parameterCount(s),parameterCount(h)],[2172,2022,2322]);
  for(const key of ['weightsIH','weightsHH','biasesH'] as const){assert.deepEqual(l[key],s[key]);assert.deepEqual(l[key],h[key]);assert.notDeepEqual(l[key],donor[key]);}
  for(const g of [l,s,h]){assert.deepEqual(g.parts,donor.parts);assert.equal(g.motorForce,donor.motorForce);assert.equal(g.motorFrequency,donor.motorFrequency);assert.notDeepEqual(g.weightsHO,donor.weightsHO);assert.notDeepEqual(g.biasesO,donor.biasesO);}
  for(const g of [l,s])g.outputKeys!.forEach((key,i)=>{const j=h.outputKeys!.indexOf(key);assert.deepEqual(g.weightsHO[i],h.weightsHO[j]);assert.equal(g.biasesO[i],h.biasesO[j]);});
 }
 assert.deepEqual(createFounderGenome('CUR-001'),before);
});
test('mutations touch only neural parameters or one explicit hybrid selector; both directions accessible and parent immutable',()=>{
 for(const a of ARCHITECTURES){const p=initialNetwork(a,17),saved=structuredClone(p);
  for(let index=0;index<16;index++){
   const r=mutateNetwork(p,a,mutationSeed(17,1,index),index),c=r.genome;
   assert.deepEqual(c.parts,p.parts);assert.equal(c.motorForce,p.motorForce);assert.deepEqual(p,saved);
   if(r.mutation.kind==='selector'){assert.equal(a,'hybrid');assert.deepEqual(c.weightsHO,p.weightsHO);assert.equal(r.mutation.after.length,1);
    assert.deepEqual(mutateNetwork(c,a,1,index).genome.motorController,p.motorController);
   }else{assert.equal(r.mutation.changes.length,8);assert.deepEqual(c.motorController,p.motorController);
    const replay=structuredClone(p) as any;for(const e of r.mutation.changes){const values=e.column===undefined?replay[e.field]:replay[e.field][e.row],i=e.column??e.row;assert.equal(values[i],e.before);values[i]=e.after;}assert.deepEqual(replay,c);}
  }
 }
});
test('strict elitism selects only valid raw displacement, preserves beneficial mutations and keeps ties',()=>{
 const p={valid:true,distance:10,energy:100},invalid={valid:false,distance:999,energy:0},tie={valid:true,distance:10,energy:1},better={valid:true,distance:11,energy:1000};
 assert.deepEqual(chooseElite(p,[invalid,tie,better]),{best:better,index:2});assert.deepEqual(chooseElite(p,[invalid,tie]),{best:p,index:-1});assert.equal(chooseElite(null,[invalid]).best,null);
});
test('finite fully funded newborn trials preserve normal lifecycle and physical receipts; guard/late overspeed rejected',()=>{
 for(const a of ARCHITECTURES){const source=selectionSource(initialNetwork(a,17)),restored=restoreSnapshot(source);assert.deepEqual(createSnapshot(restored.state,restored.settings),source);
  assert.equal(source.state.organisms[0].energy,BUDGET.reserveJ);assert.equal(totalAccountedEnergy(restored.state),source.state.ledger.externalInflow);assert.equal(source.state.organisms[0].age,0);
  const host=new SimulationHost();host.reset(source,1);const recorder=createTorqueRecorder(),trajectory:any[]=[];
  const metrics=measureWorkerTrial(host,3,recorder.observe);const packet={metrics,torqueAudit:recorder.report(),snapshot:host.snapshot(),trajectory};
  const t=selectionMetrics(packet,3/60);assert.ok(t.reasons.every(x=>!['premature death/depletion','prepaid work','chemical balance'].includes(x)));
  packet.metrics.guards=1;assert.ok(selectionMetrics(packet,3/60).reasons.includes('speed guard'));
  packet.torqueAudit.maxPostContactAngularSpeed=21;assert.ok(selectionMetrics(packet,3/60).reasons.includes('post-guard overspeed'));
  const passive=new SimulationHost();passive.reset(selectionSource(initialNetwork(a,17),undefined,true),1);const m=measureWorkerTrial(passive,3);assert.equal(m.motorJ,0);assert.ok(m.founders[0].displacementPx<1e-8);
 }
});
