import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {SimulationHost} from '../simulationHost';
import {runIntegrationExperiment as run,type IntegrationRequest} from '../integrationExperiment';
import type {SolverTraceEvent} from '../solverTrace';
const input=JSON.parse(readFileSync('docs/experiments/prism-integration-v1-CUR-006.json','utf8'));
test('bounded solver telemetry leaves frozen Broadwake state, PRNG and prepaid work exactly unchanged',()=>{
 const host=new SimulationHost();
 for(const substeps of [32,64]) {
  const request:IntegrationRequest={ticks:8,substeps,splitting:'motor-drag',tape:input.tape};
  host.reset(input.snapshot,1);const plain=run(host,request),end=host.snapshot();
  host.reset(input.snapshot,2);
  const observed=run(host,{...request,solverTrace:{mode:'window',startTime:.1245,endTime:.1256}});
  assert.deepEqual(host.snapshot(),end);
  for(const key of ['positiveJ','brakingJ','motorJ','ledgerMotorJ','fluidPhysicalJ','fluidNumericalJ','guardLossJ','trajectory'] as const)
   assert.deepEqual(observed[key],plain[key]);
  const contact=observed.solverTrace!.events.find(e=>e.stage==='contact-impulse') as SolverTraceEvent;
  assert.ok(contact);assert.ok(Object.isFrozen((contact.before as object[])[0]));
  const body=observed.solverTrace!.events.find(e=>e.stage==='body-reference')!;
  const parts=body.parts as Array<{mass:number;inertia:number}>;assert.ok(parts.every(p=>p.mass>0&&p.inertia>0));
  assert.throws(()=>((contact.before as Array<{omega:number}>)[0].omega=999));
  assert.deepEqual(host.snapshot(),end,'receipt owns no mutable world references');
 }
});
test('invalid solver trace bounds/methods fail before advancing any state',()=>{
 const host=new SimulationHost();
 for(const invalid of [
  {ticks:61,substeps:32,solverTrace:{mode:'scan'}},
  {ticks:8,substeps:16,solverTrace:{mode:'scan'}},
  {ticks:8,substeps:32,solverTrace:{mode:'window',startTime:0,endTime:.1}},
  {ticks:8,substeps:32,solverTrace:{mode:'window',startTime:.12,endTime:.14}},
  {ticks:8,substeps:32,solverTrace:{mode:'window',startTime:NaN,endTime:.13}},
  {ticks:8,substeps:32,solverTrace:{mode:'unknown'}}
 ]) {
  host.reset(input.snapshot,1);const before=host.snapshot();
  assert.throws(()=>run(host,{...invalid,splitting:'motor-drag',tape:input.tape} as IntegrationRequest),/Invalid/);
  assert.deepEqual(host.snapshot(),before);
 }
});
