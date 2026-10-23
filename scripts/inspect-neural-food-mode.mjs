/** One read-only question: did the sole OSC-using champion deliver nonzero wave torque? */
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {startGatedWorker} from './gated-worker-client.mjs';import {foodSource} from '../experiments/neuralFood.ts';
const root='docs/experiments/',d=JSON.parse(gunzipSync(readFileSync(root+'neural-food-v1-C-two-output-1901.json.gz'))),w=await startGatedWorker();
try{const r=await w.trial(foodSource(d.champion.genome,'C'),300,{auditTorque:true,traceJoints:true,traceFood:true}),hash=createHash('sha256').update(JSON.stringify(r.snapshot)).digest('hex');assert.equal(hash,d.champion.training.finalSnapshotSha);
 const groups=r.torqueAudit.groups,osc=Object.entries(groups).filter(([k])=>k.endsWith('/oscillator'));assert.equal(osc.length,1);assert.equal(osc[0][1].samples,16);assert.ok(osc[0][1].appliedNormalized.rms>0);
 const result={question:'Actual delivered oscillator torque in sole OSC-using final champion; no ablation/fitness/functional-benefit claim',environment:'C',architecture:'two-output',seed:1901,verificationReplay:true,exactFinalSnapshot:true,finalSnapshotSha:hash,groups,positiveJ:r.torqueAudit.positiveJ,brakingJ:r.torqueAudit.negativeJ,motorJ:r.torqueAudit.costJ,guards:r.torqueAudit.guards};writeFileSync(root+'neural-food-v1-mode-receipt.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(osc));
}finally{await w.close();}
