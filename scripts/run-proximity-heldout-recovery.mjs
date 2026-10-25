/** Owner-authorized held-outs only. Never invokes training or selection. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {read,save,hash,geneHash,packPacket,unpackPacket} from './uncapped-plasticity-archive.mjs';
import {startGatedWorker} from './gated-worker-client.mjs';
import {RUNS,HELD,source,OPTIONS,metrics} from '../experiments/proximityTargeting.ts';
const base='docs/experiments/proximity-targeting-v1/',root=base+'recovery/',f=read(base+'frozen.json.gz'),ledger=read(base+'training-ledger.json.gz');
for(const [p,h] of Object.entries({...f.codeHashes,...f.priorHashes}))assert.equal(hash(readFileSync(p)),h,p);
assert.equal(f.implementationCommit,'f669e09a56e41a1b1c87ff5b8c6aaa5ec266d187');
assert.equal(read(base+'held-out-status.json').verifiedReceipts,0);
const slots=[];
for(const r of RUNS){const c=read(base+'champions/'+r.controller+'-'+r.seed+'.json.gz'),d=ledger.generations.find(x=>x.controller===r.controller&&x.seed===r.seed&&x.generation===10);assert.equal(geneHash(c.genome),d.selectedGenomeSha);assert.equal(c.genomeSha,d.selectedGenomeSha);assert.equal(c.training.absorbedJ,d.bestJ);assert.deepEqual(c.selectedOrigin,d.selectedOrigin);for(const environment of HELD)slots.push({key:r.controller+'-'+r.seed+'-held-'+environment.seed,controller:r.controller,brainSeed:r.seed,environment,genomeSha:c.genomeSha,sourceSha:geneHash(source(c.genome,environment)),selectedAt:c.selectedAt});}
if(process.argv[2]==='plan'){console.log(JSON.stringify({implementation:f.implementationCommit,workerSha:f.workerSha,slots}));process.exit(0);}
const slot=slots.find(s=>s.key===process.argv[2]);assert.ok(slot,'Only the 15 preregistered held-out slots are permitted');
const genome=read(base+'champions/'+slot.controller+'-'+slot.brainSeed+'.json.gz').genome,context={...slot,role:'held-out',evaluationClass:'recovery-evaluation',possiblePriorExecution:true,originalOutcomeStatus:'unresolved after runtime loss',authorization:'owner-recovery-authorization.md'};
const path=root+'packets/'+slot.key+'.json.gz',request=root+'requests/'+slot.key+'.json.gz',received=root+'received/'+slot.key+'.json.gz';
if(existsSync(path)){const r=read(path);assert.deepEqual(r.genome,genome);assert.deepEqual(r.environment,slot.environment);assert.equal(r.evaluationClass,'recovery-evaluation');assert.equal(geneHash(r.packet.snapshot),r.trial.finalSnapshotSha);console.log(JSON.stringify({key:slot.key,reusedVerifiedRecoveryPacket:true,simulationEvaluations:0}));process.exit(0);}
let packed;
if(existsSync(received)){const r=read(received);assert.deepEqual(r.genome,genome);assert.equal(r.sourceSha,slot.sourceSha);assert.equal(r.evaluationClass,'recovery-evaluation');packed=r.packet;}
else{
 assert.ok(!existsSync(request),'Uncertain RECOVERY request: do not automatically repeat');
 const intent=read(root+'active-intent.json');assert.equal(intent.key,slot.key);assert.equal(intent.sourceSha,slot.sourceSha);assert.equal(intent.workerSha,f.workerSha);
 const w=await startGatedWorker();try{assert.equal(hash(readFileSync(new URL(w.bundle))),f.workerSha);const src=source(genome,slot.environment);assert.equal(geneHash(src),slot.sourceSha);save(request,{...context,source:src,workerSha:f.workerSha});const packet=await w.trial(src,900,OPTIONS);packed=packPacket(packet);save(received,{...context,genome,packet:packed});}finally{await w.close();}
}
const p=unpackPacket(packed),trial={...metrics(p),finalSnapshotSha:geneHash(p.snapshot),trajectorySha:geneHash(p.snapshot.state.pursuit.trace)};
save(path,{...context,genome,trial,packet:packed});console.log(JSON.stringify({key:slot.key,evaluationClass:context.evaluationClass,possiblePriorExecution:true,J:trial.absorbedJ,contactJ:trial.physicalContactJ,proximityJ:trial.proximityJ}));
