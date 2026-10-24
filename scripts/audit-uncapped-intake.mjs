/** Offline archive audit and exact final replay/fork; NEVER runs selection. */
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {root,prefix,hash,geneHash,readArchive} from './uncapped-archive.mjs';
import {uncappedSource,uncappedMetrics,UNCAPPED_OPTIONS,intakeNetwork,intakeMutation,mutationSeed,chooseUncappedElite} from '../experiments/uncappedIntake.ts';
import {startGatedWorker} from './gated-worker-client.mjs';
const m=readArchive(prefix+'.json');assert.ok(m.completed);assert.deepEqual(m.counts,{founder:1,offspring:225,heldOut:3,total:229});
for(const f of m.files)assert.equal(hash(readFileSync(root+f.archive)),f.sha256,f.archive);
for(const [p,h] of Object.entries(m.protectedHashes))assert.equal(hash(readFileSync(root+p)),h,p);
for(const [p,h] of Object.entries(m.codeHashes))assert.equal(hash(readFileSync(p)),h,p);
for(const r of readArchive(prefix+'-protected-branches.json')){assert.equal(execFileSync('git',['rev-parse',r.ref],{encoding:'utf8'}).trim(),r.head);assert.equal(execFileSync('git',['ls-tree','-r',r.ref,'docs/experiments'],{encoding:'utf8'}),r.experimentTree);}
const old=readArchive('nutrient-intake-v1-neural-hybrid-initial.json.gz'),initial=readArchive(prefix+'-initial.json.gz');assert.deepEqual(initial.genome,old.initial.genome);assert.deepEqual(initial.genome,intakeNetwork('neural-hybrid'));
const environments=readArchive(prefix+'-environments.json.gz').environments;
for(const e of environments){assert.deepEqual(e.source,uncappedSource(initial.genome,e.condition));const base=structuredClone(e.source);delete base.settings.experimentalVelocityMode;base.schemaVersion='19.0.0';const archived=readArchive('nutrient-intake-v1-environments.json.gz').environments.find(x=>x.architecture==='neural-hybrid'&&x.condition.seed===e.condition.seed);assert.deepEqual(base,archived.source);}
let count=0,parts=0,intakeReceipts=0,learningChanges=0,modeEntries=0;
function checkTrial(d){
 const p=d.packet,u=p.uncappedAudit;assert.equal(geneHash(p.snapshot),d.trial.finalSnapshotSha);assert.deepEqual(uncappedMetrics(p),Object.fromEntries(Object.entries(d.trial).filter(([k])=>!['wallMs','trajectory','finalSnapshotSha'].includes(k))));
 assert.equal(p.snapshot.schemaVersion,'94.0.0');assert.equal(p.snapshot.settings.experimentalVelocityMode,'uncapped-hybrid-v1');assert.equal(p.metrics.ticks,720);
 const n=d.genome.parts.length;assert.equal(u.forces.length,720*4*n);assert.equal(u.contact.length,720*4*n);assert.equal(u.ticks.length,720);assert.equal(u.guardLossJ,0);
 let mx=0,om=0,l=0,a=0;
 for(const row of [...u.forces,...u.contact]){assert.ok(row.every(Number.isFinite));const speed=Math.hypot(row[5],row[6]);mx=Math.max(mx,speed);om=Math.max(om,Math.abs(row[7]));l+=Number(speed>400);a+=Number(Math.abs(row[7])>20);}
 assert.equal(u.maxLinearSpeed,mx);assert.equal(u.maxAngularSpeed,om);assert.equal(u.linearExceedances,l);assert.equal(u.angularExceedances,a);parts+=u.contact.length+u.forces.length;
 let absorbed=0;for(const t of u.ticks)for(const f of Object.values(t.mouthFeedback??{}))absorbed+=(f.intake??0)*3600/60;assert.equal(absorbed,d.trial.absorbedJ);intakeReceipts+=u.ticks.length;
 const final=d.packet.snapshot.state.organisms[0];
 for(const [kind,entries] of [['motor',final.learnedMotorWeights],['sensory',final.learnedSensoryWeights]])for(const e of entries??[]){const last=u.learning.findLast(x=>x.kind===kind&&x.edge===e.edge);assert.ok(last);assert.equal(last.delta,e.delta);assert.equal(last.consolidation??0,e.consolidation??0);}
 learningChanges+=u.learning.length;modeEntries+=u.transitions.length;
}
checkTrial(initial);let parent=initial.genome,best=initial.trial,bestRef='initial';
for(let generation=1;generation<=15;generation++){
 const d=readArchive(prefix+`-g${String(generation).padStart(2,'0')}.json.gz`);assert.equal(d.parentHash,geneHash(parent));assert.equal(d.offspring.length,15);
 for(const o of d.offspring){const full=readArchive(o.archive),key=mutationSeed(17,generation,o.index),r=intakeMutation(parent,key,o.index);assert.equal(o.mutationSeed,key);assert.deepEqual(r.mutation,o.mutation);assert.equal(r.mutation.changes.length,8);assert.deepEqual(full.genome,r.genome);assert.equal(o.genomeSha,geneHash(r.genome));assert.deepEqual(full.trial,o.trial);checkTrial(full);count++;}
 const elite=chooseUncappedElite(best,d.offspring.map(x=>x.trial));assert.equal(elite.index,d.selectedIndex);if(elite.index>=0){parent=intakeMutation(parent,d.offspring[elite.index].mutationSeed,elite.index).genome;best=elite.best;bestRef=`g${generation}/o${elite.index}`;}
 assert.deepEqual(parent,d.selectedGenome);assert.equal(best.absorbedJ,d.bestAbsorbedJ);assert.equal(bestRef,d.bestRef);
}
assert.equal(count,225);const c=readArchive(prefix+'-champion.json.gz');assert.deepEqual(c.genome,parent);assert.equal(c.selectedAt,bestRef);assert.deepEqual(c.training,best);
for(const h of m.heldOut){const d=readArchive(h.archive);assert.deepEqual(d.genome,parent);assert.deepEqual(d.condition,h.condition);checkTrial(d);}
const w=await startGatedWorker();try{
 assert.equal(hash(readFileSync(new URL(w.bundle))),m.workerSha);
 const expected=readArchive(bestRef==='initial'?prefix+'-initial.json.gz':prefix+`-${bestRef.replace('/','-').replace(/g(\d+)/,(_,n)=>'g'+n.padStart(2,'0')).replace(/o(\d+)/,(_,n)=>'o'+n.padStart(2,'0'))}.json.gz`).packet;
 const replay=await w.trial(uncappedSource(parent),720,UNCAPPED_OPTIONS);assert.deepEqual(replay,expected);
 const half=await w.trial(uncappedSource(parent),360,UNCAPPED_OPTIONS);await w.reset(half.snapshot);const rest=await w.request('experiment-step',{ticks:360,...UNCAPPED_OPTIONS});assert.equal(geneHash(rest.snapshot),best.finalSnapshotSha);
 const out={version:prefix,offspringReconstructed:count,trainingAndHeldOutTrialsVerified:229,allArchivesAndProtectedEvidenceExact:true,allOriginalEnvironmentsAndFreshFounderExact:true,partStageReceipts:parts,tickIntakeReceipts:intakeReceipts,acquiredWeightChangeReceipts:learningChanges,modeEntries,finalWorkerPacketReplayExact:true,splitResetSnapshotPRNGExact:true};
 writeFileSync(root+prefix+'-verification.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
}finally{await w.close();}
