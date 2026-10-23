import assert from 'node:assert/strict';
import {gatedBiteFixture} from '../experiments/gatedBiteFixture.ts';
import {startGatedWorker} from './gated-worker-client.mjs';
import {createFounderGenome} from '../founders.ts';
import {makeGatedGenome} from '../experiments/gatedGenome.ts';
import {createInitialWorld, addExternalOrganism} from '../world.ts';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot} from '../persistence.ts';
import {SimulationHost} from '../simulationHost.ts';
import {measureWorkerTrial} from '../experiments/workerMetrics.ts';
const w = await startGatedWorker();
try {
  for (const architecture of ['two-output', 'three-output']) for (const hysteresisWidth of [0, .06]) {
    const config = {...DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3', motorExperiment: 'gated-torque-v1', targetNutrients: 0, inflowRate: 0};
    const s = createInitialWorld(config, 711, 'balanced', 'standard', 0);
    addExternalOrganism(s, makeGatedGenome(createFounderGenome('CUR-001'), architecture, hysteresisWidth, 711), config, 1200, 750, .37);
    const source = createSnapshot(s, config), host = new SimulationHost(); host.reset(source, 1);
    const expected = measureWorkerTrial(host, 90), actual = await w.trial(source, 90);
    assert.deepEqual(actual.snapshot, host.snapshot()); assert.deepEqual(actual.metrics, expected);
    const audited = await w.trial(source,90,{auditTorque:true});
    assert.deepEqual(audited.snapshot,actual.snapshot); assert.deepEqual(audited.metrics,actual.metrics);
    assert.equal(audited.torqueAudit.totals.deliveryErrorMax,0);
    assert.equal(audited.torqueAudit.guards,actual.metrics.guards);
    assert.ok(Math.abs(audited.torqueAudit.costJ-actual.metrics.motorJ)<1e-9);
    assert.ok(audited.torqueAudit.guardDecompositionError<1e-10);

    // Restore an intermediate state with noninitial hysteresis mode and continue.
    const restored = restoreSnapshot(actual.snapshot);
    assert.deepEqual(createSnapshot(restored.state, restored.settings), actual.snapshot);
    await w.reset(actual.snapshot); const continued = await w.request('experiment-step', {ticks: 30});
    measureWorkerTrial(host, 30); assert.deepEqual(continued.snapshot, host.snapshot());
    await assert.rejects(w.request('control', {settings: {...config, motorExperiment: undefined}, running: false}), /experiment/);
    await assert.rejects(w.request('experiment-step', {ticks: 3601}), /1–3600/);
    const bite=gatedBiteFixture(architecture,hysteresisWidth);
    const bitten=await w.trial(createSnapshot(bite.state,bite.config),1);
    const first=bitten.snapshot.state.organisms.find(o=>o.id===bite.victim.id);
    assert.ok(first.biteFeedbackJ>0); assert.ok(first.joints.every(j=>j.gateMode==='off'));
    const response=await w.request('experiment-step',{ticks:1});
    const second=response.snapshot.state.organisms.find(o=>o.id===bite.victim.id);
    assert.ok(second.neuralInputs[bite.input]>0);
    assert.ok(second.joints.every(j=>j.gateMode==='oscillator'));
    assert.ok(second.joints.some(j=>j.appliedTorque!==0));
  }
  const config = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
  await w.reset(createSnapshot(createInitialWorld(config, 711, 'balanced', 'standard', 0), config));
  await assert.rejects(w.request('experiment-step', {ticks: 1}), /explicit experimental/);
  console.log('Built Worker: four layouts, exact 90+30-tick continuation and metrics, physical-bite one-update OFF→OSCILLATOR response, switch rejection and bounded experimental stepping passed.');
} finally {await w.close();}
