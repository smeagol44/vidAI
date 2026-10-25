/** Audit only15 recovery outcomes. Full and split runs below are deterministic verification, never new dataset rows. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {read,save,hash,geneHash,unpackPacket} from './uncapped-plasticity-archive.mjs';
import {startGatedWorker} from './gated-worker-client.mjs';
import {RUNS,HELD,source,OPTIONS,metrics} from '../experiments/proximityTargeting.ts';
import {organs,mouthGap} from '../movingNutrient.ts';
import {plasticMotorEdges,plasticSensoryEdges,MAX_LEARNED_MOTOR_DELTA,PLASTIC_UPKEEP_J_PER_EDGE_SECOND,PLASTIC_REWRITE_J_PER_WEIGHT,CONSOLIDATED_MEMORY_UPKEEP_J_PER_SECOND} from '../simulation.ts';
import {feedingStrength} from '../proximityFeeding.ts';
const base='docs/experiments/proximity-targeting-v1/',root=base+'recovery/',f=read(base+'frozen.json.gz');
for(const[p,h]of Object.entries({...f.codeHashes,...f.priorHashes}))assert.equal(hash(readFileSync(p)),h,p);
for(const e of read(base+'training-artifact-manifest.json').files)assert.equal(hash(readFileSync(e.path)),e.sha256,e.path);
const files=new Map(),record=p=>{const b=readFileSync(p);files.set(p,{path:p,bytes:b.length,sha256:hash(b)});return read(p);};
let packets=0,changes=0,ticks=0,minMovingDot=Infinity,maxTargetSpeed=0,maxLearningResidual=0,maxExternalInputResidual=0,maxOralResidual=0,maxStrengthResidual=0,maxRewriteReceiptResidual=0,maxUpkeepReceiptResidual=0,contactJ=0,proximityJ=0;
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
function check(row){
 const p=unpackPacket(row.packet),q=p.snapshot.state.pursuit,t=row.trial,a=p.snapshot.state.proximityFeeding,req=record(root+'requests/'+row.key+'.json.gz');
 assert.equal(geneHash(row.genome),row.genomeSha);assert.equal(geneHash(p.snapshot),t.finalSnapshotSha);assert.equal(geneHash(q.trace),t.trajectorySha);
 assert.deepEqual(req.source,JSON.parse(JSON.stringify(source(row.genome,row.environment))));assert.equal(req.workerSha,f.workerSha);
 assert.deepEqual(metrics(p),Object.fromEntries(Object.entries(t).filter(([k])=>!['finalSnapshotSha','trajectorySha'].includes(k))));
 assert.deepEqual(p.snapshot.state.organisms[0].genome,row.genome);assert.equal(p.snapshot.schemaVersion,'103.0.0');assert.equal(q.steps,3600);assert.equal(q.trace.length,3600);assert.equal(a.bodyTrace.length,3600);assert.equal(a.samples.length,900);assert.equal(q.decisions.length,10);assert.equal(p.uncappedAudit.guardLossJ,0);assert.equal(p.metrics.ticks,900);assert.ok(p.metrics.maxEnergyErrorJ<1e-6);assert.ok(Math.abs(t.partitionResidualJ)<1e-6);assert.equal(t.deliveryError,0);near(p.torqueAudit.costJ,4*p.torqueAudit.positiveJ,1e-8);assert.deepEqual(q.schedule,req.source.state.pursuit.schedule);
 assert.deepEqual(q.decisions.map(d=>d.time),Array.from({length:10},(_,i)=>i*1.5));for(const d of q.decisions){assert.equal(d.offset,q.schedule[d.interval].offset);assert.equal(d.stop,q.schedule[d.interval].stop);assert.equal(d.heading,Math.atan2(d.y-d.com.y,d.x-d.com.x)+d.offset);}
 const o=structuredClone(req.source.state.organisms[0]);assert.equal(o.learnedMotorWeights?.length??0,0);assert.equal(o.learnedSensoryWeights?.length??0,0);assert.ok(o.neuralHidden.every(v=>v===0));assert.equal(o.energy,10000);assert.equal(req.source.state.nutrients.length,1);
 let J=0,gross=0,cJ=0,nJ=0;const by={moving:0,paused:0,frozen:0};
 for(let i=0;i<900;i++){
  const r=p.pursuitAudit.ticks[i],s=a.samples[i],tr=q.trace[4*i+3];
  assert.equal(r.tick,i+1);near(r.time,s.time,1e-8);assert.equal(s.strength,feedingStrength(s.gap));near(s.gap,Math.max(0,tr[9]),1e-9);assert.equal(s.contact,tr[9]<=0);assert.equal(r.contact,s.contact);
  near(r.absorbedJ,s.absorbedJ);near(r.grossJ,s.grossJ);near(s.absorbedJ,s.grossJ*.8,1e-12);assert.equal(s.state,r.state);assert.equal(s.state,['moving','paused','frozen'][tr[3]]);
  assert.ok(s.grossJ<=60*s.strength+1e-9);if(r.reserveJ<row.genome.maxEnergyCapacity-1e-6)near(s.grossJ,60*s.strength,1e-8);
  assert.ok(r.reserveJ<=row.genome.maxEnergyCapacity+1e-7&&r.reserveJ>=0);maxStrengthResidual=Math.max(maxStrengthResidual,Math.abs(s.strength-feedingStrength(s.gap)));
  J+=r.absorbedJ;gross+=r.grossJ;by[r.state]+=r.absorbedJ;if(s.contact)cJ+=s.absorbedJ;else nJ+=s.absorbedJ;
 }
 near(J,q.absorbedJ);near(gross,q.reservoirInputJ);for(const state of Object.keys(by))near(by[state],q.absorbedByState[state]);near(cJ,a.contactJ);near(nJ,a.proximityJ);near(cJ+nJ,J);contactJ+=cJ;proximityJ+=nJ;
 maxExternalInputResidual=Math.max(maxExternalInputResidual,Math.abs(p.snapshot.state.ledger.externalInflow-req.source.state.ledger.externalInflow-gross));maxOralResidual=Math.max(maxOralResidual,Math.abs(q.absorbedJ-p.foodAudit.absorbedJ));
 let previous=[0,req.source.state.nutrients[0].x,req.source.state.nutrients[0].y];
 for(let i=0;i<q.trace.length;i++){
  const r=q.trace[i],body=a.bodyTrace[i];assert.equal(r[0],(i+1)/240);assert.equal(body[0],r[0]);assert.equal(body.length,1+6*o.segments.length);
  o.segments.forEach((s,j)=>{const[x,y,angle,vx,vy,angVel]=body.slice(1+j*6,7+j*6);Object.assign(s,{x,y,angle,vx,vy,angVel});});
  const organ=organs(o);near(organ.com.x,r[5],1e-12);near(organ.com.y,r[6],1e-12);near(organ.mouths[0].x,r[7],1e-12);near(organ.mouths[0].y,r[8],1e-12);near(mouthGap(o,{x:r[1],y:r[2],radius:18}),r[9],1e-12);
  maxTargetSpeed=Math.max(maxTargetSpeed,Math.hypot(r[1]-previous[1],r[2]-previous[2])*240);if(r[3]===0)minMovingDot=Math.min(minMovingDot,22*Math.cos(r[4])*(r[1]-r[5])+22*Math.sin(r[4])*(r[2]-r[6]));previous=r;
 }
 const freeze=q.events.find(e=>e.kind==='freeze');if(freeze){near(Math.min(...freeze.eyes.map(e=>Math.hypot(freeze.x-e.x,freeze.y-e.y))),405,1e-8);for(const r of q.trace)if(r[0]>=freeze.time){assert.equal(r[3],2);assert.equal(r[1],freeze.x);assert.equal(r[2],freeze.y);}}
 const learn=p.learningAudit;maxLearningResidual=Math.max(maxLearningResidual,Math.abs(learn.costJ-learn.totals.motor.costJ-learn.totals.sensory.costJ));for(const category of ['motor','sensory'])if(row.genome.plasticConnections)assert.ok(learn.somatic[category].every(e=>row.genome.plasticConnections[category].includes(e.edge)));
 const allowed={motor:new Set(plasticMotorEdges(row.genome).map(e=>e.edge)),sensory:new Set(plasticSensoryEdges(row.genome).map(e=>e.edge))},keys=p.uncappedAudit.edgeKeys,entries=p.uncappedAudit.learning;
 for(const e of keys)assert.ok(allowed[e.kind]?.has(e.edge));
 const learnedPrevious=new Map(),stable={motor:0,sensory:0},rewrite={motor:0,sensory:0},upkeep={motor:0,sensory:0};let cursor=0;
 for(let tick=1;tick<=900;tick++){
  while(cursor<entries.length&&entries[cursor][0]===tick){const e=entries[cursor++],[time,index,delta,eligibility,consolidation]=e;assert.ok(Number.isInteger(index)&&keys[index]);assert.ok(Math.abs(delta)<=MAX_LEARNED_MOTOR_DELTA+1e-12&&Math.abs(eligibility)<=1+1e-12&&consolidation>=0&&consolidation<=1);const kind=keys[index].kind,old=learnedPrevious.get(index)??{delta:0,consolidation:0,tick:0};assert.ok(old.tick<tick);rewrite[kind]+=Math.abs(delta-old.delta)*PLASTIC_REWRITE_J_PER_WEIGHT;stable[kind]+=consolidation-old.consolidation;learnedPrevious.set(index,{delta,consolidation,tick});}
  for(const kind of ['motor','sensory'])upkeep[kind]+=allowed[kind].size*PLASTIC_UPKEEP_J_PER_EDGE_SECOND/60+stable[kind]*CONSOLIDATED_MEMORY_UPKEEP_J_PER_SECOND/60;
 }
 assert.equal(cursor,entries.length);
 for(const kind of ['motor','sensory']){const a=learn.totals[kind];maxRewriteReceiptResidual=Math.max(maxRewriteReceiptResidual,Math.abs(rewrite[kind]-a.rewriteJ));maxUpkeepReceiptResidual=Math.max(maxUpkeepReceiptResidual,Math.abs(upkeep[kind]-a.upkeepJ));near(rewrite[kind],a.rewriteJ,1e-8);near(upkeep[kind],a.upkeepJ,1e-8);near(a.rewriteJ,a.requestedRewriteJ,1e-8);near(a.costJ,a.upkeepJ+a.rewriteJ,1e-8);if(q.absorbedJ===0){assert.equal(a.rewriteJ,0);assert.ok(learn.somatic[kind].every(e=>e.delta===0));}}
 packets++;ticks+=900;changes+=p.uncappedAudit.learning.length;
}
const w=await startGatedWorker(),replay=[],rows=[];
try{assert.equal(hash(readFileSync(new URL(w.bundle))),f.workerSha);
 for(const {controller,seed} of RUNS){const champ=read(base+'champions/'+controller+'-'+seed+'.json.gz');
  for(const env of HELD){const key=controller+'-'+seed+'-held-'+env.seed,row=record(root+'packets/'+key+'.json.gz');
   assert.equal(row.evaluationClass,'recovery-evaluation');assert.equal(row.possiblePriorExecution,true);assert.deepEqual(row.environment,env);assert.deepEqual(row.genome,champ.genome);assert.equal(row.genomeSha,champ.genomeSha);assert.deepEqual(record(root+'received/'+key+'.json.gz').packet,row.packet);check(row);rows.push({key,evaluationClass:row.evaluationClass,possiblePriorExecution:true,environment:env,genomeSha:row.genomeSha,trial:row.trial});
   const expected=unpackPacket(row.packet),actual=await w.trial(source(champ.genome,env),900,OPTIONS);assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)));
   const receipt={key,verificationOnly:true,fullWorkerPacketExact:true,expectedPacketSha:geneHash(expected),actualPacketSha:geneHash(actual),finalSnapshotSha:geneHash(actual.snapshot),scheduleSha:geneHash(actual.snapshot.state.pursuit.schedule)};
   if(env.seed===811){const half=await w.trial(source(champ.genome,env),450,OPTIONS);save(root+'replay-halves/'+key+'.json.gz',half.snapshot);await w.reset(half.snapshot);const last=await w.request('experiment-step',{ticks:450,...OPTIONS});assert.equal(geneHash(last.snapshot),row.trial.finalSnapshotSha);Object.assign(receipt,{splitResetSnapshotPRNGExact:true,halfSnapshotSha:geneHash(half.snapshot),continuedSnapshotSha:geneHash(last.snapshot)});}
   replay.push(receipt);console.log(JSON.stringify({key,audited:true,J:row.trial.absorbedJ,fullWorkerPacketExact:true,splitReset:!!receipt.splitResetSnapshotPRNGExact}));
  }
 }
}finally{await w.close();}
assert.equal(packets,15);assert.equal(ticks,13500);
save(root+'verification.json',{heldOutRecoveryEvaluations:15,reusedOriginalHeldOuts:0,possiblePriorExecution:true,trainingOutcomesReexecuted:0,trainingArtifactsHashesUnchanged:true,frozenSourceAndPriorHashesExact:true,implementation:f.implementationCommit,workerSha:f.workerSha,packets,ticks,changes,bodyAndTargetSubsteps:54000,fullWorkerReplays:15,splitResetForks:5,verificationOnlyReplays:true,replay,rows,primaryFiles:[...files.values()],minMovingDot,maxTargetSpeed,maxLearningResidual,maxExternalInputResidual,maxOralResidual,maxStrengthResidual,maxRewriteReceiptResidual,maxUpkeepReceiptResidual,contactJ,proximityJ});
console.log('ALL15_RECOVERY_PACKETS_ENERGY_GEOMETRY_LEARNING_AND_WORKER_REPLAYS_VERIFIED');
