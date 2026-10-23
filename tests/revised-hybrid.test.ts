import assert from 'node:assert/strict';import {test} from 'node:test';
import {selectHybridBand,revisedHybridTorque,hybridBandMode,HYBRID_BOUNDARIES,type HybridBand} from '../experiments/revisedHybridGate';
import {HYBRID_SEEDS,revisedHybridNetwork,intakeSource,intakeMutation,mutationSeed} from '../experiments/hybridThresholdIntake';
import {intakeNetwork} from '../experiments/nutrientIntake';import {foodNetwork} from '../experiments/neuralFood';
import {SimulationHost} from '../simulationHost';import {restoreSnapshot,createSnapshot,validateGenome} from '../persistence';
import {createTorqueRecorder} from '../experiments/torqueRecorder';import {stepSimulation} from '../simulation';
test('nominal endpoints, including exactly-.9 DIRECT, 0 DIRECT and +.9 OSC, both extreme OFF regions',()=>{
 for(const old of [0,1,2,3] as const)for(const [x,b] of [[-1,0],[-.90000001,0],[-.9,1],[-.89999999,1],[-.00000001,1],[0,1],[.00000001,2],[.89999999,2],[.9,2],[.90000001,3],[1,3]] as const)assert.equal(selectHybridBand(x,old,0),b);
});
test('width.06 hysteresis on all THREE boundaries in both directions; endpoint equality holds previous band',()=>{
 HYBRID_BOUNDARIES.forEach((boundary,i)=>{const lo=i as HybridBand,hi=(i+1) as HybridBand;
  assert.equal(selectHybridBand(boundary+.06,lo),lo);assert.equal(selectHybridBand(boundary+.06000001,lo),hi);
  assert.equal(selectHybridBand(boundary-.06,hi),hi);assert.equal(selectHybridBand(boundary-.06000001,hi),lo);
  let a=lo,b=hi;for(let k=0;k<100;k++){const x=boundary+(k%2?.01:-.01);a=selectHybridBand(x,a);b=selectHybridBand(x,b);}assert.equal(a,lo);assert.equal(b,hi);
 });
 assert.equal(selectHybridBand(.95,3),3);assert.equal(selectHybridBand(.83,3),2);assert.equal(selectHybridBand(-.95,0),0);assert.equal(selectHybridBand(-.83,0),1);
});
test('every ordered band/mode pair decisive in ONE call, no timed state; traverses DIRECT/OSC and either OFF',()=>{
 const centers=[-1,-.5,.5,1] as const;for(const from of [0,1,2,3] as const)for(const to of [0,1,2,3] as const){const b=selectHybridBand(centers[to],from);assert.equal(b,to);assert.equal(hybridBandMode(b),hybridBandMode(to));}
 assert.equal(selectHybridBand(.94,1),2);assert.equal(selectHybridBand(-.94,2),1);assert.throws(()=>selectHybridBand(NaN,1));assert.throws(()=>selectHybridBand(0,4 as HybridBand));
});
test('both OFF bands give exactly zero active torque, DIRECT signed reversal, unchanged oscillator command mapping/ceiling',()=>{
 for(const previous of [0,1,2,3] as const){for(const off of [-1,1])assert.equal(revisedHybridTorque(off,1,previous,1,100).torque,0);
  assert.equal(revisedHybridTorque(-.5,.7,previous,1,100).torque,70);assert.equal(revisedHybridTorque(-.5,-.7,previous,1,100).torque,-70);
  assert.equal(revisedHybridTorque(.5,0,previous,-.8,100).torque,-40);assert.equal(revisedHybridTorque(.5,-1,previous,1,100).torque,0);assert.equal(revisedHybridTorque(.5,1,previous,1,100).torque,100);
 }
});
test('fresh weights/trunks and all noncontroller genes unchanged, no targeted initialization; eight normal neural mutations, both rows accessible',()=>{
 for(const seed of HYBRID_SEEDS){const g=revisedHybridNetwork(seed),old=foodNetwork('two-output',seed),copy=structuredClone(g);copy.motorController=old.motorController;assert.deepEqual(copy,old);assert.equal(g.outputKeys!.length,4);assert.ok(!('signedJoints' in g.motorController!));
  for(let i=0;i<15;i++){const m=intakeMutation(g,mutationSeed(seed,1,i),i);assert.equal(m.mutation.kind,'neural');assert.equal(m.mutation.kind==='neural'&&m.mutation.changes.length,8);assert.deepEqual(m.genome.parts,g.parts);assert.deepEqual(m.genome.motorController,g.motorController);}
 }
 let both=false;for(let seed=1;seed<=512&&!both;seed++){const m=intakeMutation(revisedHybridNetwork(17),seed,0).mutation;if(m.kind!=='neural')throw Error('Unexpected genetic selector');const rows=m.changes.filter(e=>e.field==='weightsHO'||e.field==='biasesO').map(e=>e.row);both=rows.some(i=>i%2===0)&&rows.some(i=>i%2===1);}assert.ok(both);
 const old=intakeSource(intakeNetwork('neural-hybrid')),fresh=intakeSource(revisedHybridNetwork(17));assert.deepEqual(fresh.state.nutrients,old.state.nutrients);assert.deepEqual(fresh.state.prngState,old.state.prngState);const settings={...fresh.settings,motorExperiment:old.settings.motorExperiment};assert.deepEqual(settings,old.settings);
});
test('schema20 strictly preserves FOUR-band latch, refuses smuggling/mismatch; schema19 remains exact and unchanged',()=>{
 const source=intakeSource(revisedHybridNetwork(17));assert.equal(source.schemaVersion,'20.0.0');const h=new SimulationHost();h.reset(source,1);h.tick();const mid=h.snapshot(),r=restoreSnapshot(mid);assert.deepEqual(createSnapshot(r.state,r.settings),mid);
 const fork=new SimulationHost();fork.reset(mid,1);h.tick();fork.tick();assert.deepEqual(h.snapshot(),fork.snapshot());
 for(const mutate of [(s:any)=>s.schemaVersion='19.0.0',(s:any)=>s.settings.motorExperiment='neural-motor-v1',(s:any)=>delete s.state.organisms[0].joints[0].gateBand,(s:any)=>s.state.organisms[0].joints[0].gateBand=3,(s:any)=>s.state.organisms[0].genome.motorController.architecture='direct-only',(s:any)=>s.state.organisms[0].genome.motorController.hysteresisWidth=0]){const s=structuredClone(source);mutate(s);assert.throws(()=>restoreSnapshot(s));}
 const old=intakeSource(intakeNetwork('neural-hybrid'));assert.equal(old.schemaVersion,'19.0.0');const restored=restoreSnapshot(old);assert.deepEqual(createSnapshot(restored.state,restored.settings),old);old.state.organisms[0].joints[0].gateBand=1;assert.throws(()=>restoreSnapshot(old));
 const g=revisedHybridNetwork(17);(g.motorController as any).signedJoints=[];assert.throws(()=>validateGenome(g));
});
test('real v3 kernel applies independent signed/osc torques, paid work, immediate positive/negative OFF and roundtrip positive-OFF hysteresis',()=>{
 const x=restoreSnapshot(intakeSource(revisedHybridNetwork(17))),o=x.state.organisms[0],g=o.genome;g.weightsHO.forEach(r=>r.fill(0));g.biasesO=[Math.atanh(-.5),Math.atanh(.001),Math.atanh(.5),Math.atanh(-.5)];
 const t=createTorqueRecorder();stepSimulation(x.state,x.settings,1/60,undefined,undefined,t.observe);assert.equal(o.joints[0].gateMode,'direct');assert.ok(o.joints[0].appliedTorque>0);assert.equal(o.joints[1].gateMode,'oscillator');assert.ok(o.joints[1].appliedTorque!==0);assert.ok(Math.abs(t.report().costJ-4*t.report().positiveJ)<1e-9);
 for(const bias of [-3,3]){g.biasesO=[bias,1,bias,1];stepSimulation(x.state,x.settings,1/60);assert.ok(o.joints.every(j=>j.gateMode==='off'&&j.appliedTorque===0));}
 const snap=createSnapshot(x.state,x.settings),fork=restoreSnapshot(snap);g.biasesO=[Math.atanh(.88),1,Math.atanh(.88),1];fork.state.organisms[0].genome.biasesO=[...g.biasesO];stepSimulation(x.state,x.settings,1/60);stepSimulation(fork.state,fork.settings,1/60);assert.deepEqual(createSnapshot(x.state,x.settings),createSnapshot(fork.state,fork.settings));assert.ok(o.joints.every(j=>j.gateBand===3&&j.appliedTorque===0));
});
