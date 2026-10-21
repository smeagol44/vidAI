import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {LEGACY_SETTINGS, totalAccountedEnergy, createSnapshot, restoreSnapshot, validateGenome} from '../persistence';

type Strategy = 'neutral' | 'ampUp' | 'ampDown' | 'driveUp' | 'driveDown' | 'torqueUp' | 'angleUp' | 'angleDown' | 'engageDown';
const settings = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0, kinshipProtection: false};
const dt = 1 / 60;
function run(strategy: Strategy, angle: number, gap: number, duration = 2.5, variant?: sim.Genome) {
  const state = createInitialWorld(settings, 732, 'unbiased', 'standard', 0);
  const genome = variant ? structuredClone(variant) : createFounderGenome('FND-001', 'unbiased');
  genome.maturityAge = 1000;
  const hidden = 23;
  if (!variant) {
    genome.weightsIH[hidden].fill(0);
    genome.weightsHH[hidden].fill(0);
    genome.biasesH[hidden] = 0;
    genome.weightsHO.forEach(row => row[hidden] = 0);
  }
  const injury = genome.inputKeys!.indexOf('body:injury');
  assert.ok(injury >= 0);
  const outputs: Record<Exclude<Strategy,'neutral'>,[string,number]> = {
    ampUp: ['Amp', 3], ampDown: ['Amp', -3],
    driveUp: ['Drive', 3], driveDown: ['Drive', -3],
    torqueUp: ['Torque', 3], angleUp: ['Angle', 3], angleDown: ['Angle', -3],
    engageDown: ['Engage', -3]
  };
  if (!variant && strategy !== 'neutral') {
    genome.weightsIH[hidden][injury] = 3;
    const [channel, gain] = outputs[strategy];
    for (let i=1;i<genome.parts.length;i++) {
      const oi = genome.outputKeys!.indexOf(`joint:${genome.parts[i].id}:${channel}`);
      if (oi>=0) genome.weightsHO[oi][hidden] = gain;
    }
  }
  const victim = addExternalOrganism(state, genome, settings, 1200, 750, 0)!;
  const hunterG = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(21));
  hunterG.parts = [hunterG.parts[0]];hunterG.eyes=[];
  hunterG.mouths = [{id:'bite',partIndex:0,direction:'EAST',intakeWidth:12,mouthType:'omnivore'}];
  hunterG.motorForce = 0; hunterG.maturityAge=1000;
  hunterG.bodyCost=sim.calculateBodyCost(hunterG.parts,hunterG.eyes,hunterG.mouths);
  hunterG.maxEnergyCapacity=sim.calculateMaxEnergyCapacity(hunterG.parts,hunterG.storageTraitMultiplier);
  sim.remapBrain(hunterG);
  const tail = victim.segments[victim.segments.length - 1];
  const x=tail.x - Math.cos(angle)*(hunterG.parts[0].width/2+gap);
  const y=tail.y - Math.sin(angle)*(hunterG.parts[0].width/2+gap);
  const hunter=addExternalOrganism(state,hunterG,settings,x,y,angle)!;
  const start=sim.calculateOrganismCOM(victim);
  const total=totalAccountedEnergy(state);
  let bites=0, ticksBitten=0, maxSignal=0, changedMotor=false;
  for(let i=0;i<Math.round(duration/dt);i++) {
    sim.stepSimulation(state,settings,dt);
    const j=victim.biteFeedbackJ??0;
    bites+=j;if(j>0)ticksBitten++;
    maxSignal=Math.max(maxSignal,victim.neuralInputs[injury]??0);
    if(strategy!=='neutral') {
      const [channel]=outputs[strategy];
      const idx=victim.genome.outputKeys!.indexOf(`joint:${genome.parts[1].id}:${channel}`);
      if(Math.abs((victim.neuralOutputs[idx]??0)) > .1 && maxSignal>0)changedMotor=true;
    }
  }
  const end=sim.calculateOrganismCOM(victim);
  assert.ok(Math.abs(totalAccountedEnergy(state)-total) < 1e-4, 'energy conservation');
  return {strategy,angle,gap,bites:+bites.toFixed(1),ticksBitten,maxSignal:+maxSignal.toFixed(3),
    deltaX:+(end.x-start.x).toFixed(1),deltaY:+(end.y-start.y).toFixed(1),
    separation:+Math.hypot(end.x-hunter.segments[0].x,end.y-hunter.segments[0].y).toFixed(1),
    changedMotor,alive:!victim.dissolving};
}
test('physical rear-mouth predation responds to inherited motor gains, including harmful mutations', () => {
  const comparisons = [];
  for (const gap of [8,9,10,11,12,14,16]) {
    const base = run('neutral', 0, gap), faster = run('ampUp', 0, gap);
    const slower = run('ampDown', 0, gap);
    assert.ok(base.bites >= 400, 'the predator must actually bite before testing escape');
    assert.ok(faster.bites < base.bites, 'increased rhythmic stroke reduces real predation in these geometries');
    assert.ok(faster.separation > base.separation, 'lower damage corresponds to more physical separation');
    assert.ok(slower.bites > base.bites, 'the opposite genetic response can be harmful');
    assert.ok(faster.maxSignal > 0 && slower.maxSignal > 0);
    comparisons.push({gap,base:base.bites,lessDamage:faster.bites,moreDamage:slower.bites});
  }
  console.log('PHASE5C_PHYSICAL_ESCAPE '+JSON.stringify(comparisons));
});

