/** Reconstruct every proposal/elite; replay frozen final specimens ONLY. */
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {root,prefix,hash,geneHash,readArchive,readJournal,unpackPacket} from './uncapped-revised-archive.mjs';
import {HYBRID_SEEDS as SEEDS,revisedHybridNetwork,intakeMutation,mutationSeed,selectIntakeOnly,uncappedRevisedSource,uncappedRevisedMetrics,UNCAPPED_REVISED_OPTIONS as OPTIONS} from '../experiments/uncappedRevisedIntake.ts';import {startGatedWorker} from './gated-worker-client.mjs';
const m=readArchive(prefix+'.json');assert.equal(m.completed,true);assert.deepEqual(m.counts,{founder:5,offspring:1125,heldOut:30,total:1160});
for(const f of m.files)assert.equal(hash(readFileSync(root+f.archive)),f.sha256,f.archive);for(const [p,h] of Object.entries(m.codeHashes))assert.equal(hash(readFileSync(p)),h,p);for(const [p,h] of Object.entries(m.protectedHashes))assert.equal(hash(readFileSync(root+p)),h,p);
for(const r of readArchive(prefix+'-protected-branches.json')){assert.equal(execFileSync('git',['rev-parse',r.ref],{encoding:'utf8'}).trim(),r.head);assert.equal(execFileSync('git',['ls-tree','-r',r.ref,'docs/experiments'],{encoding:'utf8'}),r.tree);}
const oldEnvironments=readArchive('hybrid-threshold-intake-v1-environments.json.gz').environments;
for(const e of readArchive(prefix+'-environments.json.gz').environments){const old=oldEnvironments.find(x=>x.seed===e.seed&&x.condition.seed===e.condition.seed),normalized=structuredClone(e.source);normalized.schemaVersion='20.0.0';delete normalized.settings.experimentalVelocityMode;assert.deepEqual(normalized,old.source);assert.deepEqual(e.source,uncappedRevisedSource(revisedHybridNetwork(e.seed),e.condition));}
let packets=0,tickReceipts=0,learningReceipts=0,proposals=0;
function check(d){const p=unpackPacket(d.packet),u=p.uncappedAudit;assert.equal(geneHash(p.snapshot),d.trial.finalSnapshotSha);assert.equal(geneHash(p.snapshot.state.organisms[0].genome),d.genomeSha??geneHash(d.genome));assert.equal(p.snapshot.schemaVersion,'96.0.0');assert.equal(p.snapshot.settings.motorExperiment,'neural-motor-v2');
 assert.deepEqual(uncappedRevisedMetrics(p),Object.fromEntries(Object.entries(d.trial).filter(([k])=>!['wallMs','trajectory','finalSnapshotSha'].includes(k))));assert.equal(p.metrics.ticks,720);assert.equal(u.ticks.length,720);assert.equal(u.stages.forces.samples,720*4*d.genome.parts.length);assert.equal(u.stages.contact.samples,720*4*d.genome.parts.length);assert.equal(u.guardLossJ,0);
 const absorbedIndex=u.tickColumns.indexOf('absorbedJ');assert.equal(u.ticks.reduce((s,r)=>s+r[absorbedIndex],0),d.trial.absorbedJ);assert.ok(d.trial.absorbedJ<=d.trial.food.grossFoodJ);const end=p.snapshot.state.organisms[0];
 for(const [kind,entries] of [['motor',end.learnedMotorWeights],['sensory',end.learnedSensoryWeights]])for(const e of entries??[]){const idx=u.edgeKeys.findIndex(k=>k.kind===kind&&k.edge===e.edge);assert.ok(idx>=0);const last=u.learning.findLast(r=>r[1]===idx);assert.ok(last);assert.equal(last[2],e.delta);assert.equal(last[4],e.consolidation??0);}
 packets++;tickReceipts+=u.ticks.length;learningReceipts+=u.learning.length;return p;
}
const finals=[];
for(const seed of SEEDS){const initial=readArchive(prefix+`-${seed}-initial.json.gz`),oldInitial=readArchive(`hybrid-threshold-intake-v1-${seed}-initial.json.gz`).initial;assert.deepEqual(initial.genome,oldInitial.genome);assert.deepEqual(initial.genome,revisedHybridNetwork(seed));check(initial);
 let parent=initial.genome,best=initial.trial,bestRef='initial',bestArchive=prefix+`-${seed}-initial.json.gz`;
 for(let generation=1;generation<=15;generation++){
  const d=readArchive(prefix+`-${seed}-g${String(generation).padStart(2,'0')}.json.gz`);assert.equal(d.parentHash,geneHash(parent));assert.equal(d.offspring.length,15);const groups=new Map();
  for(const o of d.offspring){if(!groups.has(o.archive))groups.set(o.archive,readJournal(o.archive));const rows=groups.get(o.archive),header=rows[0],row=rows[o.record];assert.equal(rows.length,6);assert.deepEqual(header.parentGenome,parent);assert.equal(header.parentHash,geneHash(parent));assert.equal(header.incumbentAbsorbedJ,best.absorbedJ);assert.equal(header.incumbentRef,bestRef);
   const key=mutationSeed(seed,generation,o.index),fresh=intakeMutation(parent,key,o.index);assert.equal(key,o.mutationSeed);assert.deepEqual(fresh.genome,row.genome);assert.deepEqual(fresh.mutation,o.mutation);assert.equal(fresh.mutation.changes.length,8);assert.equal(geneHash(fresh.genome),o.genomeSha);assert.deepEqual(o.trial,row.trial);check(row);proposals++;
  }
  const elite=selectIntakeOnly(best,d.offspring.map(o=>o.trial));assert.equal(elite.index,d.selectedIndex);if(elite.index>=0){const o=d.offspring[elite.index];parent=intakeMutation(parent,o.mutationSeed,o.index).genome;best=o.trial;bestRef=`g${generation}/o${o.index}`;bestArchive={archive:o.archive,record:o.record};}
  assert.deepEqual(parent,d.selectedGenome);assert.equal(geneHash(parent),d.selectedGenomeSha);assert.equal(best.absorbedJ,d.bestAbsorbedJ);assert.equal(bestRef,d.bestRef);assert.deepEqual(bestArchive,d.bestArchive);
 }
 const c=readArchive(prefix+`-${seed}-champion.json.gz`);assert.deepEqual(c.genome,parent);assert.deepEqual(c.training,best);assert.equal(c.selectedAt,bestRef);assert.deepEqual(c.bestArchive,bestArchive);finals.push(c);
}
assert.equal(proposals,1125);for(const h of m.heldOut){const d=readArchive(h.archive);assert.deepEqual(d.condition,h.condition);assert.equal(d.genomeSha,h.genomeSha);check(d);}assert.equal(packets,1160);
const w=await startGatedWorker();try{
 assert.equal(hash(readFileSync(new URL(w.bundle))),m.workerSha);const replay=[];
 for(const c of finals){const d=typeof c.bestArchive==='string'?readArchive(c.bestArchive):readJournal(c.bestArchive.archive)[c.bestArchive.record],expected=unpackPacket(d.packet),actual=await w.trial(uncappedRevisedSource(c.genome),720,OPTIONS);assert.deepEqual(actual,expected);
  const first=await w.trial(uncappedRevisedSource(c.genome),360,OPTIONS);await w.reset(first.snapshot);const last=await w.request('experiment-step',{ticks:360,...OPTIONS});assert.equal(geneHash(last.snapshot),c.training.finalSnapshotSha);replay.push({seed:c.seed,fullPacketReplayExact:true,splitResetSnapshotPRNGExact:true});
 }
 const out={version:prefix,proposalsReconstructed:proposals,decisionsReconstructed:75,packetsVerified:packets,tickReceipts,acquiredChangeRecords:learningReceipts,allPrimaryAndPriorHashesExact:true,allFiveInitialGenomesAnd20EnvironmentsExact:true,replay};writeFileSync(root+prefix+'-verification.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
}finally{await w.close();}
