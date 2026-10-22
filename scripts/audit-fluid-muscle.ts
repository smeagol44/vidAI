/** One bounded reference-calibration experiment, not live optimization or an
 * upgradeable physics regime. All comparisons use the actual production solver. */
import assert from 'node:assert/strict';
import {FEATURED_BLUEPRINTS} from '../founders';
import {observeSolver} from '../solverPassivityAudit';
import {type FoundationTrial} from '../foundationPhysics';
const modes: (FoundationTrial | 'baseline')[]=['baseline','coherent-spin','anatomical-muscles','combined'];
const pairs: [number,number][]=[[.37,.18],[.8,.15],[-1,.22]];
const rows=[];
for(const design of FEATURED_BLUEPRINTS)for(const [heading,viscosity] of pairs){
  const reference=observeSolver(design.id,'passive-work-v3',5,heading,viscosity);
  for(const mode of modes){
    const row=mode==='baseline'?reference:observeSolver(design.id,'passive-work-v3',5,heading,viscosity,false,mode);
    assert.ok(row.maxConstraintGainJ<1e-12);
    assert.ok(Math.abs(row.chemicalErrorJ)<1e-6);
    const distanceChangePct=100*(row.displacementPx/reference.displacementPx-1);
    const reserveChangePct=100*(row.reserveSpentJ/reference.reserveSpentJ-1);
    rows.push({id:design.id,mode,heading,viscosity,displacementPx:row.displacementPx,
      distanceChangePct,reserveSpentJ:row.reserveSpentJ,reserveChangePct,
      guards:row.guards,referenceGuards:reference.guards,
      maxAnchorErrorPx:row.maxAnchorErrorPx,maxLimitExcessRad:row.maxLimitExcessRad,
      limitedBatches:row.limitedBatches,ledgerErrorJ:row.chemicalErrorJ});
  }
}
for(const mode of modes.filter(x=>x!=='baseline')){
  const subset=rows.filter(x=>x.mode===mode);
  const abs=(s:'distanceChangePct'|'reserveChangePct')=>[...subset].sort((a,b)=>Math.abs(b[s])-Math.abs(a[s]))[0];
  const worstMovement=subset.sort((a,b)=>a.distanceChangePct-b.distanceChangePct)[0];
  console.log('FLUID_MUSCLE_SUMMARY '+JSON.stringify({mode,
    worstTravelLoss:worstMovement,
    maxAbsTravelChange:abs('distanceChangePct'),
    maxAbsReserveChange:abs('reserveChangePct'),
    samples:subset.length,guardIncreases:subset.filter(x=>x.guards>x.referenceGuards).length}));
}
for(const row of rows.filter(r=>r.heading===.37))console.log('FLUID_MUSCLE_ROW '+JSON.stringify(row));