test('inherited somatic motor circuit innovations are bounded, isolated, mutable and sign-neutral', () => {
  const parent = createFounderGenome('FND-001', 'unbiased');
  const before = structuredClone(parent);
  const samples = [];
  for (let seed = 1; seed <= 200; seed++) {
    const g = structuredClone(parent);
    assert.ok(sim.mutateBrainTopology(g, 'wire-injury-motor', new sim.XoshiroPRNG(seed)));
    const h = g.hiddenIds!.length - 1, key = g.hiddenIds![h];
    const injury = g.inputKeys!.indexOf('body:injury');
    const selected = g.outputKeys!.map((output,i) => ({
      output, weight:g.weightsHO[i][h],
      enabled:!g.disabledConnections!.includes(sim.brainEdgeKey('ho',output,key))
    })).filter(x => x.enabled);
    const sensoryKey=sim.brainEdgeKey('ih',key,'body:injury');
    assert.ok(!g.disabledConnections!.includes(sensoryKey));
    assert.ok(g.weightsIH[h].every((w,i)=>i===injury || w===0));
    assert.equal(selected.length, g.parts.length-1);
    assert.ok(selected.every(x=>x.output.endsWith(selected[0].output.split(':').at(-1)!)));
    assert.ok(g.weightsIH[h][injury] !== 0 && selected.every(x=>x.weight !== 0));
    assert.ok(g.weightsHH[h].every(w=>w===0));
    assert.equal(g.biasesH[h],0);
    assert.deepEqual(validateGenome(g),g);
    samples.push({seed,channel:selected[0].output.split(':').at(-1),
      direction: Math.sign(selected[0].weight*g.weightsIH[h][injury]),
      strength: Math.abs(selected[0].weight*g.weightsIH[h][injury])});
  }
  assert.deepEqual(parent,before,'topology mutation must never modify its source genome');
  assert.ok(new Set(samples.map(x=>x.channel)).size === 6,'all six existing joint channels remain possible');
  assert.ok(samples.some(x=>x.direction>0)&&samples.some(x=>x.direction<0),
    'mutations must allow both protective and harmful motor responses');
  const candidate=samples.find(x=>x.channel==='Amp'&&x.direction>0&&x.strength>3);
  assert.ok(candidate, 'deterministic search yields a heritable amplitude response candidate');
  const seed=candidate!.seed;
  const actual=structuredClone(parent);
  const comparison=structuredClone(parent);
  sim.mutateBrainTopology(actual,'wire-injury-motor',new sim.XoshiroPRNG(seed));
  sim.mutateBrainTopology(comparison,'wire-injury-motor',new sim.XoshiroPRNG(seed));
  const h=actual.hiddenIds!.length-1, injury=actual.inputKeys!.indexOf('body:injury');
  comparison.weightsIH[h][injury]=0; // same genome, neuron, and upkeep; no sensory coupling.
  const scored = [];
  for (const gap of [8,10,16]) {
    const seen=run('neutral',0,gap,2.5,actual);
    const disconnected=run('neutral',0,gap,2.5,comparison);
    assert.ok(disconnected.bites > 0, 'hunter must physically bite both variants');
    assert.ok(seen.bites > 0 && seen.bites < disconnected.bites,
      'one genetically generated sensorimotor innovation genuinely reduces subsequent bites');
    assert.ok(seen.separation > disconnected.separation,
      'the benefit must include actual physical separation from the hunter');
    assert.equal(seen.alive, true);
    scored.push({gap,seen:seen.bites,disconnected:disconnected.bites,
      extraSeparation:+(seen.separation-disconnected.separation).toFixed(1)});
  }
  console.log('PHASE5C_GENETIC_INNOVATION '+JSON.stringify({candidate,scored}));
});

