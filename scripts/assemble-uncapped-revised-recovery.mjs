/** Derive the complete logical archive index; never run physics. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {prefix,hash,geneHash} from './uncapped-revised-archive.mjs';
import {original,out,read,atomic,id} from './recover-uncapped-revised.mjs';
import {HYBRID_SEEDS as SEEDS,INTAKE_HELD_OUT as HELD} from '../experiments/uncappedRevisedIntake.ts';
const inv=read(out+'original-inventory.json'),raw=new Map(inv.raw),files=new Map(),index=[],runs=[],heldOut=[],compact=[];
const locate=(s,g,i)=>raw.get(id(s,g,i))??{path:out+'packets/'+id(s,g,i).replaceAll('/','-')+'.json.gz'};
const file=p=>{if(!files.has(p)){const b=readFileSync(p);files.set(p,{path:p,bytes:b.length,sha256:hash(b)});}return p;};
for(const seed of SEEDS){const initialPath=file(original+prefix+'-'+seed+'-initial.json.gz'),initial=read(initialPath),generations=[];let incumbent=initial.trial.absorbedJ;
 for(let g=1;g<=15;g++){const path=file(g<=12?original+prefix+'-'+seed+'-g'+String(g).padStart(2,'0')+'.json.gz':out+'generations/'+seed+'-g'+g+'.json.gz'),d=read(path);generations.push({generation:g,path});
  for(const o of d.offspring){const loc=locate(seed,g,o.index);file(loc.path);index.push({seed,generation:g,index:o.index,locator:loc,genomeSha:o.genomeSha,trialSha:geneHash(o.trial),snapshotSha:o.trial.finalSnapshotSha,provenance:raw.has(id(seed,g,o.index))?'original-surviving':g<=12?'recovered-known':seed===1901&&g===13?'recovered-uncertain':'new-original-slot'});}
  compact.push({seed,generation:g,parentHash:d.parentHash,incumbentJ:incumbent,selectedIndex:d.selectedIndex,selectedGenomeSha:d.selectedGenomeSha,bestAbsorbedJ:d.bestAbsorbedJ,bestRef:d.bestRef,offspring:d.offspring.map(o=>({index:o.index,mutationSeed:o.mutationSeed,mutation:o.mutation,genomeSha:o.genomeSha,absorbedJ:o.trial.absorbedJ,trialSha:geneHash(o.trial),finalSnapshotSha:o.trial.finalSnapshotSha,formerReasons:o.trial.formerReasons}))});incumbent=d.bestAbsorbedJ;
 }const championPath=file(out+'champions/'+seed+'.json.gz'),champion=read(championPath);runs.push({seed,initialPath,initialJ:initial.trial.absorbedJ,initialGenomeSha:initial.genomeSha,finalJ:champion.training.absorbedJ,selectedAt:champion.selectedAt,finalGenomeSha:champion.genomeSha,championPath,generations});
 for(const cond of HELD)for(const role of ['initial','final']){const path=file(out+'held/'+seed+'-'+cond.seed+'-'+role+'.json.gz'),d=read(path);heldOut.push({seed,role,condition:cond,path,J:d.trial.absorbedJ,genomeSha:d.genomeSha,snapshotSha:d.trial.finalSnapshotSha});}
}
assert.equal(index.length,1125);assert.equal(new Set(index.map(x=>id(x.seed,x.generation,x.index))).size,1125);
const provenance=index.reduce((a,x)=>{a[x.provenance]=(a[x.provenance]??0)+1;return a;},{});assert.deepEqual(provenance,{'original-surviving':873,'recovered-known':37,'recovered-uncertain':5,'new-original-slot':210});
const frozen='6276c79d6c2b517bcb4f3abf7597f9a0516766e5',paths=execFileSync('git',['ls-tree','-r','--name-only',frozen],{encoding:'utf8'}).trim().split('\n').filter(p=>/\.(ts|tsx|mjs|json|css)$/.test(p)&&!p.startsWith('docs/'));
const codeHashes={};for(const p of paths){const expected=hash(execFileSync('git',['show',frozen+':'+p],{maxBuffer:50e6}));assert.equal(hash(readFileSync(p)),expected,p);codeHashes[p]=expected;}
const originalFiles=read('../original-file-checksums.json');for(const f of originalFiles)assert.equal(hash(readFileSync('../interrupted-original/'+f.path)),f.sha256,f.path);
const manifest={version:prefix+'-completion-recovery-v1',completed:true,base:'531e2d0b5fef6d6ce15fa6a83905b8c99f7606ee',implementationCommit:frozen,originalCheckpointCommit:'c7d210d909baa5e43e120ccc80d1768cf10b50bb',counts:{founder:5,offspring:1125,heldOut:30,total:1160},provenance,recoveryTrialExecutions:252,verificationReplaysSeparate:true,originalExecutionEndpoint:'unknown after1901/g13/o10;g13/o4 missing score;37 known lost packets',codeHashes,originalFiles,worker:read(out+'worker.json'),runs,heldOut,index,files:[...files.values()]};
atomic('docs/experiments/'+prefix+'-completion.json',manifest);
atomic('docs/experiments/'+prefix+'-complete-ledger.json.gz',{version:manifest.version,counts:manifest.counts,provenance,runs:runs.map(({generations,...r})=>r),generations:compact});
console.log(JSON.stringify({counts:manifest.counts,provenance,runs:runs.map(({generations,...r})=>r),files:files.size,bytes:[...files.values()].reduce((s,x)=>s+x.bytes,0)}));

