import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SimulationHost} from '../simulationHost';
import {mechanicalFixture} from '../mechanicalAudit';
import {createSnapshot} from '../persistence';
import {runIntegrationExperiment as run, type CommandTape} from '../integrationExperiment';
function fixture(reserve?:number) {
  const f=mechanicalFixture();f.config.physicsRegime='prism-resistance-v4';f.org.genome.motorForce=20;
  if(reserve!==undefined)f.org.energy=reserve;
  const snapshot=createSnapshot(f.state,f.config),host=new SimulationHost();host.reset(snapshot,1);
  return {host,snapshot};
}
const request={ticks:12,substeps:4,splitting:'motor-drag' as const};
test('native capture/replay and ordinary simulation are full-state/PRNG identical',()=>{
  const {host,snapshot}=fixture();const captured=run(host,request),end=host.snapshot();
  const ordinary=new SimulationHost();ordinary.reset(snapshot,1);for(let i=0;i<12;i++)ordinary.tick();
  assert.deepEqual(end,ordinary.snapshot());
  host.reset(snapshot,2);const replay=run(host,{...request,tape:captured.tape});
  assert.deepEqual(host.snapshot(),end);assert.equal(replay.motorJ,captured.motorJ);
  assert.equal(replay.fluidPhysicalJ,captured.fluidPhysicalJ);
});
test('refined splitting preserves externally resupplied tape continuation and prepaid signed accounting',()=>{
  const {host,snapshot}=fixture();const tape=run(host,request).tape!;
  for(const splitting of ['motor-drag','motor-half-half','half-motor-half'] as const) {
    host.reset(snapshot,1);const r=run(host,{...request,substeps:16,splitting,tape}),end=host.snapshot();
    assert.ok(r.finite);assert.ok(r.fluidBalanceErrorJ<1e-12);assert.ok(Math.abs(r.motorJ-r.positiveJ*4)<1e-12);
    assert.ok(Math.abs(r.motorJ-r.ledgerMotorJ)<1e-12);assert.equal(r.mismatches,0);assert.ok(r.brakingJ>0);
    host.reset(snapshot,2);run(host,{ticks:5,substeps:16,splitting,tape});const halfway=host.snapshot();
    host.reset(halfway,3);run(host,{ticks:7,substeps:16,splitting,tape,offset:5});assert.deepEqual(host.snapshot(),end);
  }
});
test('malformed or incompatible tapes fail before advancing the world',()=>{
  const {host,snapshot}=fixture();const tape=run(host,request).tape!;
  for(const mutate of [(t:CommandTape)=>t.frames[3][0].torques[1].pop(),
    (t:CommandTape)=>t.frames[0][0].outputs[0]=NaN,(t:CommandTape)=>t.frames[0][0].torques[0][0]=1e100,
    (t:CommandTape)=>t.topology[0].outputs.reverse(),(t:CommandTape)=>t.startTime+=1]) {
    host.reset(snapshot,1);const copy=structuredClone(tape);mutate(copy);
    assert.throws(()=>run(host,{...request,tape:copy}));assert.deepEqual(host.snapshot(),snapshot);
  }
  host.reset(snapshot,1);assert.throws(()=>run(host,{...request,substeps:16}));assert.deepEqual(host.snapshot(),snapshot);
});

import {isolatedIntegrationControl} from '../integrationControl';
test('isolated constant-torque spin converges to the analytic quadratic/viscous solution with separate work and numerical loss',()=>{
  const control=isolatedIntegrationControl();
  for(const method of ['motor-drag','motor-half-half','half-motor-half']) {
    const rows=control.rows.filter(r=>r.method===method);
    for(let i=0;i<rows.length;i++) {
      assert.ok(rows[i].maxBalanceErrorJ<1e-14);assert.ok(rows[i].wholeBalanceErrorJ<=rows[i].sumBalanceErrorJ+1e-18);
      if(i)assert.ok(rows[i].error<.6*rows[i-1].error,'first-order error falls under refinement');
    }
    assert.ok(rows.at(-1)!.error/rows.at(-1)!.exact<.002);
  }
});
