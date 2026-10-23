import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runScissorBenchmark as run,scissorFixture,scissorTarget,SCISSOR} from '../scissorBenchmark';
import {rectangleContact} from '../contacts';
import {validateGenome} from '../persistence';

test('private1x7 corner geometry clears the whole stroke and cannot weaken ordinary save anatomy',()=>{
  const {o}=scissorFixture('passive-work-v3');
  assert.throws(()=>validateGenome(o.genome),/dimensions/);
  for(let i=0;i<=180;i++){
    const a=o.segments[0],b=o.segments[1],q=-Math.PI+i*Math.PI/180,c=Math.cos(q),s=Math.sin(q);
    b.angle=q;b.x=a.x+.5-c*.5-s*3.5;b.y=a.y+3.5-s*.5+c*3.5;
    assert.ok((rectangleContact(a,o.genome.parts[0],b,o.genome.parts[1])?.depth??0)<1e-10);
  }
  assert.equal(scissorTarget(0,'slow-open').aperture,SCISSOR.closed);
  assert.equal(scissorTarget(3,'slow-open').aperture,SCISSOR.open);
  assert.equal(scissorTarget(3.5,'slow-open').phase,'pause');
});
test('scissor controls are brain-free, prepaid, reproducible and passive controls stay at rest',()=>{
  for(const regime of ['passive-work-v3','prism-resistance-v4'] as const){
    const request={version:SCISSOR.version,regime,program:'slow-open' as const,substeps:4 as const,cycles:1 as const};
    const a=run(request),b=run({...request,audit:false});
    assert.deepEqual(a.stateReceipt,b.stateReceipt,'read-only telemetry does not alter complete fixture state');
    const replay=run({...request,tape:a.tape});assert.deepEqual(replay.stateReceipt,a.stateReceipt);
    assert.ok(a.brainUnchanged&&a.positiveJ>0);assert.equal(a.energyLimited,0);
    assert.ok(Math.abs(a.motorJ-4*a.positiveJ)<1e-12);assert.ok(Math.abs(a.ledgerMotorJ-a.motorJ)<1e-12);
    assert.ok(a.maxChemicalErrorJ<1e-8);assert.ok(Math.abs(a.mechanicalResidualJ!)<1e-12);
    const passive=run({...request,program:'passive'});assert.ok(passive.displacementPx<1e-9);assert.equal(passive.motorJ,0);
    assert.throws(()=>run({...request,tape:[NaN]}),/Invalid/);
  }
});
