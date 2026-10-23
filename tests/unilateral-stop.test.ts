import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unilateralLimitStep} from '../jointLimitImpulse';
import {readFileSync} from 'node:fs';
import {SimulationHost} from '../simulationHost';
import {runIntegrationExperiment as run} from '../integrationExperiment';
test('one-sided stops release returning motion and oppose outward motion at both bounds',()=>{
 assert.deepEqual(unilateralLimitStep(-1,.01,2,0,true),{impulse:0,total:0});
 assert.deepEqual(unilateralLimitStep(1,-.01,2,0,false),{impulse:0,total:0});
 const upper=unilateralLimitStep(1,.01,2,0,true);assert.ok(upper.impulse<0);assert.ok(Math.abs(1+2*upper.impulse+.01)<1e-12);
 const lower=unilateralLimitStep(-1,-.01,2,0,false);assert.ok(lower.impulse>0);assert.ok(Math.abs(-1+2*lower.impulse-.01)<1e-12);
 // Release can have a positive increment while accumulated upper pressure remains
 // nonpositive. Clamping each increment would incorrectly trap that pressure.
 const release=unilateralLimitStep(-1,.01,2,-.1,true);assert.equal(release.total,0);assert.equal(release.impulse,.1);
});
test('versioned diagnostic correction is external and native save continuation stays exact',()=>{
 const {snapshot,tape}=JSON.parse(readFileSync('docs/experiments/prism-integration-v1-CUR-006.json','utf8'));
 const host=new SimulationHost();host.reset(snapshot,1);
 const r={ticks:8,substeps:64,splitting:'motor-drag' as const,tape};
 run(host,r);const native=host.snapshot();host.reset(snapshot,2);
 run(host,{...r,jointLimits:'unilateral-stop-v1'});assert.deepEqual(host.snapshot(),native,'no active limit before first-contact control window');
 host.reset(snapshot,3);run(host,{...r,jointLimits:'unilateral-stop-v1',ticks:4});const mid=host.snapshot();
 host.reset(mid,4);run(host,{...r,jointLimits:'unilateral-stop-v1',ticks:4,offset:4});assert.deepEqual(host.snapshot(),native);
 host.reset(snapshot,5);assert.throws(()=>run(host,{...r,jointLimits:'unknown'} as never),/Invalid/);assert.deepEqual(host.snapshot(),snapshot);
});

import {gunzipSync} from 'node:zlib';
test('frozen active-stop kernel removes net outward reaction without hiding overspeed or rebilling work',()=>{
 const saved=JSON.parse(gunzipSync(readFileSync('docs/experiments/solver-event-windows-v1.json.gz')).toString());
 const w=saved.windows.find((w:{name:string;measured:{hz:number}})=>w.name==='first-overspeed'&&w.measured.hz===3840);
 const {tape}=JSON.parse(readFileSync('docs/experiments/prism-integration-v1-CUR-006.json','utf8'));
 const request={ticks:1,offset:24,substeps:64,splitting:'motor-drag' as const,tape,solverTrace:{mode:'window' as const,startTime:w.startTime,endTime:w.endTime}};
 const host=new SimulationHost();host.reset(w.startSnapshot,1);const old=run(host,request);assert.deepEqual(host.snapshot(),w.endSnapshot);
 const signedTotals=new Map<string,number>();
 for(const e of old.solverTrace!.events)if(e.stage==='joint-limit') {
  const key=e.substep+':'+e.joint;signedTotals.set(key,(signedTotals.get(key)??0)+Number(e.impulse)*Math.sign(Number(e.bias)));
 }
 assert.ok([...signedTotals.values()].some(x=>x>1e-9),'old equality stop pulls outward');
 host.reset(w.startSnapshot,2);const fixed=run(host,{...request,jointLimits:'unilateral-stop-v1'});
 const limits=fixed.solverTrace!.events.filter(e=>e.stage==='joint-limit');assert.ok(limits.length);
 assert.ok(limits.every(e=>Number(e.totalImpulse)*(e.upper?1:-1)<=0),'candidate net stop reactions are one-sided');
 assert.ok(fixed.maxPostContactOmega>20,'existing guard-placement limitation remains visible');
 assert.ok(Math.abs(fixed.motorJ-fixed.positiveJ*4)<1e-12&&Math.abs(fixed.motorJ-fixed.ledgerMotorJ)<1e-12);
 assert.equal(fixed.mismatches,0);assert.equal(fixed.energyLimited,0);assert.ok(fixed.maxChemicalErrorJ<1e-6);
});
