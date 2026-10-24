import assert from 'node:assert/strict';import {test} from 'node:test';
import {uncappedSource,intakeNetwork,chooseUncappedElite} from '../experiments/uncappedIntake';
import {restoreSnapshot} from '../persistence';import {SimulationHost} from '../simulationHost';
import {intakeSource} from '../experiments/nutrientIntake';
test('uncapped semantics require identified new schema; old schemas cannot acquire them',()=>{
 const s=uncappedSource(intakeNetwork('neural-hybrid'));assert.equal(s.schemaVersion,'94.0.0');assert.equal(restoreSnapshot(s).settings.experimentalVelocityMode,'uncapped-hybrid-v1');
 for(const schemaVersion of ['19.0.0','18.0.0','16.0.0','15.0.0','12.0.0','3.0.0'])assert.throws(()=>restoreSnapshot({...s,schemaVersion}),/experimental|physics/);
 const wrong=structuredClone(s);delete wrong.settings.experimentalVelocityMode;assert.throws(()=>restoreSnapshot(wrong),/velocity/);
 const old=intakeSource(intakeNetwork('neural-hybrid'));assert.equal(old.schemaVersion,'19.0.0');assert.equal(restoreSnapshot(old).settings.experimentalVelocityMode,undefined);
});
test('selection ignores every old feasibility flag and preserves ties; corrupted intake fails explicitly',()=>{
 const p={absorbedJ:0,valid:true},o={absorbedJ:48,valid:false,reasons:['speed guard','joint limit','boundary'],peakPostContactOmega:1e6};
 assert.equal(chooseUncappedElite(p,[o]).best,o);assert.equal(chooseUncappedElite(o,[{...o,absorbedJ:48}]).index,-1);
 assert.throws(()=>chooseUncappedElite(p,[{absorbedJ:NaN,valid:true}]),/Corrupt/);
});
test('force stage has no replacement speed cap; old path remains capped',()=>{
 for(const uncapped of [false,true]){
  const s=uncapped?uncappedSource(intakeNetwork('neural-hybrid')):intakeSource(intakeNetwork('neural-hybrid'));
  s.settings.waterViscosity=0;const h=new SimulationHost();h.reset(s,1);
  for(const p of h.state.organisms[0].segments){p.vx=900;p.vy=0;p.angVel=55;}
  const speeds:number[]=[],omegas:number[]=[];
  h.tick(undefined,e=>{if(e.kind==='uncapped-part'&&e.stage==='forces'){speeds.push(Math.hypot(e.vx,e.vy));omegas.push(Math.abs(e.omega));}});
  if(uncapped){assert.ok(Math.max(...speeds)>800);assert.ok(Math.max(...omegas)>20);}else assert.ok(h.state.organisms[0].motorDiagnostics!.numericalGuardEvents>0);
 }
});
