import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {startPhysicsWorker} from './physics-worker-client.mjs';
import {createFounderGenome} from '../founders.ts';
import {createInitialWorld,addExternalOrganism} from '../world.ts';
import {DEFAULT_SETTINGS,createSnapshot} from '../persistence.ts';

const root='docs/experiments/',output=root+'prism-integration-v1.json';
const protectedPaths=['solver-passivity-v3.json','prism-worker-v4.json','prism-worker-v4-excluded-work-factor.json','prism-worker-v4-excluded-stale-bundle.json'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const baselineHashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(readFileSync(root+p))]));
const old=JSON.parse(readFileSync(root+'prism-worker-v4.json'));
export function convergence(coarse,fine) {
  const end=r=>r.trajectory.at(-1)[0];
  const delta=(a,b)=>Math.abs(a-b),relative=(a,b)=>delta(a,b)<=Math.max(1e-7,.01*Math.abs(b));
  const finalVectorErrorPx=Math.hypot(end(coarse).x-end(fine).x,end(coarse).y-end(fine).y);
  const trajectoryRmsPx=Math.sqrt(coarse.trajectory.reduce((sum,frame,i)=>sum+(frame[0].x-fine.trajectory[i][0].x)**2+(frame[0].y-fine.trajectory[i][0].y)**2,0)/fine.trajectory.length);
  const checks={finalVector:finalVectorErrorPx<=Math.max(.25,.01*fine.displacementPx),trajectory:trajectoryRmsPx<=Math.max(.5,.01*fine.pathPx),
    ...Object.fromEntries(['positiveJ','brakingJ','fluidPhysicalJ','guardLossJ'].map(k=>[k,relative(coarse[k],fine[k])])),
    anchor:fine.maxAnchorPx<=.5&&delta(coarse.maxAnchorPx,fine.maxAnchorPx)<=.01,
    angularExposure:delta(coarse.angularGuardFraction,fine.angularGuardFraction)<=.01,
    linearExposure:delta(coarse.linearGuardFraction,fine.linearGuardFraction)<=.01,
    postContactExposure:delta(coarse.postContactOverspeedFraction,fine.postContactOverspeedFraction)<=.01,
    postContactPeak:delta(coarse.maxPostContactOmega,fine.maxPostContactOmega)<=.5,
    chemical:Math.max(coarse.maxChemicalErrorJ,fine.maxChemicalErrorJ)<1e-6};
  return {coarseHz:coarse.hz,fineHz:fine.hz,finalVectorErrorPx,trajectoryRmsPx,checks,pass:Object.values(checks).every(Boolean)};
}
const report={protocol:'prism-integration-v1',parent:'68538604995532440c317e4c98bdc506615ec760',baselineHashes,
  timingInferenceExcluded:'Study runtimes are informational only; use the separate reversed probe timing rounds for cost comparison.',
  criteria:'Predeclared #61 comment 6352694234. Finest adjacent pair; no relaxed thresholds; one capped3840Hz follow-up per failing body/method.',
  controls:{seed:711,heading:.37,legacyViscosity:.18,ticks:300,neuralHz:60,heldTorqueHz:240},bodies:[]};
