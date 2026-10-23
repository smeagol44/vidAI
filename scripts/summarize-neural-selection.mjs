/** Reconstruct every proposal/elite from immutable raw archives; NO simulation/search. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ARCHITECTURES,START_SEEDS,initialNetwork,mutateNetwork,mutationSeed,chooseElite,parameterCount} from '../experiments/neuralSelection.ts';
const root='docs/experiments/',sha=b=>createHash('sha256').update(b).digest('hex'),hash=g=>sha(JSON.stringify(g));
const med=a=>{if(!a.length)return null;const s=a.toSorted((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const reasons=rows=>{const c={};for(const r of rows)for(const k of r.reasons)c[k]=(c[k]??0)+1;return c;};
const manifest=JSON.parse(readFileSync(root+'neural-selection-v1.json'));assert.equal(manifest.completed,true);
const runs=[];let reconstructed=0;
for(const architecture of ARCHITECTURES)for(const seed of START_SEEDS){
 const entry=manifest.runs.find(r=>r.architecture===architecture&&r.seed===seed),raw=readFileSync(root+entry.archive);assert.equal(sha(raw),entry.sha256);
 const d=JSON.parse(gunzipSync(raw));assert.ok(d.completed);assert.equal(hash(initialNetwork(architecture,seed)),d.initial.hash);
 let parent=d.initial.genome,best=d.initial.trial.valid?d.initial.trial:null;
 const selectorTrials=[],selected=[],training=[d.initial.trial];
 for(const g of d.generations){
  assert.equal(g.parentHash,hash(parent));const next=[];
  for(const o of g.offspring){
   assert.equal(o.mutationSeed,mutationSeed(seed,g.generation,o.index));const proposal=mutateNetwork(parent,architecture,o.mutationSeed,o.index);
   assert.deepEqual(proposal.mutation,o.mutation);assert.equal(hash(proposal.genome),o.genomeSha);reconstructed++;next.push(proposal.genome);training.push(o.trial);
   if(o.mutation.kind==='selector')selectorTrials.push({generation:g.generation,index:o.index,beforeDistance:best?.distance??null,valid:o.trial.valid,distance:o.trial.distance,reasons:o.trial.reasons,beneficial:!!(o.trial.valid&&(!best||o.trial.distance>best.distance)),selected:g.selectedIndex===o.index,...o.mutation});
  }
  const elite=chooseElite(best,g.offspring.map(o=>o.trial));assert.equal(elite.index,g.selectedIndex);
  if(elite.index>=0){parent=next[elite.index];best=g.offspring[elite.index].trial;selected.push({generation:g.generation,index:elite.index,kind:g.selectedMutation.kind,distance:best.distance,signedJoints:parent.motorController?.signedJoints??null});}
  assert.equal(hash(parent),g.selectedGenomeSha);assert.equal(best?.distance??null,g.bestValidDistance);
 }
 assert.equal(hash(parent),hash(d.selectedGenome));if(d.champion){assert.deepEqual(best,d.champion.training);assert.equal(hash(parent),d.champion.genomeSha);}else assert.equal(best,null);
 const all=[...training,...d.heldOut.map(x=>x.trial),...d.controls.map(x=>x.trial)],validTraining=training.filter(t=>t.valid),final=d.champion?.training??null;
 const finalHeld=d.heldOut.filter(x=>x.role==='final'),initialHeld=d.heldOut.filter(x=>x.role==='initial');
 const jointDifference=trial=>{const p=trial.trajectory.map(x=>x.organisms[0].joints);return {angleRms:Math.sqrt(p.reduce((s,j)=>s+(j[0].angle-j[1].angle)**2,0)/p.length),torqueRms:Math.sqrt(p.reduce((s,j)=>s+(j[0].torque-j[1].torque)**2,0)/p.length)};};
 runs.push({architecture,seed,parameters:parameterCount(parent),initialValid:d.initial.trial.valid,initialReasons:d.initial.trial.reasons,initialDistance:d.initial.trial.distance,finalDistance:final?.distance??null,improvement:final?final.distance-d.initial.trial.distance:null,fold:final?final.distance/d.initial.trial.distance:null,selectedAt:d.champion?.selectedAt??null,validOffspring:training.slice(1).filter(t=>t.valid).length,rejections:reasons(training.slice(1)),selected,selectorTrials,finalSignedJoints:d.champion?.genome.motorController?.signedJoints??null,
  generations:d.generations.map(g=>({generation:g.generation,best:g.bestValidDistance,medianValid:g.offspringMedianValid,medianRaw:g.offspringMedianRaw,valid:g.validOffspring,selected:g.selectedIndex})),
  trainingFinal:final&&Object.fromEntries(Object.entries(final).filter(([k])=>k!=='trajectory')),jointDifference:final?jointDifference(final):null,
  heldOut:finalHeld.map((h,i)=>({condition:h.condition,championAvailable:!!d.champion,valid:h.trial.valid,reasons:h.trial.reasons,distance:h.trial.distance,initialValid:initialHeld[i].trial.valid,initialDistance:initialHeld[i].trial.distance,lateDistance:h.trial.lateDistance,motorJ:h.trial.motorJ,spentJ:h.trial.spentJ,remainingJ:h.trial.remainingJ,guards:h.trial.guards,peakOmega:Math.max(h.trial.peakPostContactOmega,h.trial.peakConstraintOmega)})),
  controls:d.controls.map(c=>({control:c.control,championAvailable:c.championAvailable,...Object.fromEntries(Object.entries(c.trial).filter(([k])=>k!=='trajectory'))})),
  timing:{median5sMs:med(training.map(t=>t.wallMs)),totalTrainingMs:training.reduce((s,t)=>s+t.wallMs,0)},
  maxima:{chemicalErrorJ:Math.max(...all.map(t=>t.chemicalErrorJ)),partitionErrorJ:Math.max(...all.map(t=>Math.abs(t.partitionResidualJ))),constraintGainJ:Math.max(...all.map(t=>t.maxConstraintGainJ)),validAnchorPx:Math.max(...validTraining.map(t=>t.anchorPx)),validOmega:Math.max(...validTraining.map(t=>Math.max(t.peakConstraintOmega,t.peakPostContactOmega))),minReserveJ:Math.min(...all.map(t=>t.remainingJ)),maxAge:Math.max(...all.map(t=>t.age))}});
}
assert.equal(reconstructed,1728);
const architectures=ARCHITECTURES.map(a=>{const rows=runs.filter(r=>r.architecture===a),valid=rows.filter(r=>r.finalDistance!==null);return{architecture:a,successfulRuns:valid.length,medianInitialPx:med(rows.map(r=>r.initialDistance)),medianFinalPx:med(valid.map(r=>r.finalDistance)),medianImprovementPx:med(valid.map(r=>r.improvement)),validOffspring:rows.reduce((s,r)=>s+r.validOffspring,0),heldOutValid:rows.reduce((s,r)=>s+r.heldOut.filter(h=>h.championAvailable&&h.valid).length,0),heldOutImproved:rows.reduce((s,r)=>s+r.heldOut.filter(h=>h.championAvailable&&h.valid&&h.initialValid&&h.distance>h.initialDistance).length,0),median5sMs:med(rows.map(r=>r.timing.median5sMs)),medianChampionMotorJ:med(valid.map(r=>r.trainingFinal.motorJ)),medianChampionSpentJ:med(valid.map(r=>r.trainingFinal.spentJ))};});
const summary={version:manifest.version,counts:manifest.counts,reconstructed,architectures,runs};writeFileSync(root+'neural-selection-v1-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({counts:manifest.counts,architectures,runs:runs.map(r=>({architecture:r.architecture,seed:r.seed,initial:r.initialDistance,initialValid:r.initialValid,final:r.finalDistance,selected:r.selected.length,valid:r.validOffspring,selectors:r.selectorTrials.filter(t=>t.beneficial),held:r.heldOut,controls:r.controls.map(c=>({control:c.control,distance:c.distance,valid:c.valid,reasons:c.reasons}))}))},null,2));
