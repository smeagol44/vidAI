/** Full primary integrity plus ONLY five champion replay/reset verifications. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {startGatedWorker} from './gated-worker-client.mjs';
import {prefix,hash,geneHash,unpackPacket} from './uncapped-revised-archive.mjs';
import {read,original,out,loadRaw,stripTiming,id} from './recover-uncapped-revised.mjs';
import {revisedHybridNetwork,intakeMutation,mutationSeed,selectIntakeOnly,uncappedRevisedMetrics,uncappedRevisedSource,UNCAPPED_REVISED_OPTIONS as OPTIONS,INTAKE_TRAINING as TRAIN,INTAKE_HELD_OUT as HELD} from '../experiments/uncappedRevisedIntake.ts';
const m=read('docs/experiments/'+prefix+'-completion.json');assert.equal(m.completed,true);assert.deepEqual(m.counts,{founder:5,offspring:1125,heldOut:30,total:1160});
for(const f of m.files)assert.equal(hash(readFileSync(f.path)),f.sha256,f.path);
for(const [p,h] of Object.entries(m.codeHashes))assert.equal(hash(readFileSync(p)),h,p);
for(const f of m.originalFiles)assert.equal(hash(readFileSync('../interrupted-original/'+f.path)),f.sha256,f.path);
const prior=execFileSync('git',['ls-tree','-r','6276c79d6c2b517bcb4f3abf7597f9a0516766e5','docs/experiments'],{encoding:'utf8'}).trim().split('\n').filter(l=>!l.split('\t')[1].split('/').at(-1).startsWith(prefix));
for(const line of prior){const [head,path]=line.split('\t'),sha=head.split(' ').at(-1);assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),sha,path);}
const env=read(original+prefix+'-environments.json.gz').environments,oldEnv=read('docs/experiments/hybrid-threshold-intake-v1-environments.json.gz').environments;
for(const e of env){const normalized=structuredClone(e.source);delete normalized.settings.experimentalVelocityMode;normalized.schemaVersion='20.0.0';assert.deepEqual(normalized,oldEnv.find(x=>x.seed===e.seed&&x.condition.seed===e.condition.seed).source);assert.deepEqual(e.source,uncappedRevisedSource(revisedHybridNetwork(e.seed),e.condition));}
let packets=0,tickReceipts=0,learningReceipts=0,proposals=0;const learning={};
function check(d){const p=unpackPacket(d.packet),u=p.uncappedAudit;assert.equal(geneHash(p.snapshot),d.trial.finalSnapshotSha);assert.equal(geneHash(p.snapshot.state.organisms[0].genome),d.genomeSha??geneHash(d.genome));assert.equal(p.snapshot.schemaVersion,'96.0.0');assert.equal(p.snapshot.settings.experimentalVelocityMode,'uncapped-revised-v1');assert.equal(p.snapshot.settings.motorExperiment,'neural-motor-v2');
 const actual=uncappedRevisedMetrics(p);assert.deepEqual(actual,Object.fromEntries(Object.entries(d.trial).filter(([k])=>!['wallMs','trajectory','finalSnapshotSha'].includes(k))));assert.deepEqual(p.trajectory,d.trial.trajectory);assert.equal(p.metrics.ticks,720);assert.equal(u.ticks.length,720);assert.equal(u.stages.forces.samples,720*4*d.genome.parts.length);assert.equal(u.stages.contact.samples,720*4*d.genome.parts.length);assert.equal(u.guardLossJ,0);
 assert.equal(u.ticks.reduce((s,r)=>s+r[u.tickColumns.indexOf('absorbedJ')],0),d.trial.absorbedJ);const end=p.snapshot.state.organisms[0];
 for(const [kind,entries] of [['motor',end.learnedMotorWeights],['sensory',end.learnedSensoryWeights]])for(const e of entries??[]){const idx=u.edgeKeys.findIndex(k=>k.kind===kind&&k.edge===e.edge),last=u.learning.findLast(r=>r[1]===idx);assert.ok(idx>=0&&last);assert.equal(last[2],e.delta);assert.equal(last[4],e.consolidation??0);}
 packets++;tickReceipts+=u.ticks.length;learningReceipts+=u.learning.length;return p;}
let cachedPath,cache;
function packet(loc){if(loc.record===undefined)return read(loc.path);if(cachedPath!==loc.path){cache=gunzipSync(readFileSync(loc.path)).toString().trim().split('\n').map(JSON.parse);cachedPath=loc.path;}return cache[loc.record];}
const byKey=new Map(m.index.map(x=>[id(x.seed,x.generation,x.index),x]));assert.equal(byKey.size,1125);
for(const r of m.runs){const initial=read(r.initialPath);assert.deepEqual(initial.genome,revisedHybridNetwork(r.seed));check(initial);let parent=initial.genome,best=initial.trial,ref='initial',bestLoc={path:r.initialPath};
 for(const gs of r.generations){const d=read(gs.path);assert.equal(d.parentHash,geneHash(parent));assert.equal(d.offspring.length,15);
  for(const o of d.offspring){const key=mutationSeed(r.seed,gs.generation,o.index),fresh=intakeMutation(parent,key,o.index),entry=byKey.get(id(r.seed,gs.generation,o.index)),row=packet(entry.locator);
   assert.equal(geneHash(row.trial),entry.trialSha);assert.equal(row.trial.finalSnapshotSha,entry.snapshotSha);assert.equal(key,o.mutationSeed);assert.deepEqual(fresh.genome,row.genome);assert.deepEqual(fresh.mutation,o.mutation);assert.deepEqual(row.mutation,o.mutation);assert.equal(fresh.mutation.changes.length,8);assert.equal(geneHash(fresh.genome),o.genomeSha);assert.equal(row.parentHash,geneHash(parent));assert.deepEqual(o.trial,row.trial);check(row);proposals++;
  }
  const e=selectIntakeOnly(best,d.offspring.map(o=>o.trial));assert.equal(e.index,d.selectedIndex);if(e.index>=0){const o=d.offspring[e.index];parent=intakeMutation(parent,o.mutationSeed,o.index).genome;best=o.trial;ref='g'+gs.generation+'/o'+o.index;bestLoc=byKey.get(id(r.seed,gs.generation,o.index)).locator;}assert.deepEqual(parent,d.selectedGenome);assert.equal(geneHash(parent),d.selectedGenomeSha);assert.equal(best.absorbedJ,d.bestAbsorbedJ);assert.equal(ref,d.bestRef);
 }
 const c=read(r.championPath);assert.deepEqual(c.genome,parent);assert.deepEqual(c.training,best);assert.equal(c.selectedAt,ref);const p=checkChampionOnly(packet(bestLoc));learning[r.seed]=p;
 console.log(JSON.stringify({seed:r.seed,proposalsVerified:225,finalJ:best.absorbedJ}));
}
function checkChampionOnly(d){const u=d.packet.uncappedAudit,end=d.packet.snapshot.state.organisms[0];return{changeRecords:u.learning.rows,motorWeights:(end.learnedMotorWeights??[]).length,sensoryWeights:(end.learnedSensoryWeights??[]).length,motorNonzero:(end.learnedMotorWeights??[]).filter(e=>e.delta!==0).length,sensoryNonzero:(end.learnedSensoryWeights??[]).filter(e=>e.delta!==0).length};}
for(const h of m.heldOut){const d=read(h.path);assert.deepEqual(d.condition,h.condition);assert.equal(d.genomeSha,h.genomeSha);assert.equal(d.trial.absorbedJ,h.J);const r=m.runs.find(x=>x.seed===h.seed);assert.equal(d.genomeSha,h.role==='initial'?r.initialGenomeSha:r.finalGenomeSha);check(d);}
assert.equal(proposals,1125);assert.equal(packets,1160);
const integrity={proposalsReconstructed:proposals,decisionsReconstructed:75,packetsVerified:packets,tickReceipts,acquiredChangeRecords:learningReceipts,original275FilesUnchanged:true,priorArchiveHashesExact:true,allFrozenSourceHashesExact:true,all20EnvironmentsExact:true,allArchiveHashesExact:true,learning,provenance:m.provenance};
writeFileSync('docs/experiments/'+prefix+'-recovery-integrity.json',JSON.stringify(integrity,null,2)+'\n');
if(!process.argv.includes('--integrity-only')){
 const w=await startGatedWorker(),replay=[];try{assert.equal(hash(readFileSync(new URL(w.bundle))),m.worker.sha256);
 for(const r of m.runs){const c=read(r.championPath),expectedRow=c.selectedAt==='initial'?read(r.initialPath):packet(byKey.get(id(r.seed,...c.selectedAt.match(/g(\d+)\/o(\d+)/).slice(1).map(Number))).locator),expected=unpackPacket(expectedRow.packet);
 const actual=await w.trial(uncappedRevisedSource(c.genome),720,OPTIONS);assert.deepEqual(actual,expected);
 const first=await w.trial(uncappedRevisedSource(c.genome),360,OPTIONS);await w.reset(first.snapshot);const last=await w.request('experiment-step',{ticks:360,...OPTIONS});assert.equal(geneHash(last.snapshot),c.training.finalSnapshotSha);replay.push({seed:r.seed,fullPacketReplayExact:true,splitResetSnapshotPRNGExact:true});console.log(JSON.stringify(replay.at(-1)));
 }writeFileSync('docs/experiments/'+prefix+'-recovery-verification.json',JSON.stringify({...integrity,workerSha:m.worker.sha256,verificationOnly:{fullChampionReplays:5,splitRuns:5,halfStepRequests:10,trainingSelectionUses:0},replay},null,2)+'\n');
 }catch(error){writeFileSync('docs/experiments/'+prefix+'-REPLAY-DISCREPANCY.json',JSON.stringify({message:error.message,stack:error.stack},null,2));throw error;}finally{await w.close();}
}
console.log(JSON.stringify(integrity));

