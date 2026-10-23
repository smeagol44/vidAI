import assert from 'node:assert/strict';
import {test} from 'node:test';
import {serpentFixture,assembleSerpent,serpentTarget,shapeLoopArea,runSerpentBenchmark as run,SERPENT} from '../serpentBenchmark';
import {rectangleContact} from '../contacts';
import {validateGenome} from '../persistence';

test('serpent opposing-end-corner chain clears the requested two-joint shape domain without save relaxation',()=>{
  const {o}=serpentFixture('passive-work-v3');assert.throws(()=>validateGenome(o.genome),/dimensions/);
  for(let a=-30;a<=30;a+=3)for(let b=-30;b<=30;b+=3){
    assembleSerpent(o,[a*Math.PI/180,b*Math.PI/180]);
    for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok((rectangleContact(o.segments[i],o.genome.parts[i],o.segments[j],o.genome.parts[j])?.depth??0)<1e-10);
  }
  assert.deepEqual(serpentTarget(0,'traveling'),[0,-0]);
  const points=Array.from({length:241},(_,i)=>serpentTarget(4+4*i/240,'traveling'));
  assert.ok(Math.abs(shapeLoopArea(points)-Math.PI*SERPENT.amplitude**2)<.0002);
  assert.ok(shapeLoopArea(Array.from({length:241},(_,i)=>serpentTarget(4+4*i/240,'reverse')))<0);
  assert.ok(Math.abs(shapeLoopArea(Array.from({length:241},(_,i)=>serpentTarget(4+4*i/240,'reciprocal'))))<1e-15);
});
test('two independent brain-free torque channels retain prepaid work and exact telemetry/tape replay',()=>{
  for(const regime of ['passive-work-v3','prism-resistance-v4'] as const){
    const request={version:SERPENT.version,regime,program:'traveling' as const,substeps:4 as const,cycles:1 as const};
    const a=run(request),b=run({...request,tape:a.tape,audit:false});
    assert.deepEqual(a.stateReceipt.state,b.stateReceipt.state);
    assert.ok(a.tape.some(row=>row[0]!==row[1]));assert.ok(a.tape.some(row=>row[0]*row[1]<0));
    assert.ok(a.brainUnchanged&&a.positiveJ>0);assert.equal(a.energyLimited,0);
    assert.ok(Math.abs(a.motorJ-4*a.positiveJ)<1e-12&&Math.abs(a.ledgerMotorJ-a.motorJ)<1e-12);
    assert.ok(a.maxChemicalErrorJ<1e-8&&Math.abs(a.mechanicalResidualJ!)<1e-12);
    const p=run({...request,program:'passive'});assert.ok(p.displacementPx<1e-9);assert.equal(p.motorJ,0);
    assert.throws(()=>run({...request,tape:a.tape.map((row,i)=>i===959?[row[0],NaN]:row)}),/Invalid/);
  }
});
