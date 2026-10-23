/** Corrected owner-approved #63 three-architecture x three-environment budget. Offline artificial selection, built Worker only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,renameSync,readdirSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';
import {FOOD_ARCHITECTURES as ARCHITECTURES,ENVIRONMENTS,START_SEEDS,BUDGET,TRAINING,HELD_OUT,GATES,foodNetwork as initialNetwork,parameterCount,mutationSeed,foodMutation as mutateNetwork,foodSource,foodMetrics as selectionMetrics,chooseElite} from '../experiments/neuralFood.ts';
const root='docs/experiments/',hash=b=>createHash('sha256').update(b).digest('hex'),geneHash=g=>hash(JSON.stringify(g));
const median=a=>{if(!a.length)return null;const s=[...a].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const protectedPaths=['gated-worker-v1.json','torque-demand-v1.json','retained-head-v1.json.gz','retained-head-v1-summary.json',...readdirSync(root).filter(p=>p.startsWith('neural-selection-v1'))];
const protectedHashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(readFileSync(root+p))]));
const codeHash=hash(['experiments/neuralSelection.ts','experiments/selectionMetrics.ts','experiments/neuralFood.ts','experiments/foodObservation.ts','scripts/select-neural-food.mjs'].map(p=>readFileSync(p)).join('\n'));
const worker=await startGatedWorker(),workerSha=hash(readFileSync(new URL(worker.bundle)));
const manifest={version:'neural-food-v1',base:'e09bf46a27e84edbe1dc72e698c259ac7b8e6e9e',budget:BUDGET,training:TRAINING,heldOut:HELD_OUT,gates:GATES,seeds:START_SEEDS,codeHash,workerSha,workerAsset:worker.bundle.split('/').pop(),protectedHashes,runs:[],completed:false};
const indexPath=root+'neural-food-v1.json',archives=[];
const save=(d,path)=>{writeFileSync(path+'.tmp',gzipSync(JSON.stringify(d)+'\n',{level:9}));renameSync(path+'.tmp',path);};
const indexed=()=>writeFileSync(indexPath,JSON.stringify(manifest,null,2)+'\n');
async function evaluate(g,environment,c=TRAINING,passive=false){
 const source=foodSource(g,environment,c,passive),started=performance.now();
 const r=await worker.trial(source,Math.round(c.seconds*60),{auditTorque:true,traceJoints:true,traceFood:true});
 const wallMs=performance.now()-started;
 return{...selectionMetrics(r,c.seconds),wallMs,trajectory:r.trajectory,finalSnapshotSha:hash(JSON.stringify(r.snapshot))};
}
try{
 const environments=ENVIRONMENTS.flatMap(environment=>[TRAINING,...HELD_OUT].map(condition=>{const source=foodSource(initialNetwork('direct-only',17),environment,condition);return{environment,condition,source};}));
 save({version:manifest.version,environments},root+'neural-food-v1-environments.json.gz');
 for(let runIndex=0;runIndex<START_SEEDS.length;runIndex++)for(let e=0;e<3;e++)for(let order=0;order<3;order++){
  const environment=ENVIRONMENTS[(runIndex+e)%3],seed=START_SEEDS[runIndex],architecture=ARCHITECTURES[(runIndex+e+order)%3],path=root+`neural-food-v1-${environment}-${architecture}-${seed}.json.gz`;
  let d;
  if(existsSync(path)){
   d=JSON.parse(gunzipSync(readFileSync(path)));assert.equal(d.codeHash,codeHash,'Existing checkpoint uses different code');assert.equal(d.workerSha,workerSha);
  }else{
   const g=initialNetwork(architecture,seed),initial=await evaluate(g,environment);
   d={version:manifest.version,environment,architecture,seed,codeHash,workerSha,parameterCount:parameterCount(g),initial:{genome:g,hash:geneHash(g),trial:initial},generations:[],heldOut:[],controls:[],selectedGenome:g,best:initial.valid?initial:null,bestRef:initial.valid?'initial':null,completed:false};save(d,path);
  }
  for(let generation=d.generations.length+1;generation<=BUDGET.generations;generation++){
   // ALL16 offspring descend from this frozen generation-start parent.
   const ancestor=structuredClone(d.selectedGenome),parentHash=geneHash(ancestor),parentWasValid=!!d.best,offspring=[];
   for(let index=0;index<BUDGET.offspring;index++){
    const key=mutationSeed(seed,generation,index),{genome,mutation}=mutateNetwork(ancestor,key,index),trial=await evaluate(genome,environment);
    offspring.push({index,mutationSeed:key,genomeSha:geneHash(genome),mutation,trial});
   }
   const elite=chooseElite(d.best,offspring.map(x=>x.trial));
   let selectedMutation=null;
   if(elite.index>=0){
    const row=offspring[elite.index],candidate=mutateNetwork(ancestor,row.mutationSeed,row.index).genome;assert.equal(geneHash(candidate),row.genomeSha);
    d.selectedGenome=candidate;d.best=structuredClone(row.trial);d.bestRef=`g${generation}/o${row.index}`;selectedMutation=row.mutation;
   }
   // All candidate aggregate receipts persist. Full sampled trajectories persist for elites/held-outs/controls.
   for(const row of offspring)delete row.trial.trajectory;
   const valid=offspring.filter(x=>x.trial.valid),raw=offspring.filter(x=>Number.isFinite(x.trial.distance));
   d.generations.push({generation,parentHash,parentWasValid,bestValidDistance:d.best?.distance??null,bestRef:d.bestRef,
    offspringBestValid:valid.length?Math.max(...valid.map(x=>x.trial.distance)):null,offspringMedianValid:median(valid.map(x=>x.trial.distance)),offspringMedianRaw:median(raw.map(x=>x.trial.distance)),validOffspring:valid.length,
    selectedIndex:elite.index,selectedMutation,selectedGenome:structuredClone(d.selectedGenome),selectedGenomeSha:geneHash(d.selectedGenome),eliteTrajectory:elite.index>=0?d.best.trajectory:null,offspring});
   save(d,path);
   console.log(JSON.stringify({environment,architecture,seed,generation,best:d.best?.distance??null,medianValid:d.generations.at(-1).offspringMedianValid,valid:valid.length,selected:elite.index,kind:selectedMutation?.kind??null,modes:d.best?.joints.map(j=>j.modeSubsteps)??null}));
  }
  d.champion=d.best?{genome:structuredClone(d.selectedGenome),genomeSha:geneHash(d.selectedGenome),training:d.best,selectedAt:d.bestRef}:null;
  // Equal held-out slots even for failed runs: fallback is the initial specimen,
  // explicitly NOT a champion. Results never flow back into selection above.
  for(let i=0;i<HELD_OUT.length;i++)for(const role of ['initial','final']){
   if(d.heldOut.some(x=>x.conditionIndex===i&&x.role===role))continue;
   const g=role==='initial'?d.initial.genome:d.champion?.genome??d.initial.genome;
   d.heldOut.push({conditionIndex:i,condition:HELD_OUT[i],role,championAvailable:!!d.champion,genomeSha:geneHash(g),trial:await evaluate(g,environment,HELD_OUT[i])});save(d,path);
  }
  for(const control of ['passive','fluid-off',...(environment==='A'?[]:['food-removed'])]){
   if(d.controls.some(x=>x.control===control))continue;
   const g=d.champion?.genome??d.initial.genome,c={...TRAINING,...(control==='fluid-off'?{viscosity:0}:{})};
   d.controls.push({control,championAvailable:!!d.champion,trial:await evaluate(g,control==='food-removed'?'A':environment,c,control==='passive')});save(d,path);
  }
  assert.equal(d.generations.length,12);assert.equal(d.generations.flatMap(g=>g.offspring).length,192);assert.equal(d.heldOut.length,6);assert.equal(d.controls.length,environment==='A'?2:3);
  // Monotone VALID elites, including explicit no-valid-founder cases.
  let last=d.initial.trial.valid?d.initial.trial.distance:-Infinity;
  for(const g of d.generations)if(g.bestValidDistance!==null){assert.ok(g.bestValidDistance>=last);last=g.bestValidDistance;}
  d.completed=true;save(d,path);archives.push(d);manifest.runs.push({environment,architecture,seed,archive:path.slice(root.length),sha256:hash(readFileSync(path)),championAvailable:!!d.champion,initialValid:d.initial.trial.valid,initialDistance:d.initial.trial.distance,finalDistance:d.best?.distance??null,parameterCount:d.parameterCount});indexed();
 }
 assert.equal(archives.length,27);for(const environment of ENVIRONMENTS)for(const a of ARCHITECTURES){const runs=archives.filter(d=>d.architecture===a&&d.environment===environment);assert.equal(runs.length,3);assert.equal(runs.reduce((s,d)=>s+d.generations.flatMap(g=>g.offspring).length,0),576);}
 for(const p of protectedPaths)assert.equal(hash(readFileSync(root+p)),protectedHashes[p]);
 const champions=archives.map(d=>({environment:d.environment,architecture:d.architecture,seed:d.seed,initial:d.initial,champion:d.champion,failedSpecimen:d.champion?null:d.initial.genome}));
 save({version:manifest.version,champions},root+'neural-food-v1-champions.json.gz');
 manifest.completed=true;manifest.counts={initial:27,offspring:5184,heldOut:162,controls:72,total:5445};indexed();
 console.log(JSON.stringify({completed:true,counts:manifest.counts,archives:manifest.runs}));
}finally{await worker.close();}
