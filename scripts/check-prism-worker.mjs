import assert from 'node:assert/strict';
import {startPhysicsWorker} from './physics-worker-client.mjs';
import {mechanicalFixture} from '../mechanicalAudit.ts';
import {createSnapshot} from '../persistence.ts';
import {SimulationHost} from '../simulationHost.ts';

const worker=await startPhysicsWorker();
try {
  for(const regime of ['passive-work-v3','prism-resistance-v4']) {
    const f=mechanicalFixture();f.config.physicsRegime=regime;f.org.genome.motorForce=20;
    const source=createSnapshot(f.state,f.config);
    const observed=await worker.trial(source,90),end=await worker.request('snapshot');
    const host=new SimulationHost();host.reset(source,1);for(let i=0;i<90;i++)host.tick();
    assert.deepEqual(end,host.snapshot(),'actual built Worker equals authoritative direct host');
    const plain=await worker.trial(source,90,{audit:false}),plainEnd=await worker.request('snapshot');
    assert.deepEqual(end,plainEnd,'receipt collection leaves full state/PRNG unchanged');
    for(const key of ['founders','guards','positiveWorkJ','negativeWorkJ','motorJ','maxEnergyErrorJ'])assert.deepEqual(plain[key],observed[key]);
    assert.ok(observed.finite);assert.ok(observed.maxEnergyErrorJ<1e-6);
    assert.ok(Math.abs(observed.receipts.budgetCostJ-observed.motorJ)<1e-10);
    assert.equal(observed.receipts.requestAppliedMismatch,0);
    if(regime==='prism-resistance-v4') {
      assert.ok(observed.receipts.fluidSamples>0);assert.ok(observed.receipts.fluidBalanceErrorJ<1e-12);
      assert.equal(end.schemaVersion,'17.0.0');
      // Continue a real Worker export exactly through reset/fork.
      await worker.trial(end,12,{audit:false});const continued=await worker.request('snapshot');
      const fork=new SimulationHost();fork.reset(end,1);for(let i=0;i<12;i++)fork.tick();assert.deepEqual(continued,fork.snapshot());
    }
    await worker.reset(source);
    await assert.rejects(worker.request('physics-experiment-step',{ticks:0}),/Invalid physics experiment/);
    await assert.rejects(worker.request('physics-experiment-step',{ticks:3601}),/Invalid physics experiment/);
    await assert.rejects(worker.request('physics-experiment-step',{ticks:1,audit:'yes'}),/Invalid physics experiment/);
    const other=regime==='passive-work-v3'?'prism-resistance-v4':'passive-work-v3';
    await assert.rejects(worker.request('control',{settings:{...source.settings,physicsRegime:other},running:false,speed:1,selected:null}),/resetting/);
  }
  console.log('Prism built Worker: exact host/observed/unobserved/fork continuation, work/drag receipts, strict request and regime gates passed.');
}finally{await worker.close();}
