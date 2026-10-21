/** Bounded frozen-genome observation. No optimization or runtime feedback. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createFounderGenome, FEATURED_BLUEPRINTS} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, totalAccountedEnergy} from '../persistence';
import {stepSimulation, calculateOrganismCOM, getCardinalAnchor, getChildAnchorForParentDir} from '../simulation';
const results = [];
for (const design of FEATURED_BLUEPRINTS) for (const physicsRegime of ['legacy-v0', 'surface-work-v1', 'paid-work-v2'] as const) {
  const settings = {...DEFAULT_SETTINGS, physicsRegime, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
  const state = createInitialWorld(settings, 711, 'balanced', 'standard', 0);
  const org = addExternalOrganism(state, createFounderGenome(design.id), settings, 1200, 750, .37)!;
  const start = calculateOrganismCOM(org), initialReserve = org.energy;
  let positiveWorkJ=0, negativeWorkJ=0, energyLimitedImpulses=0, numericalGuardEvents=0, maxAnchorError=0;
  for(let tick=0;tick<300;tick++) {
    stepSimulation(state,settings,1/60);
    assert.ok(org.segments.every(s=>Object.values(s).every(Number.isFinite)));
    const d=org.motorDiagnostics;
    if(d){positiveWorkJ+=d.positiveWorkJ;negativeWorkJ+=d.negativeWorkJ;
      energyLimitedImpulses+=d.energyLimitedImpulses;numericalGuardEvents+=d.numericalGuardEvents;}
    for(let i=1;i<org.segments.length;i++) {
      const def=org.genome.parts[i], parent=org.genome.parts[def.parentIndex];
      const p=org.segments[def.parentIndex], c=org.segments[i];
      const a=getCardinalAnchor(def.attachmentPoint,parent.width,parent.height);
      const b=getChildAnchorForParentDir(def.attachmentPoint,def.width,def.height);
      maxAnchorError=Math.max(maxAnchorError,Math.hypot(
        c.x+Math.cos(c.angle)*b.x-Math.sin(c.angle)*b.y-p.x-Math.cos(p.angle)*a.x+Math.sin(p.angle)*a.y,
        c.y+Math.sin(c.angle)*b.x+Math.cos(c.angle)*b.y-p.y-Math.sin(p.angle)*a.x-Math.cos(p.angle)*a.y));
    }
  }
  const end=calculateOrganismCOM(org),energyErrorJ=totalAccountedEnergy(state)-state.ledger.externalInflow;
  assert.ok(Math.abs(energyErrorJ)<1e-6);
  results.push({id:design.id,physicsRegime,seconds:5,displacementPx:Math.hypot(end.x-start.x,end.y-start.y),
    spentJ:initialReserve-org.energy,motorCostJ:state.ledger.mechanicalWorkHeat,
    positiveWorkJ:physicsRegime==='legacy-v0'?null:positiveWorkJ,
    negativeWorkJ:physicsRegime==='legacy-v0'?null:negativeWorkJ,
    energyLimitedImpulses:physicsRegime==='legacy-v0'?null:energyLimitedImpulses,
    numericalGuardEvents:physicsRegime==='legacy-v0'?null:numericalGuardEvents,maxAnchorError,energyErrorJ});
}
const report={protocol:'foundation-frozen-genomes-v2',seed:711,heading:.37,viscosity:.18,
  notes:['Five seconds, no food, normal reserves, unchanged current genes; no ecological or gait optimization claim.',
    'Anchor error is sampled after complete ticks; all substep constraint/contact energy errors are not bounded by this observation.',
    'Legacy positive/negative work and substep guard events are not instrumented in that regime; null means unmeasured, not zero.'],results};
const output=process.argv[2];if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
