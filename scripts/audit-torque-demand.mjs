/** Bounded causal diagnostics only: no search, selection, force sweep or retuning. */
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {startGatedWorker} from './gated-worker-client.mjs';
import {torqueAuditSource,TORQUE_AUDIT_IDS,TORQUE_AUDIT_CONDITIONS,TORQUE_AUDIT_VARIANTS} from '../experiments/torqueAuditSetup.ts';
import {BASE_PART_DENSITY} from '../simulation.ts';
const previous=JSON.parse(await readFile('docs/experiments/gated-worker-v1.json','utf8'));
const preservedSHA256=createHash('sha256').update(await readFile('docs/experiments/gated-worker-v1.json')).digest('hex');
const w=await startGatedWorker(), rows=[];let preservedRows=0;
try {
  for(const id of TORQUE_AUDIT_IDS)for(const c of TORQUE_AUDIT_CONDITIONS)for(const variant of TORQUE_AUDIT_VARIANTS){
    const source=torqueAuditSource(id,variant,c);
    const r=await w.trial(source,300,{auditTorque:true});
    // Observation must preserve ALL archived metrics for every existing
    // representative row, not just match a loosened swimming tolerance.
    if(variant!=='legacy-fresh-head'){
      const old=previous.rows.find(x=>x.id===id&&x.variant===variant&&JSON.stringify(x.condition)===JSON.stringify(c));
      assert.ok(old,'Missing frozen comparison row');
      for(const [key,value]of Object.entries(r.metrics))assert.deepEqual(value,old[key],`${id}/${variant}/${c.seed}/${key}`);
      preservedRows++;
    }
    const t=r.torqueAudit;
    assert.equal(t.totals.deliveryErrorMax,0);assert.equal(t.guards,r.metrics.guards);
    assert.ok(Math.abs(t.costJ-r.metrics.motorJ)<1e-9);
    assert.ok(Math.abs(t.positiveJ-r.metrics.positiveWorkJ)<1e-9);
    assert.ok(Math.abs(t.negativeJ-r.metrics.negativeWorkJ)<1e-9);
    const org=source.state.organisms[0],parts=org.genome.parts;
    const scales=parts.map(p=>{
      const mass=Math.max(.35,p.dimN*p.dimM*BASE_PART_DENSITY),inertia=mass*(p.width*p.width+p.height*p.height)/12;
      return {part:p.id,width:p.width,height:p.height,mass,inertia,
        axialEulerDamping:.05*c.viscosity*p.height/mass/240,
        lateralEulerDamping:2*c.viscosity*p.width/mass/240,
        angularEulerDamping:c.viscosity*(p.width**3+p.height**3)/(6*inertia)/240};
    });
    const joints=parts.slice(1).map((p,j)=>{
      const a=scales[p.parentIndex].inertia,b=scales[j+1].inertia,ceiling=(a+b)*.5*2200;
      return {joint:j,ceiling,freeRelativeAcceleration:ceiling*(1/a+1/b),
        freeRelativeDeltaAtFullCommand:ceiling*(1/a+1/b)/240};
    });
    rows.push({id,condition:c,variant,genomeSHA256:createHash('sha256').update(JSON.stringify(org.genome)).digest('hex'),
      metrics:r.metrics,torque:t,scales,joints});
    console.log(`${id} ${c.seed} ${variant}: travel=${r.metrics.founders[0].displacementPx.toFixed(2)}, demand RMS=${t.totals.requestedNormalized.rms.toFixed(4)}, guards=${t.guards}, budget limits=${t.limitedBatches}`);
  }
  assert.equal(preservedRows,45);
  const bundle=(await readdir('dist/assets')).find(n=>/^simulation\.worker-.*\.js$/.test(n));
  const report={audit:'torque-demand-v1',baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    builtWorkerSHA256:createHash('sha256').update(await readFile('dist/assets/'+bundle)).digest('hex'),
    preservedComparisonSHA256:preservedSHA256,archivedMetricRowsExactlyPreserved:preservedRows,
    scope:'three frozen body families, original three matched conditions, six controller cases, 300 fixed ticks in the actual built Worker',
    assumptions:'unchanged passive-work-v3, original drag/limits/funding; legacy fresh-head is an offline initialization null on copies, not a selected starter',rows};
  await writeFile('docs/experiments/torque-demand-v1.json',JSON.stringify(report,null,2)+'\n');
  assert.equal(createHash('sha256').update(await readFile('docs/experiments/gated-worker-v1.json')).digest('hex'),preservedSHA256);
  console.log(`Saved ${rows.length} instrumented trials; ${preservedRows} archived metric rows match exactly; original report unchanged.`);
} finally {await w.close();}
