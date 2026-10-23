/** Frozen receipts/decisions and final revised-hybrid replay only. No search or legacy evaluation. */
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {root,readArchive,hash,geneHash,median} from './intake-archive.mjs';
import {HYBRID_SEEDS as SEEDS,HYBRID_BUDGET as B,HYBRID_OPTIONS,revisedHybridNetwork,intakeMutation,intakeSource,intakeMetrics,chooseIntakeElite,mutationSeed} from '../experiments/hybridThresholdIntake.ts';import {startGatedWorker} from './gated-worker-client.mjs';
const prefix='hybrid-threshold-intake-v1',manifest=readArchive(prefix+'.json');assert.ok(manifest.completed);assert.deepEqual(manifest.seeds,SEEDS);assert.deepEqual(manifest.counts,{initial:5,offspring:1125,heldOut:30,totalSelectionAndHeldOut:1160});
for(const f of manifest.files)assert.equal(hash(readFileSync(root+f.archive)),f.sha256,f.archive);
for(const [p,h]of Object.entries(manifest.protectedHashes))assert.equal(hash(readFileSync(root+p)),h,p);
for(const [p,h]of Object.entries(manifest.codeHashes))assert.equal(hash(readFileSync(p)),h,p);
const champions=readArchive(prefix+'-champions.json.gz').champions,held=readArchive(prefix+'-held-out.json.gz').heldOut;assert.equal(held.length,30);
const logBytes=readFileSync(root+prefix+'-run.log'),log=logBytes.toString().trim().split('\n').map(JSON.parse),report=[],derivedGenerationIndex=[];let count=0,originalGenerationLogRowsVerified=0;
for(const seed of SEEDS){const initial=readArchive(prefix+'-'+seed+'-initial.json.gz').initial;assert.deepEqual(initial.genome,revisedHybridNetwork(seed));let parent=initial.genome,best=initial.trial.valid?initial.trial:null,bestRef=best?'initial':null;
 for(let generation=1;generation<=B.generations;generation++){const d=readArchive(prefix+'-'+seed+`-g${String(generation).padStart(2,'0')}.json.gz`);assert.equal(d.parentHash,geneHash(parent));assert.equal(d.offspring.length,15);
  for(const o of d.offspring){assert.equal(o.mutationSeed,mutationSeed(seed,generation,o.index));const r=intakeMutation(parent,o.mutationSeed,o.index);assert.deepEqual(r.mutation,o.mutation);assert.equal(geneHash(r.genome),o.genomeSha);count++;}
  const elite=chooseIntakeElite(best,d.offspring.map(x=>x.trial));assert.equal(elite.index,d.selectedIndex);if(elite.index>=0){parent=intakeMutation(parent,d.offspring[elite.index].mutationSeed,elite.index).genome;best=elite.best;bestRef=`g${generation}/o${elite.index}`;}
  assert.deepEqual(parent,d.selectedGenome);assert.equal(geneHash(parent),d.selectedGenomeSha);assert.equal(best?.absorbedJ??null,d.bestAbsorbedJ);assert.equal(bestRef,d.bestRef);
  const valid=d.offspring.filter(x=>x.trial.valid);assert.equal(d.offspringMedianValidJ,median(valid.map(x=>x.trial.absorbedJ)));assert.equal(d.fedOffspring,d.offspring.filter(x=>x.trial.absorbedJ>0).length);
  const line=log.find(x=>x.seed===seed&&x.generation===generation);if(line){for(const [k,v]of Object.entries(line))if(k!=='seed')assert.deepEqual(d[k],v);originalGenerationLogRowsVerified++;}
  derivedGenerationIndex.push({seed,...Object.fromEntries(Object.entries(d).filter(([k])=>!['seed','version','selectedGenome','selectedMutation','offspring'].includes(k)))});
 }
 const c=champions.find(x=>x.seed===seed);assert.equal(c.champion?.genomeSha??geneHash(c.initial.genome),geneHash(parent));assert.equal(c.champion?.training.finalSnapshotSha??null,best?.finalSnapshotSha??null);
 report.push({seed,genotypesAndDecisionsExact:225,championAvailable:!!best,initialJ:initial.trial.absorbedJ,initialValid:initial.trial.valid,finalJ:best?.absorbedJ??null,selectedAt:bestRef});
}
assert.equal(count,1125);assert.equal(manifest.historicalLegacy.reexecuted,false);
const w=await startGatedWorker();try{
 assert.equal(hash(readFileSync(new URL(w.bundle))),manifest.workerSha);
 for(const {seed,initial,champion}of champions){const genome=champion?.genome??initial.genome,expected=champion?.training??initial.trial,r=await w.trial(intakeSource(genome),720,HYBRID_OPTIONS),m={...intakeMetrics(r),modeAudit:r.modeAudit},e={...expected};for(const k of ['wallMs','trajectory','finalSnapshotSha'])delete e[k];assert.deepEqual(m,e);assert.deepEqual(JSON.parse(JSON.stringify(r.trajectory)),expected.trajectory);assert.equal(geneHash(r.snapshot),expected.finalSnapshotSha);
  const half=await w.trial(intakeSource(genome),360,HYBRID_OPTIONS);await w.reset(half.snapshot);const rest=await w.request('experiment-step',{ticks:360,...HYBRID_OPTIONS});assert.equal(geneHash(rest.snapshot),expected.finalSnapshotSha);report.find(x=>x.seed===seed).replayAndForkExact=true;
 }
 const result={version:prefix,offspringReconstructed:1125,primaryGenerationArchivesExact:75,auxiliaryLog:{sha256:hash(logBytes),lines:log.length,expectedLines:81,complete:log.length===81,originalGenerationLogRowsVerified,missingGenerationRows:75-originalGenerationLogRowsVerified,cause:log.length===81?null:'Unestablished; original incomplete file preserved, never substituted for complete primary archives'},protectedEvidenceExact:true,legacyReexecuted:false,results:report};writeFileSync(root+prefix+'-derived-generation-index.json',JSON.stringify({version:prefix,source:'Reconstructed from complete immutable generation archives, NOT original console output',rows:derivedGenerationIndex},null,2)+'\n');writeFileSync(root+prefix+'-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await w.close();}
