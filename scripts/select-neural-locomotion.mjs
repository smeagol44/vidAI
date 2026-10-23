/** Exactly the owner-approved #63 budget. Offline artificial selection, built Worker only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';
import {ARCHITECTURES,START_SEEDS,BUDGET,TRAINING,HELD_OUT,GATES,initialNetwork,parameterCount,mutationSeed,mutateNetwork,selectionSource,chooseElite} from '../experiments/neuralSelection.ts';
import {selectionMetrics} from '../experiments/selectionMetrics.ts';
const root='docs/experiments/',hash=b=>createHash('sha256').update(b).digest('hex'),geneHash=g=>hash(JSON.stringify(g));
const median=a=>{if(!a.length)return null;const s=[...a].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const protectedPaths=['gated-worker-v1.json','torque-demand-v1.json','retained-head-v1.json.gz','retained-head-v1-summary.json'];
const protectedHashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(readFileSync(root+p))]));
const codeHash=hash(['experiments/neuralSelection.ts','experiments/selectionMetrics.ts','scripts/select-neural-locomotion.mjs'].map(p=>readFileSync(p)).join('\n'));
const worker=await startGatedWorker(),workerSha=hash(readFileSync(new URL(worker.bundle)));
const manifest={version:'neural-selection-v1',base:'2ac6477298eff792c2c93f255cfb99285f64231a',budget:BUDGET,training:TRAINING,heldOut:HELD_OUT,gates:GATES,seeds:START_SEEDS,codeHash,workerSha,workerAsset:worker.bundle.split('/').pop(),protectedHashes,runs:[],completed:false};
const indexPath=root+'neural-selection-v1.json',archives=[];
const save=(d,path)=>writeFileSync(path,gzipSync(JSON.stringify(d)+'\n',{level:9}));
const indexed=()=>writeFileSync(indexPath,JSON.stringify(manifest,null,2)+'\n');
async function evaluate(g,c=TRAINING,passive=false){
 const source=selectionSource(g,c,passive),started=performance.now();
 const r=await worker.trial(source,Math.round(c.seconds*60),{auditTorque:true,traceJoints:true});
 const wallMs=performance.now()-started;
 return{...selectionMetrics(r,c.seconds),wallMs,trajectory:r.trajectory,finalSnapshotSha:hash(JSON.stringify(r.snapshot))};
}
try{
 for(let runIndex=0;runIndex<START_SEEDS.length;runIndex++)for(let order=0;order<3;order++){
  const seed=START_SEEDS[runIndex],architecture=ARCHITECTURES[(runIndex+order)%3],path=root+`neural-selection-v1-${architecture}-${seed}.json.gz`;
  let d;
  if(existsSync(path)){
   d=JSON.parse(gunzipSync(readFileSync(path)));assert.equal(d.codeHash,codeHash,'Existing checkpoint uses different code');assert.equal(d.workerSha,workerSha);
  }else{
   const g=initialNetwork(architecture,seed),initial=await evaluate(g);
   d={version:manifest.version,architecture,seed,codeHash,workerSha,parameterCount:parameterCount(g),initial:{genome:g,hash:geneHash(g),trial:initial},generations:[],heldOut:[],controls:[],selectedGenome:g,best:initial.valid?initial:null,bestRef:initial.valid?'initial':null,completed:false};save(d,path);
  }
  for(let generation=d.generations.length+1;generation<=BUDGET.generations;generation++){
   // ALL16 offspring descend from this frozen generation-start parent.
   const ancestor=structuredClone(d.selectedGenome),parentHash=geneHash(ancestor),parentWasValid=!!d.best,offspring=[];
   for(let index=0;index<BUDGET.offspring;index++){
    const key=mutationSeed(seed,generation,index),{genome,mutation}=mutateNetwork(ancestor,architecture,key,index),trial=await evaluate(genome);
    offspring.push({index,mutationSeed:key,genomeSha:geneHash(genome),mutation,trial});
   }
   const elite=chooseElite(d.best,offspring.map(x=>x.trial));
   let selectedMutation=null;
   if(elite.index>=0){
    const row=offspring[elite.index],candidate=mutateNetwork(ancestor,architecture,row.mutationSeed,row.index).genome;assert.equal(geneHash(candidate),row.genomeSha);
    d.selectedGenome=candidate;d.best=row.trial;d.bestRef=`g${generation}/o${row.index}`;selectedMutation=row.mutation;
   }
   const valid=offspring.filter(x=>x.trial.valid),raw=offspring.filter(x=>Number.isFinite(x.trial.distance));
   d.generations.push({generation,parentHash,parentWasValid,bestValidDistance:d.best?.distance??null,bestRef:d.bestRef,
    offspringBestValid:valid.length?Math.max(...valid.map(x=>x.trial.distance)):null,offspringMedianValid:median(valid.map(x=>x.trial.distance)),offspringMedianRaw:median(raw.map(x=>x.trial.distance)),validOffspring:valid.length,
    selectedIndex:elite.index,selectedMutation,selectedGenome:structuredClone(d.selectedGenome),selectedGenomeSha:geneHash(d.selectedGenome),offspring});
   save(d,path);
   console.log(JSON.stringify({architecture,seed,generation,best:d.best?.distance??null,medianValid:d.generations.at(-1).offspringMedianValid,valid:valid.length,selected:elite.index,kind:selectedMutation?.kind??null,signedJoints:d.selectedGenome.motorController?.signedJoints??null}));
  }
  d.champion=d.best?{genome:structuredClone(d.selectedGenome),genomeSha:geneHash(d.selectedGenome),training:d.best,selectedAt:d.bestRef}:null;
  // Equal held-out slots even for failed runs: fallback is the initial specimen,
  // explicitly NOT a champion. Results never flow back into selection above.
  for(let i=0;i<HELD_OUT.length;i++)for(const role of ['initial','final']){
   if(d.heldOut.some(x=>x.conditionIndex===i&&x.role===role))continue;
   const g=role==='initial'?d.initial.genome:d.champion?.genome??d.initial.genome;
   d.heldOut.push({conditionIndex:i,condition:HELD_OUT[i],role,championAvailable:!!d.champion,genomeSha:geneHash(g),trial:await evaluate(g,HELD_OUT[i])});save(d,path);
  }
  for(const control of ['passive','fluid-off']){
   if(d.controls.some(x=>x.control===control))continue;
   const g=d.champion?.genome??d.initial.genome,c={...TRAINING,...(control==='fluid-off'?{viscosity:0}:{})};
   d.controls.push({control,championAvailable:!!d.champion,trial:await evaluate(g,c,control==='passive')});save(d,path);
  }
  assert.equal(d.generations.length,12);assert.equal(d.generations.flatMap(g=>g.offspring).length,192);assert.equal(d.heldOut.length,6);assert.equal(d.controls.length,2);
  // Monotone VALID elites, including explicit no-valid-founder cases.
  let last=d.initial.trial.valid?d.initial.trial.distance:-Infinity;
  for(const g of d.generations)if(g.bestValidDistance!==null){assert.ok(g.bestValidDistance>=last);last=g.bestValidDistance;}
  d.completed=true;save(d,path);archives.push(d);manifest.runs.push({architecture,seed,archive:path.slice(root.length),sha256:hash(readFileSync(path)),championAvailable:!!d.champion,initialValid:d.initial.trial.valid,initialDistance:d.initial.trial.distance,finalDistance:d.best?.distance??null,parameterCount:d.parameterCount});indexed();
 }
 assert.equal(archives.length,9);for(const a of ARCHITECTURES){const runs=archives.filter(d=>d.architecture===a);assert.equal(runs.length,3);assert.equal(runs.reduce((s,d)=>s+d.generations.flatMap(g=>g.offspring).length,0),576);}
 for(const p of protectedPaths)assert.equal(hash(readFileSync(root+p)),protectedHashes[p]);
 const champions=archives.map(d=>({architecture:d.architecture,seed:d.seed,initial:d.initial,champion:d.champion,failedSpecimen:d.champion?null:d.initial.genome}));
 writeFileSync(root+'neural-selection-v1-champions.json',JSON.stringify({version:manifest.version,champions},null,2)+'\n');
 manifest.completed=true;manifest.counts={initial:9,offspring:1728,heldOut:54,controls:18,total:1809};indexed();
 console.log(JSON.stringify({completed:true,counts:manifest.counts,archives:manifest.runs}));
}finally{await worker.close();}
