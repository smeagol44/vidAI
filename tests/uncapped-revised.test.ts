import assert from 'node:assert/strict';import {test} from 'node:test';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {revisedHybridNetwork,uncappedRevisedSource,HYBRID_SEEDS,selectIntakeOnly,intakeMutation,mutationSeed} from '../experiments/uncappedRevisedIntake';
import {intakeSource} from '../experiments/hybridThresholdIntake';import {restoreSnapshot} from '../persistence';import {SimulationHost} from '../simulationHost';
import {selectHybridBand} from '../experiments/revisedHybridGate';
test('exact five #90 founders and original environments; only saved uncapped identity differs',()=>{
 for(const seed of HYBRID_SEEDS){const old=JSON.parse(gunzipSync(readFileSync(`docs/experiments/hybrid-threshold-intake-v1-${seed}-initial.json.gz`)).toString()),g=revisedHybridNetwork(seed);assert.deepEqual(g,old.initial.genome);
 const s=uncappedRevisedSource(g),normal=intakeSource(g);assert.equal(s.schemaVersion,'96.0.0');const normalized=structuredClone(s);delete normalized.settings.experimentalVelocityMode;normalized.schemaVersion='20.0.0';assert.deepEqual(normalized,normal);assert.equal(restoreSnapshot(s).settings.motorExperiment,'neural-motor-v2');
 const m=intakeMutation(g,mutationSeed(seed,1,0),0);assert.equal(m.mutation.kind,'neural');assert.equal(m.mutation.kind==='neural'&&m.mutation.changes.length,8);assert.deepEqual(m.genome.parts,g.parts);}
});
test('no first-valid gate: flagged actual founder retains ties; flagged higher feeding offspring becomes parent',()=>{
 const founder={absorbedJ:2400,valid:false,reasons:['speed guard','joint limit']};
 const zero={absorbedJ:0,valid:true,reasons:[]},tie={...founder,valid:true},winner={absorbedJ:4800,valid:false,reasons:['boundary','post-guard overspeed','anchor','constraint gain','chemical balance']};
 assert.equal(selectIntakeOnly(founder,[zero,tie]).best,founder);assert.equal(selectIntakeOnly(founder,[winner]).best,winner);assert.equal(selectIntakeOnly(winner,[{...winner}]).index,-1);assert.throws(()=>selectIntakeOnly(founder,[{...winner,absorbedJ:NaN}]),/Corrupt/);
});
test('uncapped schema cannot be smuggled into20/19/history or switched to another controller',()=>{
 const s=uncappedRevisedSource(revisedHybridNetwork(17));for(const schemaVersion of ['20.0.0','19.0.0','15.0.0','12.0.0','3.0.0'])assert.throws(()=>restoreSnapshot({...s,schemaVersion}));
 const missing=structuredClone(s);delete missing.settings.experimentalVelocityMode;assert.throws(()=>restoreSnapshot(missing),/velocity/);
 const wrong=structuredClone(s);wrong.settings.motorExperiment='neural-motor-v1';assert.throws(()=>restoreSnapshot(wrong),/experimental/);
});
test('revised boundaries and persistent hysteresis remain #90, not old±.30',()=>{
 assert.equal(selectHybridBand(.1,1),2);assert.equal(selectHybridBand(.04,1),1);assert.equal(selectHybridBand(-.94,1),1);assert.equal(selectHybridBand(-.97,1),0);assert.equal(selectHybridBand(.97,0),3);assert.equal(selectHybridBand(-.5,3),1);
});
test('actual engine bypasses both velocity clamps; physical torque and constraint solve remain',()=>{
 const s=uncappedRevisedSource(revisedHybridNetwork(17));s.settings.waterViscosity=0;const h=new SimulationHost();h.reset(s,1);h.state.organisms[0].segments.forEach(p=>{p.vx=900;p.angVel=55;});const forces:number[]=[],omega:number[]=[];
 h.tick(undefined,e=>{if(e.kind==='uncapped-part'&&e.stage==='forces'){forces.push(Math.hypot(e.vx,e.vy));omega.push(Math.abs(e.omega));}});assert.ok(Math.max(...forces)>800);assert.ok(Math.max(...omega)>20);assert.ok(h.state.organisms[0].joints.some(j=>j.appliedTorque!==0));
});
