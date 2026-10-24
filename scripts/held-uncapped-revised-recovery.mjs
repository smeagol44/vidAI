/** Only the original30 held-out slots, after all original training slots. */
import assert from 'node:assert/strict';
import {startGatedWorker} from './gated-worker-client.mjs';
import {prefix,geneHash,hash} from './uncapped-revised-archive.mjs';
import {read,atomic,out,original,evaluate} from './recover-uncapped-revised.mjs';
import {readFileSync} from 'node:fs';
import {HYBRID_SEEDS as SEEDS,INTAKE_HELD_OUT as HELD} from '../experiments/uncappedRevisedIntake.ts';
for(const seed of SEEDS)for(let g=13;g<=15;g++)read(out+'generations/'+seed+'-g'+g+'.json.gz');
const w=await startGatedWorker();assert.equal(hash(readFileSync(new URL(w.bundle))),read(out+'worker.json').sha256);
try{for(const seed of SEEDS){const d=read(out+'generations/'+seed+'-g15.json.gz'),init=read(original+prefix+'-'+seed+'-initial.json.gz'),g=d.selectedGenome;
 const champion={seed,genome:g,genomeSha:geneHash(g),selectedAt:d.bestRef,bestLocator:d.bestLocator,training:d.bestRef==='initial'?init.trial:undefined};
 if(!champion.training){const [gen,index]=d.bestRef.match(/g(\d+)\/o(\d+)/).slice(1).map(Number);const s=read(gen<=12?original+prefix+'-'+seed+'-g'+String(gen).padStart(2,'0')+'.json.gz':out+'generations/'+seed+'-g'+gen+'.json.gz');champion.training=s.offspring[index].trial;}
 atomic(out+'champions/'+seed+'.json.gz',champion);
 for(const condition of HELD)for(const role of ['initial','final']){const genome=role==='initial'?init.genome:g,context={kind:'original-held-out',logicalId:seed+'/held-'+condition.seed+'/'+role,seed,role,environmentSeed:condition.seed},result=await evaluate(w,context,genome,condition);
 atomic(out+'held/'+seed+'-'+condition.seed+'-'+role+'.json.gz',{seed,role,condition,genome,genomeSha:geneHash(genome),...result,recovery:context});console.log(JSON.stringify({seed,role,environment:condition.seed,J:result.trial.absorbedJ}));}
 }}finally{await w.close();}
console.log('ORIGINAL_HELD_OUT_COMPLETE');

