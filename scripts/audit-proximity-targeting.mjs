/** Full original-packet audit. Only five final-specimen replay/reset fixtures execute physics. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {read,save,hash,geneHash,unpackPacket} from './uncapped-plasticity-archive.mjs';
import {startGatedWorker} from './gated-worker-client.mjs';
import {RUNS,initial,source,OPTIONS,mutate,makeOrigin,mutationSeed,HELD,metrics} from '../experiments/proximityTargeting.ts';
import {organs,mouthGap} from '../movingNutrient.ts';
import {plasticMotorEdges,plasticSensoryEdges,MAX_LEARNED_MOTOR_DELTA,PLASTIC_UPKEEP_J_PER_EDGE_SECOND,PLASTIC_REWRITE_J_PER_WEIGHT,CONSOLIDATED_MEMORY_UPKEEP_J_PER_SECOND} from '../simulation.ts';
import {feedingStrength} from '../proximityFeeding.ts';
const root='docs/experiments/proximity-targeting-v1/',f=read(root+'frozen.json.gz');
assert.ok(read(root+'complete.json').completed);
for(const[p,h]of Object.entries({...f.codeHashes,...f.priorHashes}))assert.equal(hash(readFileSync(p)),h,p);
const files=new Map(),record=p=>{const b=readFileSync(p);files.set(p,{path:p,bytes:b.length,sha256:hash(b)});return read(p);};
const runs=[],ledger=[];let packets=0,changes=0,ticks=0,minMovingDot=Infinity,maxTargetSpeed=0,maxLearningResidual=0,maxExternalInputResidual=0,maxOralResidual=0,maxStrengthResidual=0,maxRewriteReceiptResidual=0,maxUpkeepReceiptResidual=0,contactJ=0,proximityJ=0;
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
for(const r of RUNS){
 const c=r.controller,s=r.seed,init=record(root+'initial/'+c+'-'+s+'.json.gz');assert.deepEqual(init.genome,initial(c,s).genome);check(record(init.packetPath));let parent=init.genome,best=init.trial,ref='initial',bestPath=init.packetPath,origin=null;
 for(let g=1;g<=10;g++){
  const key=c+'-'+s+'-g'+String(g).padStart(2,'0'),d=record(root+'generations/'+key+'.json.gz'),input=record(root+'inputs/'+key+'.json.gz');
  assert.equal(d.parentHash,geneHash(parent));assert.deepEqual(input.parentGenome,parent);assert.equal(d.incumbentJ,best.absorbedJ);assert.equal(d.incumbentRef,ref);assert.equal(d.offspring.length,10);assert.deepEqual(input.parentOrigin,origin);assert.deepEqual(d.parentOrigin,origin);let chosen=-1,next=best;
  for(let i=0;i<10;i++){
   const o=d.offspring[i],key=mutationSeed(s,g,i),fresh=mutate(parent,c,s,key,i,origin,geneHash(parent)),row=record(o.packetPath);assert.equal(o.index,i);assert.equal(o.mutationSeed,key);assert.deepEqual(o.neuralMutation,fresh.neuralMutation);assert.equal(o.neuralMutation.changes.length,8);assert.deepEqual(o.lineageMutation,fresh.lineageMutation);assert.deepEqual(row.lineageMutation,fresh.lineageMutation);
   if(c==='mutable'){assert.deepEqual(o.learningMutation,fresh.learningMutation);assert.equal(o.learningMutation.draws.length,9);}assert.deepEqual(row.genome,fresh.genome);assert.deepEqual(input.proposals[i].genome,fresh.genome);assert.equal(o.genomeSha,geneHash(fresh.genome));assert.deepEqual(o.trial,row.trial);check(row);if(o.trial.absorbedJ>next.absorbedJ){next=o.trial;chosen=i;}
  }
  assert.equal(chosen,d.selectedIndex);
  if(chosen>=0){const child=input.proposals[chosen].genome;ref='g'+g+'/o'+chosen;origin=makeOrigin(parent,child,input.proposals[chosen].lineageMutation.receipts,geneHash(parent),c+'-'+s+'-'+ref,geneHash(child));parent=child;bestPath=d.offspring[chosen].packetPath;}
  best=next;assert.deepEqual(parent,d.selectedGenome);assert.deepEqual(origin,d.selectedOrigin);assert.deepEqual(best,d.selectedTrial);assert.equal(ref,d.bestRef);assert.equal(best.absorbedJ,d.bestJ);
  ledger.push({controller:c,seed:s,generation:g,parentHash:d.parentHash,parentOrigin:d.parentOrigin,selectedOrigin:d.selectedOrigin,incumbentJ:d.incumbentJ,selectedIndex:chosen,selectedGenomeSha:d.selectedGenomeSha,bestJ:d.bestJ,bestRef:ref,offspring:d.offspring.map(o=>({index:o.index,mutationSeed:o.mutationSeed,genomeSha:o.genomeSha,neuralMutation:o.neuralMutation,lineageMutation:o.lineageMutation,...(o.learningMutation?{learningMutation:o.learningMutation}:{}),absorbedJ:o.trial.absorbedJ,physicalContactJ:o.trial.physicalContactJ,proximityJ:o.trial.proximityJ,finalSnapshotSha:o.trial.finalSnapshotSha}))});
 }
 const champ=record(root+'champions/'+c+'-'+s+'.json.gz');assert.deepEqual(champ.genome,parent);assert.deepEqual(champ.training,best);assert.deepEqual(champ.selectedOrigin,origin);assert.equal(champ.unchangedFounder,ref==='initial');for(const env of HELD){const h=record(root+'packets/'+c+'-'+s+'-held-'+env.seed+'.json.gz');assert.deepEqual(h.genome,parent);assert.deepEqual(h.environment,env);check(h);}
 runs.push({...r,initialJ:init.trial.absorbedJ,initialGenomeSha:init.genomeSha,finalJ:best.absorbedJ,finalGenomeSha:geneHash(parent),selectedAt:ref,bestPath});console.log(JSON.stringify({controller:c,seed:s,verifiedOffspring:100,finalJ:best.absorbedJ}));
}
assert.equal(packets,520);assert.equal(ledger.length,50);assert.equal(readdirSync(root+'packets').length,520);assert.equal(readdirSync(root+'requests').length,520);
const diagnostic={minMovingDot:Number.isFinite(minMovingDot)?minMovingDot:null,maxTargetSpeed,maxLearningResidual,maxExternalInputResidual,maxOralResidual,maxStrengthResidual,maxRewriteReceiptResidual,maxUpkeepReceiptResidual,allTrialsContactJ:contactJ,allTrialsProximityJ:proximityJ};
save(root+'complete-ledger.json.gz',{counts:{offspring:500,founders:5,heldOut:15,total:520},runs,generations:ledger});
save(root+'completion.json',{completed:true,packets,decisions:50,offspring:500,ticks,changes,bodyAndTargetSubsteps:packets*3600,primaryFiles:[...files.values()],frozenSourceAndPriorHashesExact:true,workerSha:f.workerSha,implementation:f.implementationCommit,...diagnostic});
const w=await startGatedWorker(),replay=[];
try{assert.equal(hash(readFileSync(new URL(w.bundle))),f.workerSha);for(const run of runs){const champ=read(root+'champions/'+run.controller+'-'+run.seed+'.json.gz'),expected=unpackPacket(read(run.bestPath).packet),actual=await w.trial(source(champ.genome),900,OPTIONS);assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)));const half=await w.trial(source(champ.genome),450,OPTIONS);await w.reset(half.snapshot);const last=await w.request('experiment-step',{ticks:450,...OPTIONS});assert.equal(geneHash(last.snapshot),champ.training.finalSnapshotSha);replay.push({...run,canonicalFullPacketExact:true,splitResetSnapshotPRNGExact:true});console.log(JSON.stringify(replay.at(-1)));}}finally{await w.close();}
save(root+'verification.json',{packets,offspring:500,decisions:50,ticks,changes,frozenSourceAndPriorHashesExact:true,fullWorkerReplays:5,splitResetForks:5,verificationOnly:true,replay,...diagnostic});console.log('ALL520_PACKETS_COORDINATES_AND_EXACT_WORKER_REPLAY_VERIFIED');
