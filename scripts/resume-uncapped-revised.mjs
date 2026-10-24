/** Finish original slots only; call once per seed/generation checkpoint. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {startGatedWorker} from './gated-worker-client.mjs';
import {hash,geneHash,median,prefix} from './uncapped-revised-archive.mjs';
import {original,out,read,atomic,id,loadRaw,evaluate,historical} from './recover-uncapped-revised.mjs';
import {HYBRID_SEEDS as SEEDS,intakeMutation,mutationSeed,selectIntakeOnly} from '../experiments/uncappedRevisedIntake.ts';
const seed=Number(process.argv[2]),generation=Number(process.argv[3]);assert.ok(SEEDS.includes(seed));assert.ok(generation>=13&&generation<=15);
const inv=read(out+'original-inventory.json'),raw=new Map(inv.raw),old=historical(),initial=read(original+prefix+'-'+seed+'-initial.json.gz');
const packetPath=(s,g,i)=>out+'packets/'+id(s,g,i).replaceAll('/','-')+'.json.gz';
const location=(s,g,i)=>{const k=id(s,g,i);return raw.get(k)??{path:packetPath(s,g,i)};};
let parent=initial.genome,best=initial.trial,bestRef='initial',bestLocator={path:original+prefix+'-'+seed+'-initial.json.gz'};
for(let g=1;g<generation;g++){const d=read(g<=12?original+prefix+'-'+seed+'-g'+String(g).padStart(2,'0')+'.json.gz':out+'generations/'+seed+'-g'+g+'.json.gz');assert.equal(geneHash(parent),d.parentHash);const e=selectIntakeOnly(best,d.offspring.map(o=>o.trial));assert.equal(e.index,d.selectedIndex);if(e.index>=0){const o=d.offspring[e.index];parent=intakeMutation(parent,o.mutationSeed,o.index).genome;best=o.trial;bestRef='g'+g+'/o'+o.index;bestLocator=location(seed,g,o.index);}assert.deepEqual(parent,d.selectedGenome);}
const parentHash=geneHash(parent),offspring=[],w=await startGatedWorker();
assert.equal(hash(readFileSync(new URL(w.bundle))),read(out+'worker.json').sha256);
let context;try{for(let index=0;index<15;index++){const key=mutationSeed(seed,generation,index),fresh=intakeMutation(parent,key,index),logicalId=id(seed,generation,index),locator=raw.get(logicalId);let row;
 if(locator){row=loadRaw(locator);assert.equal(row.parentHash,parentHash);assert.equal(row.mutationSeed,key);assert.deepEqual(row.genome,fresh.genome);assert.deepEqual(row.mutation,fresh.mutation);assert.equal(geneHash(row.trial),locator.trialSha);console.log(JSON.stringify({logicalId,kind:'reused-original',J:row.trial.absorbedJ}));}
 else{const kind=seed===1901&&generation===13?'recovered-uncertain':'new-original-slot';context={logicalId,kind,seed,generation,index,originalOutcome:kind==='recovered-uncertain'?'unknown; no surviving score':'not previously scheduled before verified interruption'};
 const result=await evaluate(w,context,fresh.genome),genomeSha=geneHash(fresh.genome);row={seed,generation,index,parentHash,mutationSeed:key,genome:fresh.genome,genomeSha,mutation:fresh.mutation,historicalMatches:old.get(seed+'/'+genomeSha)??[],...result,recovery:context};atomic(packetPath(seed,generation,index),row);console.log(JSON.stringify({logicalId,kind,J:row.trial.absorbedJ}));}
 offspring.push({index,mutationSeed:key,mutation:fresh.mutation,genomeSha:geneHash(fresh.genome),trial:row.trial,historicalMatches:row.historicalMatches,locator:location(seed,generation,index),provenance:locator?'original-surviving':row.recovery.kind});
 }
 const elite=selectIntakeOnly(best,offspring.map(o=>o.trial));if(elite.index>=0){const o=offspring[elite.index];parent=intakeMutation(parent,o.mutationSeed,o.index).genome;best=o.trial;bestRef='g'+generation+'/o'+o.index;bestLocator=o.locator;}
 const summary={seed,generation,parentHash,bestAbsorbedJ:best.absorbedJ,bestRef,bestLocator,offspringBestJ:Math.max(...offspring.map(o=>o.trial.absorbedJ)),offspringMedianJ:median(offspring.map(o=>o.trial.absorbedJ)),fedOffspring:offspring.filter(o=>o.trial.absorbedJ>0).length,selectedIndex:elite.index,selectedGenome:parent,selectedGenomeSha:geneHash(parent),selectedHistoricalMatches:elite.index>=0?offspring[elite.index].historicalMatches:[],offspring};
 atomic(out+'generations/'+seed+'-g'+generation+'.json.gz',summary);console.log(JSON.stringify({complete:true,seed,generation,J:best.absorbedJ,bestRef,selectedIndex:elite.index}));
 }catch(error){atomic(out+'RESUME-FAILURE-'+seed+'-'+generation+'.json',{context,message:error.message,stack:error.stack,workerFailure:error.workerFailure});throw error;}finally{await w.close();}

