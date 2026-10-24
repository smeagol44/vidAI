/** Portable CI reconstruction; no simulation and no access to private raw bundles. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {geneHash} from './uncapped-revised-archive.mjs';
import {revisedHybridNetwork,intakeMutation,mutationSeed,selectIntakeOnly,HYBRID_SEEDS} from '../experiments/uncappedRevisedIntake.ts';
const l=JSON.parse(gunzipSync(readFileSync('docs/experiments/uncapped-revised-v1-complete-ledger.json.gz')));
assert.deepEqual(l.runs.map(r=>r.seed),HYBRID_SEEDS);assert.equal(l.generations.length,75);let proposals=0;
for(const r of l.runs){let parent=revisedHybridNetwork(r.seed),best={absorbedJ:r.initialJ};assert.equal(geneHash(parent),r.initialGenomeSha);
 for(let generation=1;generation<=15;generation++){const d=l.generations.find(d=>d.seed===r.seed&&d.generation===generation);assert.equal(d.parentHash,geneHash(parent));assert.equal(d.incumbentJ,best.absorbedJ);assert.equal(d.offspring.length,15);
  for(let index=0;index<15;index++){const o=d.offspring[index],key=mutationSeed(r.seed,generation,index),fresh=intakeMutation(parent,key,index);assert.equal(o.index,index);assert.equal(o.mutationSeed,key);assert.equal(geneHash(fresh.genome),o.genomeSha);assert.deepEqual(fresh.mutation,o.mutation);assert.equal(fresh.mutation.changes.length,8);assert.ok(Number.isFinite(o.absorbedJ)&&o.absorbedJ>=0);assert.match(o.finalSnapshotSha,/^[a-f0-9]{64}$/);proposals++;}
  const e=selectIntakeOnly(best,d.offspring.map(o=>({absorbedJ:o.absorbedJ})));assert.equal(e.index,d.selectedIndex);if(e.index>=0){const o=d.offspring[e.index];parent=intakeMutation(parent,o.mutationSeed,o.index).genome;best=e.best;}assert.equal(geneHash(parent),d.selectedGenomeSha);assert.equal(best.absorbedJ,d.bestAbsorbedJ);
 }assert.equal(best.absorbedJ,r.finalJ);assert.equal(geneHash(parent),r.finalGenomeSha);
}
assert.equal(proposals,1125);console.log(JSON.stringify({portableLedger:true,proposals:1125,decisions:75,simulationEvaluations:0,scope:'genotypes/mutations/intake-only selection; full1160 raw packet and Worker replay audit is separately recorded'}));

