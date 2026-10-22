import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {startPhysicsWorker} from './physics-worker-client.mjs';
import {createFounderGenome} from '../founders.ts';
import {createInitialWorld,addExternalOrganism} from '../world.ts';
import {DEFAULT_SETTINGS,createSnapshot} from '../persistence.ts';
import {PRISM_REFERENCE} from '../prismPhysics.ts';

const output=process.argv[2]??'docs/experiments/prism-worker-v4.json';
const archivePath='docs/experiments/solver-passivity-v3.json',archive=JSON.parse(readFileSync(archivePath,'utf8'));
const hash=()=>createHash('sha256').update(readFileSync(archivePath)).digest('hex');
const archiveHash=hash(),report={protocol:'prism-worker-v4',profile:PRISM_REFERENCE,baselineSha256:archiveHash,
  sourceBaseline:'d7a68144b02225db37bb6a9583b057458ff47d52',
  excludedStaleBundleRun:{path:'prism-worker-v4-excluded-stale-bundle.json',reason:'Invalid harness rerun: stale Worker asset selected. Not evidence for the corrected v4 model.'},
  excludedRun:{path:'prism-worker-v4-excluded-work-factor.json',reason:'Invalid candidate: missed motor-batch call-site retained legacy J conversion. Not evidence for the corrected v4 model.'},swimming:[],ecology:[],performance:[],
  notes:['No starter/controller/strength/chemical-stock changes; no selection or search.',
    'v4 ignores legacy waterViscosity and uses its explicit fixed SI profile. No validated SI equivalence is claimed for v3.',
    'Performance includes the same observation-free trial census overhead in both regimes; not browser FPS.']};
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
function candidate(snapshot,regime) {
  const copy=structuredClone(snapshot);copy.settings.physicsRegime=regime;copy.schemaVersion=regime==='prism-resistance-v4'?'17.0.0':'15.0.0';return copy;
}
const worker=await startPhysicsWorker();
report.workerAsset=worker.bundle.split('/').pop();
try {
  for(const old of archive.swimming.filter(r=>r.physicsRegime==='passive-work-v3')) {
    const settings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',targetNutrients:0,inflowRate:0,mutationSeverity:0,waterViscosity:old.viscosity};
    const state=createInitialWorld(settings,711,'balanced','standard',0);
    addExternalOrganism(state,createFounderGenome(old.id),settings,1200,750,old.heading);
    const source=createSnapshot(state,settings);
    for(const regime of ['passive-work-v3','prism-resistance-v4']) {
      const metrics=await worker.trial(candidate(source,regime),300);
      const row={id:old.id,heading:old.heading,legacyViscosity:old.viscosity,regime,...metrics};report.swimming.push(row);save();
      assert.ok(metrics.finite);assert.ok(metrics.maxEnergyErrorJ<1e-6);
      if(regime==='passive-work-v3') {
        for(const [key,value] of Object.entries({displacementPx:metrics.founders[0].displacementPx,reserveSpentJ:metrics.founders[0].reserveSpentJ,
          guards:metrics.guards,limitedBatches:metrics.limitedBatches,maxAnchorErrorPx:metrics.maxTickAnchorPx,maxLimitExcessRad:metrics.maxTickLimitRad}))
          assert.equal(value,old[key],`${old.id} baseline ${key}`);
      }
      console.log(JSON.stringify({id:old.id,heading:old.heading,regime,travelPx:metrics.founders[0].displacementPx,guards:metrics.guards}));
    }
  }
  for(const seed of [17,73]) {
    const settings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',mouthContactModel:'capsule-v1',ecologyRegime:'closed-v1',nutrientLimit:null};
    const source=createSnapshot(createInitialWorld(settings,seed,'balanced','showcase'),settings);
    for(const regime of ['passive-work-v3','prism-resistance-v4']) {
      const metrics=await worker.trial(candidate(source,regime),3600);
      report.ecology.push({seed,regime,...metrics});save();assert.ok(metrics.finite);assert.ok(metrics.maxEnergyErrorJ<1e-6);
      if(regime==='passive-work-v3') {
        const old=archive.ecology.find(r=>r.seed===seed&&r.physicsRegime===regime);
        for(const [key,value]of Object.entries(metrics.stats))assert.deepEqual(value,old[key],`ecology ${seed} ${key}`);
        assert.deepEqual(metrics.absorbedJ,old.absorbedJ);assert.equal(metrics.guards,old.guards);
      }
      console.log(JSON.stringify({seed,regime,population:metrics.ecology.population,intake:metrics.absorbedJ}));
    }
  }
  // Established workload: 15 creatures, 78 food and 221 remains, including the
  // same inherited-mask path as scripts/performance-benchmark.ts. No weights change.
  const settings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',targetNutrients:78,inflowRate:0,mutationSeverity:0};
  const state=createInitialWorld(settings,82,'balanced','standard',15);
  const {brainEdgeKey}=await import('../simulation.ts');
  for(const o of state.organisms)o.genome.disabledConnections.push(brainEdgeKey('ih',o.genome.hiddenIds[0],'body:injury'));
  for(let i=0;i<221;i++) {
    state.nutrients.push({id:`benchmark-remains-${i}`,kind:'carrion',x:state.prng.range(40,2360),y:state.prng.range(40,1460),vx:0,vy:0,
      energyValue:3000,radius:18,decayTimeRemaining:60,bottomTimer:0,pulseTimer:0});state.ledger.externalInflow+=3000;
  }
  const source=createSnapshot(state,settings);
  for(let round=0;round<2;round++)for(const regime of round?['prism-resistance-v4','passive-work-v3']:['passive-work-v3','prism-resistance-v4']) {
    await worker.trial(candidate(source,regime),10,{audit:false});
    const metrics=await worker.request('physics-experiment-step',{ticks:120,audit:false});
    report.performance.push({round:round+1,regime,creatures:15,food:78,remains:221,...metrics});save();
    console.log(JSON.stringify({round:round+1,regime,runtimeMs:metrics.runtimeMs}));
  }
  assert.equal(hash(),archiveHash);report.completed=true;save();
}finally{await worker.close();}