const save=()=>writeFileSync(output,JSON.stringify(report)+'\n');
const worker=await startPhysicsWorker();report.workerAsset=worker.bundle.split('/').pop();
try {
  for(const id of ['CUR-008','CUR-007','CUR-006']) {
    const settings={...DEFAULT_SETTINGS,physicsRegime:'prism-resistance-v4',targetNutrients:0,inflowRate:0,mutationSeverity:0,waterViscosity:.18};
    const state=createInitialWorld(settings,711,'balanced','standard',0);addExternalOrganism(state,createFounderGenome(id),settings,1200,750,.37);
    const snapshot=createSnapshot(state,settings),inputPath=`prism-integration-v1-${id}.json`;
    await worker.reset(snapshot);
    const capture=await worker.request('integration-experiment',{request:{ticks:300,substeps:4,splitting:'motor-drag'}});
    const capturedEnd=await worker.request('snapshot'),tape=capture.tape;delete capture.tape;
    writeFileSync(root+inputPath,JSON.stringify({snapshot,tape})+'\n');
    const reference=old.swimming.find(r=>r.id===id&&r.regime==='prism-resistance-v4'&&r.heading===.37);
    assert.equal(capture.displacementPx,reference.founders[0].displacementPx,'archived native travel unchanged');
    assert.equal(capture.guardEvents,reference.guards,'archived native guards unchanged');
    const ordinary=await worker.trial(snapshot,300);assert.deepEqual(await worker.request('snapshot'),capturedEnd,'capture exactly ordinary built Worker');
    assert.equal(ordinary.positiveWorkJ,reference.positiveWorkJ);
    const body={id,inputPath,inputSha256:hash(readFileSync(root+inputPath)),native: capture,
      v3DisplacementPx:old.swimming.find(r=>r.id===id&&r.regime==='passive-work-v3'&&r.heading===.37).founders[0].displacementPx,
      exactNativeChecks:{archive:true,captureOrdinary:true,replay:false},rows:[],convergence:[]};report.bodies.push(body);
    for(const splitting of ['motor-drag','motor-half-half','half-motor-half']) {
      const steps=splitting==='motor-drag'?[4,8,16,32]:[4,16,32];
      for(const substeps of steps) {
        await worker.reset(snapshot);
        const r=await worker.request('integration-experiment',{request:{ticks:300,substeps,splitting,tape}});
        assert.ok(r.finite&&r.maxChemicalErrorJ<1e-6&&r.fluidBalanceErrorJ<1e-12);
        assert.equal(r.energyLimited,0);assert.equal(r.mismatches,0);
        assert.ok(Math.abs(r.motorJ-r.positiveJ*4)<1e-12);assert.ok(Math.abs(r.motorJ-r.ledgerMotorJ)<1e-12);
        assert.ok(Math.abs(r.absoluteTorqueImpulse-capture.absoluteTorqueImpulse)<1e-5,'same total held demand impulse');
        if(substeps===4&&splitting==='motor-drag') {assert.deepEqual(await worker.request('snapshot'),capturedEnd);body.exactNativeChecks.replay=true;}
        body.rows.push(r);save();console.log(JSON.stringify({id,hz:r.hz,splitting,travel:r.displacementPx,runtime:r.runtimeMs}));
      }
      let rows=body.rows.filter(r=>r.splitting===splitting);
      if(!convergence(rows.at(-2),rows.at(-1)).pass) {
        await worker.reset(snapshot);const r=await worker.request('integration-experiment',{request:{ticks:300,substeps:64,splitting,tape}});
        assert.ok(r.finite&&r.maxChemicalErrorJ<1e-6&&r.fluidBalanceErrorJ<1e-12);assert.equal(r.mismatches,0);
        assert.ok(Math.abs(r.motorJ-r.positiveJ*4)<1e-12);assert.ok(Math.abs(r.motorJ-r.ledgerMotorJ)<1e-12);
        assert.ok(Math.abs(r.absoluteTorqueImpulse-capture.absoluteTorqueImpulse)<1e-5);
        body.rows.push(r);rows.push(r);save();console.log(JSON.stringify({id,hz:r.hz,splitting,travel:r.displacementPx,runtime:r.runtimeMs,capped:true}));
      }
      for(let i=1;i<rows.length;i++)body.convergence.push({splitting,...convergence(rows[i-1],rows[i])});save();
    }
    // Exact resupplied-tape continuation in the actual built Worker, at refined
    // resolution and alternate ordering. The tape is deliberately not a save field.
    await worker.reset(snapshot);await worker.request('integration-experiment',{request:{ticks:150,substeps:16,splitting:'half-motor-half',tape}});
    const halfway=await worker.request('snapshot');await worker.reset(halfway);
    await worker.request('integration-experiment',{request:{ticks:150,substeps:16,splitting:'half-motor-half',tape,offset:150}});
    const fork=await worker.request('snapshot');await worker.reset(snapshot);
    await worker.request('integration-experiment',{request:{ticks:300,substeps:16,splitting:'half-motor-half',tape}});
    assert.deepEqual(await worker.request('snapshot'),fork);body.exactRefinedContinuation=true;save();
  }
  for(const p of protectedPaths)assert.equal(hash(readFileSync(root+p)),baselineHashes[p]);
  report.completed=true;save();
}finally{await worker.close();}
