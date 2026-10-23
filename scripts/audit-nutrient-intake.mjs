/** Reconstructs all450 proposals/decisions; frozen replay only, never evolution. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {root,prefix,readArchive,hash,geneHash,median} from './intake-archive.mjs';
import {INTAKE_ARCHITECTURES,intakeMutation,intakeSource,intakeMetrics,chooseIntakeElite,INTAKE_OPTIONS,INTAKE_BUDGET as B} from '../experiments/nutrientIntake.ts';
import {startGatedWorker} from './gated-worker-client.mjs';
const manifest=readArchive(prefix+'.json');assert.ok(manifest.completed);assert.deepEqual(manifest.counts,{initial:2,offspring:450,heldOut:12,totalSelectionAndHeldOut:464});
for(const f of manifest.files)assert.equal(hash(readFileSync(root+f.archive)),f.sha256,f.archive);
for(const [p,h] of Object.entries(manifest.protectedHashes))assert.equal(hash(readFileSync(root+p)),h,p);
for(const [p,h] of Object.entries(manifest.codeHashes))assert.equal(hash(readFileSync(p)),h,p);
const champions=readArchive(prefix+'-champions.json.gz').champions,held=readArchive(prefix+'-held-out.json.gz').heldOut;assert.equal(held.length,12);
const report=[];let count=0;
for(const architecture of INTAKE_ARCHITECTURES){const initial=readArchive(prefix+'-'+architecture+'-initial.json.gz').initial;let parent=initial.genome,best=initial.trial.valid?initial.trial:null,bestRef=best?'initial':null;
 for(let generation=1;generation<=B.generations;generation++){const d=readArchive(prefix+'-'+architecture+`-g${String(generation).padStart(2,'0')}.json.gz`);assert.equal(d.parentHash,geneHash(parent));assert.equal(d.offspring.length,15);
  for(const o of d.offspring){const r=intakeMutation(parent,o.mutationSeed,o.index);assert.deepEqual(r.mutation,o.mutation);assert.equal(geneHash(r.genome),o.genomeSha);count++;}
  const elite=chooseIntakeElite(best,d.offspring.map(x=>x.trial));assert.equal(elite.index,d.selectedIndex);if(elite.index>=0){parent=intakeMutation(parent,d.offspring[elite.index].mutationSeed,elite.index).genome;best=elite.best;bestRef=`g${generation}/o${elite.index}`;}
  assert.deepEqual(parent,d.selectedGenome);assert.equal(geneHash(parent),d.selectedGenomeSha);assert.equal(best?.absorbedJ??null,d.bestAbsorbedJ);assert.equal(bestRef,d.bestRef);
  const valid=d.offspring.filter(x=>x.trial.valid);assert.equal(d.offspringMedianValidJ,median(valid.map(x=>x.trial.absorbedJ)));assert.equal(d.fedOffspring,d.offspring.filter(x=>x.trial.absorbedJ>0).length);
 }
 const c=champions.find(x=>x.architecture===architecture);assert.equal(c.champion?.genomeSha??geneHash(c.initial.genome),geneHash(parent));assert.equal(c.champion?.training.finalSnapshotSha??null,best?.finalSnapshotSha??null);
 report.push({architecture,genotypesAndDecisionsExact:225,initialJ:initial.trial.absorbedJ,finalJ:best?.absorbedJ??null,selectedAt:bestRef});
}
assert.equal(count,450);
const w=await startGatedWorker();try{
 assert.equal(hash(readFileSync(new URL(w.bundle))),manifest.workerSha);
 for(const {architecture,initial,champion} of champions){const genome=champion?.genome??initial.genome,expected=champion?.training??initial.trial;
  const r=await w.trial(intakeSource(genome),720,INTAKE_OPTIONS),m=intakeMetrics(r);const e={...expected};for(const k of ['wallMs','trajectory','finalSnapshotSha'])delete e[k];assert.deepEqual(m,e);assert.deepEqual(JSON.parse(JSON.stringify(r.trajectory)),expected.trajectory);assert.equal(geneHash(r.snapshot),expected.finalSnapshotSha);
  const half=await w.trial(intakeSource(genome),360,INTAKE_OPTIONS);await w.reset(half.snapshot);const rest=await w.request('experiment-step',{ticks:360,...INTAKE_OPTIONS});assert.equal(geneHash(rest.snapshot),expected.finalSnapshotSha);report.find(x=>x.architecture===architecture).replayAndForkExact=true;
 }
 console.log(JSON.stringify({version:prefix,offspringReconstructed:450,protectedEvidenceExact:true,results:report}));
}finally{await w.close();}
