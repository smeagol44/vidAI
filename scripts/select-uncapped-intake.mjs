/** Exactly225 original-hybrid offspring. Append-only; no retries or extra seeds. */
import assert from 'node:assert/strict';import {readFileSync,readdirSync,openSync,writeSync,fsyncSync,closeSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {serialize} from 'node:v8';
import {startGatedWorker} from './gated-worker-client.mjs';
import {INTAKE_BUDGET as B,INTAKE_TRAINING as TRAIN,INTAKE_HELD_OUT as HELD,UNCAPPED_OPTIONS as OPTIONS,intakeNetwork,intakeMutation,uncappedSource,uncappedMetrics,chooseUncappedElite,mutationSeed,parameterCount} from '../experiments/uncappedIntake.ts';
import {root,prefix,hash,geneHash,median,writeArchive} from './uncapped-archive.mjs';
const protectedPaths=readdirSync(root).filter(p=>!p.startsWith(prefix)),protectedHashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(readFileSync(root+p))]));
const codeFiles=['simulation.ts','simulation.worker.ts','simulationHost.ts','persistence.ts','actuationObservation.ts','foundationPhysics.ts','experiments/workerMetrics.ts','experiments/foodObservation.ts','experiments/intakeEvaluation.ts','experiments/nutrientIntake.ts','experiments/uncappedIntake.ts','experiments/uncappedObservation.ts','experiments/torqueRecorder.ts','experiments/neuralSelection.ts','experiments/neuralFood.ts','experiments/selectionMetrics.ts','scripts/select-uncapped-intake.mjs','scripts/uncapped-archive.mjs','scripts/gated-worker-client.mjs'];
const codeHashes=Object.fromEntries(codeFiles.map(p=>[p,hash(readFileSync(p))]));
const log=openSync(root+prefix+'-run.log','wx'),say=x=>{const s=JSON.stringify(x)+'\n';writeSync(log,s);fsyncSync(log);process.stdout.write(s);};
const w=await startGatedWorker(),files=[],manifest={version:prefix,base:'b64481eb02a4c253637cae3d91375a5051405fd1',protocolCommit:'fd38301e1f0744228cd5ec0628c58fc5db69862b',implementationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),budget:B,training:TRAIN,heldOut:HELD,selection:'strict absorbed J only; former gates diagnostics only',codeHashes,protectedHashes,workerSha:hash(readFileSync(new URL(w.bundle))),workerAsset:w.bundle.split('/').pop(),files};
const save=(name,data)=>{const f=writeArchive(prefix+'-'+name,data);files.push(f);return f.archive;};
let context=null;
async function evaluate(genome,condition=TRAIN){
 const source=uncappedSource(genome,condition),start=performance.now();context={...context,source,genome};
 const packet=await w.trial(source,720,OPTIONS),metrics=uncappedMetrics(packet);
 // Full genotype/snapshot + EVERY substep force/contact trajectory; all tick
 // feeding/neural/energy states and acquired changes; no truncated receipt caps.
 const trial={...metrics,wallMs:performance.now()-start,trajectory:packet.trajectory,finalSnapshotSha:geneHash(packet.snapshot)};
 return{trial,packet};
}
try{
 const initialGenome=intakeNetwork('neural-hybrid');
 save('environments.json.gz',{version:prefix,environments:[TRAIN,...HELD].map(condition=>({condition,source:uncappedSource(initialGenome,condition)}))});
 context={role:'founder'};const initial=await evaluate(initialGenome);save('initial.json.gz',{genome:initialGenome,genomeSha:geneHash(initialGenome),...initial});
 let parent=initialGenome,best=initial.trial,bestRef='initial';const generations=[];
 say({founder:true,absorbedJ:best.absorbedJ,formerGateReasons:best.formerGateReasons});
 for(let generation=1;generation<=15;generation++){
  const frozen=structuredClone(parent),parentHash=geneHash(frozen),offspring=[];
  for(let index=0;index<15;index++){
   const key=mutationSeed(17,generation,index),{genome,mutation}=intakeMutation(frozen,key,index);assert.equal(mutation.changes.length,8);context={role:'offspring',generation,index,mutationSeed:key,mutation,parentHash};
   const result=await evaluate(genome),archive=save(`g${String(generation).padStart(2,'0')}-o${String(index).padStart(2,'0')}.json.gz`,{generation,index,parentHash,mutationSeed:key,genome,genomeSha:geneHash(genome),mutation,...result});
   offspring.push({index,mutationSeed:key,genomeSha:geneHash(genome),mutation,trial:result.trial,archive});
  }
  const elite=chooseUncappedElite(best,offspring.map(x=>x.trial));
  if(elite.index>=0){const row=offspring[elite.index];parent=intakeMutation(frozen,row.mutationSeed,row.index).genome;assert.equal(geneHash(parent),row.genomeSha);best=structuredClone(row.trial);bestRef=`g${generation}/o${row.index}`;}
  const summary={generation,parentHash,bestAbsorbedJ:best.absorbedJ,bestRef,offspringBestJ:Math.max(...offspring.map(o=>o.trial.absorbedJ)),offspringMedianJ:median(offspring.map(o=>o.trial.absorbedJ)),fedOffspring:offspring.filter(o=>o.trial.absorbedJ>0).length,selectedIndex:elite.index,selectedGenome:parent,selectedGenomeSha:geneHash(parent),offspring};
  save(`g${String(generation).padStart(2,'0')}.json.gz`,summary);generations.push({...summary,offspring:undefined,selectedGenome:undefined});
  say({...generations.at(-1),offspring:undefined});
 }
 save('champion.json.gz',{genome:parent,genomeSha:geneHash(parent),training:best,selectedAt:bestRef});
 const heldOut=[];
 for(let i=0;i<3;i++){context={role:'held-out',index:i,condition:HELD[i]};const result=await evaluate(parent,HELD[i]);const archive=save(`held-out-${HELD[i].seed}.json.gz`,{condition:HELD[i],genome:parent,...result});heldOut.push({condition:HELD[i],archive,trial:result.trial});}
 for(const [p,h] of Object.entries(protectedHashes))assert.equal(hash(readFileSync(root+p)),h,p);
 manifest.completed=true;manifest.counts={founder:1,offspring:225,heldOut:3,total:229};manifest.parameterCount=parameterCount(parent);manifest.initialJ=initial.trial.absorbedJ;manifest.finalJ=best.absorbedJ;manifest.selectedAt=bestRef;manifest.generations=generations;manifest.heldOut=heldOut;
 writeArchive(prefix+'.json',manifest);say({completed:true,counts:manifest.counts,initialJ:manifest.initialJ,finalJ:manifest.finalJ,selectedAt:bestRef,heldOut:heldOut.map(h=>({seed:h.condition.seed,J:h.trial.absorbedJ}))});
}catch(error){
 const failure={context,message:error.message,stack:error.stack,workerFailure:error.workerFailure};
 // V8 format preserves nonfinite values exactly; JSON would silently turn them
 // into null. Complete source+mutation reproduce the failing request.
 writeFileSync(root+prefix+'-failure.v8',serialize(failure),{flag:'wx'});say({FAILED:true,message:error.message,context:{...context,source:undefined,genome:undefined},failure:prefix+'-failure.v8'});throw error;
}finally{await w.close();closeSync(log);}
