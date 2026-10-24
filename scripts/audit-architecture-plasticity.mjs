/** Frozen6750 archive/genotype/selection audit; no retraining. --stage=off --static supported. */
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {root,readArchive,hash,geneHash,median} from './intake-archive.mjs';import {startGatedWorker} from './gated-worker-client.mjs';
import {PLASTIC_ARCHITECTURES as ARCHS,PLASTIC_SEEDS as SEEDS,plasticNetwork,plasticMutation,plasticCoverage,LEARNING_FIELDS,intakeSource,intakeMetrics,chooseIntakeElite,mutationSeed,PLASTIC_OPTIONS} from '../experiments/architecturePlasticity.ts';
const prefix='architecture-plasticity-v1',only=process.argv.find(a=>a.startsWith('--stage='))?.split('=')[1],stages=only?[only]:['off','mutable'],isStatic=process.argv.includes('--static'),report=[];let count=0;
for(const stage of stages){const manifest=readArchive(prefix+'-'+stage+'.json');assert.ok(manifest.completed);assert.deepEqual(manifest.counts,{founders:15,offspring:3375,heldOut:45,ablations:stage==='mutable'?45:0,total:stage==='mutable'?3480:3435});
 for(const f of manifest.files)assert.equal(hash(readFileSync(root+f.archive)),f.sha256,f.archive);
 for(const [p,h]of Object.entries(manifest.protectedHashes))assert.equal(hash(readFileSync(root+p)),h,p);
 for(const [p,h]of Object.entries(manifest.codeHashes))assert.equal(hash(readFileSync(p)),h,p);
 const champions=readArchive(prefix+'-'+stage+'-champions.json.gz').champions,held=readArchive(prefix+'-'+stage+'-held-out.json.gz').heldOut;assert.equal(champions.length,15);assert.equal(held.length,45);if(stage==='mutable')assert.equal(readArchive(prefix+'-mutable-ablations.json.gz').ablations.length,45);
 for(const architecture of ARCHS)for(const seed of SEEDS){const initial=readArchive(prefix+'-'+stage+'-'+architecture+'-'+seed+'-initial.json.gz').initial;assert.deepEqual(initial.genome,plasticNetwork(architecture,stage,seed).genome);let parent=initial.genome,best=initial.trial.valid?initial.trial:null,bestRef=best?'initial':null;
  for(let generation=1;generation<=15;generation++){const d=readArchive(prefix+'-'+stage+'-'+architecture+'-'+seed+`-g${String(generation).padStart(2,'0')}.json.gz`);assert.equal(d.parentHash,geneHash(parent));assert.equal(d.offspring.length,15);
   for(const o of d.offspring){assert.equal(o.mutationSeed,mutationSeed(seed,generation,o.index));const p=plasticMutation(parent,stage,o.mutationSeed,o.index);assert.deepEqual(p.neuralMutation,o.neuralMutation);assert.equal(p.neuralMutation.kind,'neural');assert.equal(p.neuralMutation.changes.length,8);assert.deepEqual(p.learningMutation,o.learningMutation);assert.equal(p.learningMutation.draws.length,9);assert.equal(geneHash(p.genome),o.genomeSha);assert.deepEqual(plasticCoverage(p.genome),o.coverage);assert.deepEqual(Object.fromEntries(LEARNING_FIELDS.map(f=>[f,p.genome[f]??0])),o.learningGenes);
    if(stage==='off'){assert.equal(o.trial.learningAudit.costJ,0);assert.deepEqual(o.trial.learningAudit.somatic,{motor:[],sensory:[]});assert.equal(o.trial.learningAudit.motorL1,0);assert.equal(o.trial.learningAudit.sensoryL1,0);}count++;
   }
   const elite=chooseIntakeElite(best,d.offspring.map(o=>o.trial));assert.equal(elite.index,d.selectedIndex);if(elite.index>=0){parent=plasticMutation(parent,stage,d.offspring[elite.index].mutationSeed,elite.index).genome;best=elite.best;bestRef=`g${generation}/o${elite.index}`;}
   assert.deepEqual(parent,d.selectedGenome);assert.equal(geneHash(parent),d.selectedGenomeSha);assert.equal(best?.absorbedJ??null,d.bestJ);assert.equal(bestRef,d.bestRef);assert.equal(d.medianValidJ,median(d.offspring.filter(o=>o.trial.valid).map(o=>o.trial.absorbedJ)));
  }
  const c=champions.find(c=>c.architecture===architecture&&c.seed===seed);assert.equal(c.champion?.genomeSha??geneHash(c.initial.genome),geneHash(parent));assert.equal(c.champion?.training.finalSnapshotSha??null,best?.finalSnapshotSha??null);report.push({stage,architecture,seed,genotypesExact:225,championAvailable:!!best,finalJ:best?.absorbedJ??null,selectedAt:bestRef});
 }
}
if(!only){assert.equal(count,6750);const index=readArchive(prefix+'.json');assert.deepEqual(index.counts,{founders:30,offspring:6750,heldOut:90,ablations:45,total:6915});for(const f of index.stages)assert.equal(hash(readFileSync(root+f.archive)),f.sha256);}
if(!isStatic){const w=await startGatedWorker();try{
 for(const stage of stages){const manifest=readArchive(prefix+'-'+stage+'.json');assert.equal(hash(readFileSync(new URL(w.bundle))),manifest.workerSha);const champions=readArchive(prefix+'-'+stage+'-champions.json.gz').champions;
  for(const c of champions){const g=c.champion?.genome??c.initial.genome,expected=c.champion?.training??c.initial.trial,r=await w.trial(intakeSource(g),720,PLASTIC_OPTIONS),actual={...intakeMetrics(r),modeAudit:r.modeAudit,learningAudit:r.learningAudit},e={...expected};for(const k of ['wallMs','trajectory','trajectorySha','finalSnapshotSha'])delete e[k];assert.deepEqual(actual,e);assert.equal(geneHash(r.trajectory),expected.trajectorySha);assert.equal(geneHash(r.snapshot),expected.finalSnapshotSha);const entry=report.find(x=>x.stage===stage&&x.architecture===c.architecture&&x.seed===c.seed);entry.fullReplayExact=true;
   if(c.seed===17){const half=await w.trial(intakeSource(g),360,PLASTIC_OPTIONS);await w.reset(half.snapshot);const rest=await w.request('experiment-step',{ticks:360,...PLASTIC_OPTIONS});assert.equal(geneHash(rest.snapshot),expected.finalSnapshotSha);entry.resetForkExact=true;}
  }
 }
 }finally{await w.close();}}
const result={version:prefix,offspringReconstructed:count,stages,staticOnly:isStatic,primaryArchivesExact:true,priorEvidenceExact:true,results:report};writeFileSync(root+prefix+(only?'-'+only:'')+'-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