test('inherited injury circuit persists and resumes deterministically with unchanged founders', () => {
  const s=createInitialWorld(settings,700,'unbiased','standard',0);
  const founder=createFounderGenome('FND-001','unbiased');
  const g=structuredClone(founder);
  assert.ok(sim.mutateBrainTopology(g,'wire-injury-motor',new sim.XoshiroPRNG(17)));
  assert.deepEqual(createFounderGenome('FND-001','unbiased'),founder);
  const o=addExternalOrganism(s,g,settings,1200,750,0)!;
  o.biteFeedbackJ=25; // queued state used for persistence check, not an ecological escape claim.
  const before=totalAccountedEnergy(s);
  const snap=createSnapshot(s,settings),restored=restoreSnapshot(snap);
  assert.deepEqual(createSnapshot(restored.state,settings),snap);
  for(let i=0;i<8;i++){sim.stepSimulation(s,settings,dt);sim.stepSimulation(restored.state,settings,dt);}
  assert.deepEqual(createSnapshot(restored.state,settings),createSnapshot(s,settings));
  assert.ok(Math.abs(totalAccountedEnergy(s)-before)<1e-5);
});

test('ordinary genome reproduction can generate a new somatic-to-motor circuit through stochastic mutation', () => {
  const parent=createFounderGenome('FND-001','unbiased'), original=structuredClone(parent);
  let evolved: sim.Genome | undefined, seed=0;
  for (let candidate=1;candidate<=350;candidate++) {
    const child=sim.mutateGenome(parent,1,new sim.XoshiroPRNG(candidate));
    const injuryIndex=child.inputKeys!.indexOf('body:injury');
    const added=child.hiddenIds!.filter(id=>!parent.hiddenIds!.includes(id));
    const wired=added.some(id=>{
      const h=child.hiddenIds!.indexOf(id);
      const ih=sim.brainEdgeKey('ih',id,'body:injury');
      return !child.disabledConnections!.includes(ih)
        && child.weightsIH[h][injuryIndex]!==0
        && child.outputKeys!.some((output,o)=>
          !child.disabledConnections!.includes(sim.brainEdgeKey('ho',output,id))
          && child.weightsHO[o][h]!==0);
    });
    if(wired){evolved=child;seed=candidate;break;}
  }
  assert.ok(evolved, 'a real offspring mutation can create the complete inherited sensor-to-motor innovation');
  assert.deepEqual(parent,original,'offspring mutations never edit the parent');
  assert.deepEqual(sim.mutateGenome(parent,1,new sim.XoshiroPRNG(seed)),evolved,
    'new genetic mutations stay deterministic for a fixed seed');
  assert.deepEqual(validateGenome(evolved),evolved);
});
