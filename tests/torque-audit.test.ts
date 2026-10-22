import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SimulationHost} from '../simulationHost';
import {createSnapshot, restoreSnapshot} from '../persistence';
import {measureWorkerTrial} from '../experiments/workerMetrics';
import {createTorqueRecorder} from '../experiments/torqueRecorder';
import {torqueAuditSource, TORQUE_AUDIT_VARIANTS, TORQUE_AUDIT_CONDITIONS} from '../experiments/torqueAuditSetup';
import {createFounderGenome} from '../founders';

test('actuation receipts preserve complete snapshots, metrics and PRNG in all six diagnostic cases', () => {
  for(const variant of TORQUE_AUDIT_VARIANTS) {
    const source=torqueAuditSource('CUR-002',variant,TORQUE_AUDIT_CONDITIONS[0]);
    const plain=new SimulationHost(),observed=new SimulationHost(); plain.reset(source,1);observed.reset(source,1);
    const recorder=createTorqueRecorder();
    const expected=measureWorkerTrial(plain,30),actual=measureWorkerTrial(observed,30,recorder.observe);
    assert.deepEqual(actual,expected);assert.deepEqual(observed.snapshot(),plain.snapshot());
    assert.deepEqual(createSnapshot(restoreSnapshot(observed.snapshot()).state,observed.settings),observed.snapshot());
    const report=recorder.report();
    assert.equal(report.totals.samples,30*4*observed.state.organisms[0].joints.length);
    assert.equal(report.totals.appliedNormalized.count,report.totals.samples);
    assert.equal(report.totals.deliveryErrorMax,0);
    assert.equal(report.guards,actual.guards);
    assert.ok(Math.abs(report.costJ-actual.motorJ)<1e-10);
    assert.ok(Math.abs(report.positiveJ-actual.positiveWorkJ)<1e-10);
    assert.ok(Math.abs(report.negativeJ-actual.negativeWorkJ)<1e-10);
    assert.ok(report.maxAnchorPx>=actual.maxAnchorPx && report.maxLimitRad>=actual.maxLimitRad);
  }
});

test('read-only receipts account for zero/tiny reserves and exact paid torque scaling', () => {
  for(const energy of [0,1e-12,.001,10000]) {
    const source=torqueAuditSource('CUR-001','two-output/hard',TORQUE_AUDIT_CONDITIONS[0]);
    const o=source.state.organisms[0];source.state.ledger.externalInflow+=energy-o.energy;o.energy=energy;
    const host=new SimulationHost();host.reset(source,1);const r=createTorqueRecorder();
    const metrics=measureWorkerTrial(host,1,s=>{assert.ok(Object.isFrozen(s));r.observe(s);});
    const report=r.report();assert.equal(report.totals.deliveryErrorMax,0);
    assert.ok(report.costJ<=energy+1e-10);assert.ok(metrics.maxEnergyErrorJ<1e-6);
    if(energy===0)assert.equal(report.totals.appliedNormalized.maxAbs,0);
    if(energy>0&&energy<1)assert.ok(report.limitedBatches>0);
  }
});

test('fresh-head control changes only copied legacy HO weights and biases, with no strength or body tuning', () => {
  const original=createFounderGenome('CUR-009');
  const a=torqueAuditSource('CUR-009','legacy-six-output',TORQUE_AUDIT_CONDITIONS[0]);
  const b=torqueAuditSource('CUR-009','legacy-fresh-head',TORQUE_AUDIT_CONDITIONS[0]);
  const erase=(g:any)=>{g.weightsHO=[];g.biasesO=[];};
  for(const s of [a,b]){s.state.organisms.forEach(o=>erase(o.genome));s.state.lineage.forEach(([,r])=>erase(r.genome));}
  assert.deepEqual(b,a);
  assert.deepEqual(createFounderGenome('CUR-009'),original);
});
