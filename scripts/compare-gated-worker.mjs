/** OFFLINE evaluation and selection. Scores never enter a live ecosystem. */
import assert from 'node:assert/strict';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {startGatedWorker} from './gated-worker-client.mjs';
import {createFounderGenome, FEATURED_BLUEPRINTS} from '../founders.ts';
import {makeGatedGenome,installNewbornGatedHead} from '../experiments/gatedGenome.ts';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, validateGenome} from '../persistence.ts';
import {createInitialWorld, addExternalOrganism, collectWorldStats} from '../world.ts';
import {XoshiroPRNG, clampVal} from '../simulation.ts';
const variants = ['two-output','three-output'].flatMap(architecture => [0,.06].map(hysteresisWidth => ({architecture,hysteresisWidth})));
const conditions = [{seed:17,heading:.37,viscosity:.18},{seed:71,heading:.8,viscosity:.15},{seed:1901,heading:-1.1,viscosity:.22}];
const config = {...DEFAULT_SETTINGS, physicsRegime:'passive-work-v3', motorExperiment:'gated-torque-v1',
  worldWidth:4800,worldHeight:3000,targetNutrients:0,inflowRate:0,mutationSeverity:0,mouthContactModel:'capsule-v1'};
const label = v => v ? `${v.architecture}/${v.hysteresisWidth ? 'hysteresis' : 'hard'}` : 'legacy-six-output';
function source(g, c) {
  const settings = {...config,waterViscosity:c.viscosity};
  const s = createInitialWorld(settings,c.seed,'balanced','standard',0);
  addExternalOrganism(s,g,settings,2400,1500,c.heading);
  return createSnapshot(s,settings);
}
function summary(r) {
  const m=r.metrics, f=m.founders[0];
  const valid = m.finite && m.guards===0 && m.boundaryTicks===0 && m.maxAnchorPx<.5 && m.maxLimitRad<.05
    && m.maxConstraintGainJ<1e-12 && m.maxEnergyErrorJ<1e-5 && f.alive;
  return {...m, valid, displacementPx:f.displacementPx, spentJ:f.reserveSpentJ,
    efficiency:f.displacementPx/Math.max(f.reserveSpentJ,1e-9)};
}
function score(t) {
  if (!t.valid || t.motorJ<1e-6 || t.displacementPx<.1) return 0;
  const seconds=t.ticks/60, lateSeconds=(t.ticks-Math.floor(t.ticks*2/3))/60;
  return Math.min(t.displacementPx/seconds,t.founders[0].lateDisplacementPx/lateSeconds)
    * Math.min(1,t.displacementPx/Math.max(t.pathPx,1e-9))/(1+t.spentJ/1000);
}
function mutation(g, seed) {
  const r=new XoshiroPRNG(seed), child=structuredClone(g);
  const j=r.rangeInt(0,child.parts.length-2), choice=r.rangeInt(0,4);
  if(choice<3) {
    // Same latent Mode/Direct/Strength choice, location and delta in all four.
    // Two-output shares the latter two onto Command; no wasted third-channel draws.
    const count=child.motorController.architecture==='two-output'?2:3;
    const channel=count===2 && choice===2?1:choice, o=j*count+channel;
    const h=r.rangeInt(0,child.hiddenIds.length-1), delta=r.range(-.3,.3);
    if(r.nextFloat()<.25) child.biasesO[o]=clampVal(child.biasesO[o]+delta,-1.5,1.5);
    else child.weightsHO[o][h]=clampVal(child.weightsHO[o][h]+delta,-3.5,3.5);
  } else if(choice===3) child.parts[j+1].cpgPhaseOffset=(child.parts[j+1].cpgPhaseOffset+r.range(-.75,.75)+2*Math.PI)%(2*Math.PI);
  else child.parts[j+1].cpgFreqMult=clampVal(child.parts[j+1].cpgFreqMult*Math.exp(r.range(-.2,.2)),.1,4);
  validateGenome(child); return child;
}
const resumeEcology=process.argv.includes('--ecology-only');
const previous=resumeEcology?JSON.parse(await readFile('docs/experiments/gated-worker-v1.json','utf8')):null;
const w=await startGatedWorker(), rows=previous?.rows??[], searches=previous?.searches??[], ecology=[];
const began=performance.now();
try {
  if(!resumeEcology) for(const d of FEATURED_BLUEPRINTS) for(const c of conditions) {
    const parent=createFounderGenome(d.id);
    for(const v of [null,...variants]) {
      const g=v?makeGatedGenome(parent,v.architecture,v.hysteresisWidth,c.seed):parent;
      const metrics=summary(await w.trial(source(g,c),300));
      rows.push({id:d.id,name:d.name,condition:c,variant:label(v),...metrics});
    }
    console.log(`swims ${d.id} seed ${c.seed}: recorded`);
  }
  // Fixed (1+6) two-generation search; initial parents and 12 mutation choices
  // per cell, three separate body families and three seeds. No starter promotion.
  if(!resumeEcology) for(const id of ['CUR-001','CUR-002','CUR-009']) for(const c of conditions) for(const v of variants) {
    let genome=makeGatedGenome(createFounderGenome(id),v.architecture,v.hysteresisWidth,c.seed);
    let best=summary(await w.trial(source(genome,c),300)); const baseline=best;
    const evaluations=[{generation:0,child:0,score:score(best),metrics:best}];
    for(let gen=0;gen<2;gen++) {
      const ancestor=genome;
      for(let child=0;child<6;child++) {
        const candidate=mutation(ancestor,c.seed+gen*1000+child*41+911);
        const measured=summary(await w.trial(source(candidate,c),300));
        evaluations.push({generation:gen+1,child,score:score(measured),metrics:measured});
        if(score(measured)>score(best)) {best=measured;genome=candidate;}
      }
    }
    // Two held-out headings/viscosities; no selection on these results.
    const holdouts=[];
    for(const h of [{...c,heading:-.6,viscosity:.16},{...c,heading:1.2,viscosity:.21}])
      holdouts.push({condition:h,metrics:summary(await w.trial(source(genome,h),300))});
    searches.push({id,condition:c,variant:label(v),evaluations,best,baseline,holdouts,genomeSHA256:createHash('sha256').update(JSON.stringify(genome)).digest('hex')});
    console.log(`search ${id} seed ${c.seed} ${label(v)}: ${score(baseline).toFixed(3)} -> ${score(best).toFixed(3)}`);
  }
  // Established nine-founder showcase/275-food closed-economy setup, 60s,
  // same two seeds used by the passive-solver release audit. At t=0, only
  // explicit neural head conversion and mode state differ; position/food/PRNG,
  // normal energy, anatomy, inherited sensory/recurrent genes remain identical.
  for(const seed of [17,73]) {
    const settings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',motorExperiment:'gated-torque-v1',
      mouthContactModel:'capsule-v1',ecologyRegime:'closed-v1',nutrientLimit:null};
    const original=createSnapshot(createInitialWorld(settings,seed,'balanced','showcase'),settings);
    for(const v of [null,...variants]) {
      const {state}=restoreSnapshot(original);
      if(v) for(const [i,o] of state.organisms.entries()) {
        installNewbornGatedHead(o,v.architecture,v.hysteresisWidth,seed+i*997);
        state.lineage.get(o.id).genome=o.genome;
      }
      const r=await w.trial(createSnapshot(state,settings),3600);
      const final=restoreSnapshot(r.snapshot).state;
      const intake={};
      for(const o of final.organisms) for(const e of o.recentFeedings??[]) intake[e.foodCategory]=(intake[e.foodCategory]??0)+e.energyTransferred;
      // recentFeedings is capped; label it as retained events, not total intake.
      ecology.push({seed,variant:label(v),metrics:r.metrics,final:collectWorldStats(final,settings.targetNutrients),
        retainedRecentIntakeJ:intake,offspring:final.totalBirths-9});
      console.log(`ecology seed ${seed} ${label(v)}: living ${ecology.at(-1).final.livingCount}, offspring ${final.totalBirths-9}`);
    }
  }
  const report={excludedHarnessRun:previous?.excludedHarnessRun,experiment:'gated-worker-v1',baseHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    assumptions:{physics:'unchanged passive-work-v3',torqueCeiling:'Iavg * 2200 (unmodulated provisional ceiling)',
      strengthMap:'(command+1)/2',modeBoundary:.3,hysteresis:[0,.06],ticks:300,
      initialization:'matched new latent output rows; original sensory/recurrent/body/lifecycle genes frozen',
      search:'offline only, 13 training evaluations + 2 held-out per cell; one latent mutation operation per child',
      limitations:'small search; no architecture promotion, no proven sustained ecology or final muscle/fluid law'},
    rows,searches,ecology,runtimeMs:(previous?.runtimeMs??0)+Math.round(performance.now()-began)};
  const workerAsset=(await readdir('dist/assets')).find(n=>/^simulation\.worker-.*\.js$/.test(n));
  report.builtWorkerSHA256=createHash('sha256').update(await readFile('dist/assets/'+workerAsset)).digest('hex');
  for(const cell of searches) if(cell.genome) {cell.genomeSHA256=createHash('sha256').update(JSON.stringify(cell.genome)).digest('hex');delete cell.genome;}
  await writeFile('docs/experiments/gated-worker-v1.json',JSON.stringify(report,null,2)+'\n');
  console.log(`saved ${rows.length} swims, ${searches.length} search cells, ${ecology.length} ecology cells`);
} finally {await w.close();}
