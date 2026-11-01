import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import BrainGraph from '../BrainGraph';
import * as sim from '../simulation';
import {createFounderGenome, FOUNDER_BLUEPRINTS} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy, validateGenome} from '../persistence';

const settings = {...DEFAULT_SETTINGS, targetNutrients:0, inflowRate:0, mutationSeverity:0, waterViscosity:0};
const dt = 1/60;
function close(a:number,b:number,eps=1e-6){assert.ok(Math.abs(a-b)<eps, `${a} != ${b}`);}

/** An inherited one-neuron, one-joint action pathway with realistic physical
 * oral receipt training. The geometry and available motor output are identical
 * to the inactive-control genotype; reward is produced only by real contact.
 * Motor force is off in this narrow conditioning experiment, so a changed
 * neural Angle command is NOT being advertised as navigation success. */
function policyGenome(rate: number, forgetting=0.1):sim.Genome {
 const g = createFounderGenome('FND-001','unbiased');
 g.plasticityRate=rate; g.forgettingRate=forgetting;
 g.motorForce=0; g.maturityAge=1000;
 g.weightsIH.forEach(row=>row.fill(0));
 g.weightsHH.forEach(row=>row.fill(0));
 g.biasesH.fill(0);g.biasesH[0]=1;
 g.weightsHO.forEach(row=>row.fill(0));
 g.biasesO.fill(0);
 const motor=g.outputKeys!.findIndex(key=>key.endsWith(':Angle'));
 assert.ok(motor>=0);
 g.weightsHO[motor][0]=1;
 assert.deepEqual(validateGenome(g),g);
 return g;
}
function setup(rate:number,food:boolean,forgetting=0.1) {
 const world=createInitialWorld(settings,337,'unbiased','standard',0);
 const g=policyGenome(rate,forgetting);
 const org=addExternalOrganism(world,g,settings,1200,750,0)!;
 if(food) {
   const mouth=g.mouths[0],root=g.parts[mouth.partIndex];
   const anchor=sim.getOrganAnchor(mouth,root.width,root.height);
   world.nutrients.push({id:'reward-food',x:1200+anchor.x,y:750+anchor.y,
      vx:0,vy:0,kind:'nutrient',radius:18,energyValue:3000,bottomTimer:0,pulseTimer:0});
   world.ledger.externalInflow+=3000;
 }
 return {world,org,g};
}
function tick(world:sim.SimulationState,count:number) {
 for(let t=0;t<count;t++) sim.stepSimulation(world,settings,dt);
}
function learnedTotal(org:sim.Organism) {
 return (org.learnedMotorWeights??[]).reduce((sum,v)=>sum+Math.abs(v.delta),0);
}

test('all 55 old founders and their saved genetics keep EXACT original nonplastic semantics',()=>{
 for(const blueprint of FOUNDER_BLUEPRINTS) {
  const g=createFounderGenome(blueprint.id);
  assert.equal(g.plasticityRate,undefined);
  assert.equal(g.forgettingRate,undefined);
  assert.deepEqual(validateGenome(g),g);
  assert.equal(sim.plasticMotorEdges(g).length,0);
 }
 const s=createInitialWorld(settings,77,'balanced','standard',0);
 const g=createFounderGenome('FND-001','balanced');
 const org=addExternalOrganism(s,g,settings,1200,750,0)!;
 const first=createSnapshot(s,settings);
 tick(s,3);
 assert.equal(org.learnedMotorWeights,undefined);
 assert.equal(org.plasticityEnergyRate,undefined);
 assert.deepEqual(org.genome,g);
 close(totalAccountedEnergy(s),s.ledger.externalInflow);
 const resumed=restoreSnapshot(first).state;
 tick(resumed,3);
 assert.deepEqual(createSnapshot(resumed,settings),createSnapshot(s,settings));
});

test('real food absorption, not proximity or mere neural activity, reinforces a somatic motor action and consumes energy',()=>{
 const rewarded=setup(.8,true), unrewarded=setup(.8,false), immutable=structuredClone(rewarded.org.genome);
 const inactive=setup(0,true);
 const physicalBefore=totalAccountedEnergy(rewarded.world);
 tick(rewarded.world,50);
 tick(unrewarded.world,50);
 tick(inactive.world,50);
 const motor=rewarded.org.genome.outputKeys!.findIndex(k=>k.endsWith(':Angle'));
 assert.ok(rewarded.org.recentFeedings!.some(e=>e.foodCategory==='Nutrient'&&e.energyTransferred>0));
 assert.ok(rewarded.org.learnedMotorWeights!.length>0);
 assert.ok(rewarded.org.plasticityEnergyRate!>0);
 assert.ok(learnedTotal(rewarded.org)>.05,'physical absorbed food strengthens active somatic motor synapses');
 assert.equal(learnedTotal(unrewarded.org),0,'without real mouth intake no weights can be reinforced');
 assert.equal(learnedTotal(inactive.org),0,'plasticity rate 0 cannot alter phenotype');
 assert.ok(rewarded.org.neuralOutputs[motor]>unrewarded.org.neuralOutputs[motor]+.03,
   'the same internal stimulus produces a measurably stronger rewarded Angle command in the same lifetime');
 close(unrewarded.org.neuralOutputs[motor], inactive.org.neuralOutputs[motor],1e-12);
 const inspector=renderToStaticMarkup(React.createElement(BrainGraph,
   {organism:rewarded.org,threshold:.01}));
 assert.match(inspector,/Lifetime learning/);
 assert.match(inspector,/acquired/);
 assert.match(inspector,/energy cost/);
 assert.deepEqual(rewarded.org.genome,immutable,'acquired changes never rewrite heritable genome weights');
 assert.equal(rewarded.org.genome.weightsHO[motor][0],1);
 assert.ok(Math.abs(rewarded.org.neuralOutputs[motor])<=1);
 close(totalAccountedEnergy(rewarded.world),physicalBefore);
 close(totalAccountedEnergy(unrewarded.world),unrewarded.world.ledger.externalInflow);
 close(totalAccountedEnergy(inactive.world),inactive.world.ledger.externalInflow);
 console.log('VIDA_PHASE5_OPERANT '+JSON.stringify({rewardedAngle:rewarded.org.neuralOutputs[motor],
    controlAngle:unrewarded.org.neuralOutputs[motor],
    somaticWeightDeltaMagnitude:learnedTotal(rewarded.org),
    learnedSynapses:rewarded.org.learnedMotorWeights!.length,
    physicalFoodAbsorbed:rewarded.org.recentFeedings!.reduce((sum,e)=>sum+e.energyTransferred,0)}));
});

test('somatic forgetting proceeds without reward, and learned offsets cannot pass through reproduction',()=>{
 const s=setup(.8,true,1.0);
 tick(s.world,45);
 const trained=learnedTotal(s.org);
 assert.ok(trained>.05);
 const child=sim.mutateGenome(s.org.genome,0,new sim.XoshiroPRNG(102));
 assert.equal(child.plasticityRate,.8);
 assert.equal(child.forgettingRate,1);
 assert.deepEqual(child.weightsHO,s.g.weightsHO);
 const baby=sim.spawnOrganism(child,1800,750,0,undefined,undefined,new sim.XoshiroPRNG(33));
 assert.equal(baby.learnedMotorWeights,undefined,'inherited capacity is not inherited acquired experience');
 assert.ok(sim.plasticMotorEdges(child).length>0);
 // Remove remaining finite food and conservatively account for this test
 // intervention. No new food or positive reward exists for the next 3 s.
 const remaining=s.world.nutrients.reduce((sum,n)=>sum+n.energyValue,0);
 s.world.ledger.recordedLosses+=remaining;
 s.world.nutrients=[];
 tick(s.world,180);
 assert.ok(learnedTotal(s.org)<trained*.15,'old experience fades at genetically controlled rate');
 assert.deepEqual(s.org.genome,s.g);
 close(totalAccountedEnergy(s.world),s.world.ledger.externalInflow);
});

test('plastic state is strictly saved and resumes bit-exact across subsequent physical feeding and forgetting',()=>{
 const a=setup(.7,true,.8);
 tick(a.world,14);
 assert.ok(learnedTotal(a.org)>0);
 const snap=createSnapshot(a.world,settings);
 assert.equal(snap.schemaVersion,'16.0.0');
 const b=restoreSnapshot(snap);
 assert.deepEqual(createSnapshot(b.state,b.settings),snap);
 for(let t=0;t<15;t++) {
  sim.stepSimulation(a.world,settings,dt);
  sim.stepSimulation(b.state,settings,dt);
 }
 assert.deepEqual(createSnapshot(b.state,settings),createSnapshot(a.world,settings));
 close(totalAccountedEnergy(a.world),a.world.ledger.externalInflow);
});

test('plasticity is rare but reachable by ordinary asexual mutation and validates inherited boundaries',()=>{
 const parent=createFounderGenome('FND-001','unbiased');
 let success:sim.Genome|undefined;
 for(let seed=1;seed<=120;seed++){
  const child=sim.mutateGenome(parent,1,new sim.XoshiroPRNG(seed));
  if((child.plasticityRate??0)>0){success=child;break;}
 }
 assert.ok(success,'mutated offspring should be able to evolve waking learning');
 assert.ok(success.plasticityRate!>0 && success.plasticityRate!<=.8);
 assert.deepEqual(validateGenome(success),success);
 assert.equal(parent.plasticityRate,undefined);
 const malformed=[(g:sim.Genome)=>{g.plasticityRate=-.01},
  (g:sim.Genome)=>{g.plasticityRate=.9},
  (g:sim.Genome)=>{g.forgettingRate=Number.NaN},
  (g:sim.Genome)=>{g.forgettingRate=1.5}];
 for(const edit of malformed){const g=structuredClone(parent);edit(g);assert.throws(()=>validateGenome(g),/Invalid snapshot/)}
});

test('malicious acquired weights are rejected on load: identity, bounds, disabled connection, duplicate entries, inactive gene',()=>{
 const setupState=setup(.8,true);
 tick(setupState.world,4);
 const first=createSnapshot(setupState.world,settings);
 const current=first.state.organisms[0].learnedMotorWeights;
 assert.ok(current && current.length>0);
 const reject=(mut:(s:typeof first)=>void)=>{
  const bad=structuredClone(first);
  mut(bad);
  assert.throws(()=>restoreSnapshot(bad),/Invalid snapshot/);
 };
 reject(s=>{s.state.organisms[0].learnedMotorWeights![0].delta=2;});
 reject(s=>{s.state.organisms[0].learnedMotorWeights![0].eligibility=Infinity;});
 reject(s=>{s.state.organisms[0].learnedMotorWeights![0].edge='["ho","joint:fake:Angle","hidden:0"]';});
 reject(s=>{s.state.organisms[0].learnedMotorWeights!.push(structuredClone(current[0]));});
 reject(s=>{
  const rec=s.state.organisms[0].learnedMotorWeights![0];
  s.state.organisms[0].genome.disabledConnections!.push(rec.edge);
 });
 reject(s=>{s.state.organisms[0].genome.plasticityRate=0;});
});

test('learned plasticity charges finite upkeep and rewrite energy even without external feeding',()=>{
 const {world,org}=setup(.8,false);
 const before=totalAccountedEnergy(world);
 // An inactive, quiet network still spends maintenance for plastic potential,
 // even if there was no food feedback and no synapse could be reinforced.
 const heat=world.ledger.metabolicDissipation;
 const reserve=org.energy;
 const cost=sim.applyWakingPlasticity(org,dt,world.ledger);
 close(cost,sim.plasticMotorEdges(org.genome).length*sim.PLASTIC_UPKEEP_J_PER_EDGE_SECOND*dt,1e-10);
 close(reserve-org.energy,cost,1e-10);
 close(world.ledger.metabolicDissipation-heat,cost,1e-10);
 assert.equal(learnedTotal(org),0);
 close(totalAccountedEnergy(world),before);
 // No imaginary energy line of credit: underfunded creatures can do no
 // more rewriting than their remaining usable energy can actually pay for.
 org.energy=.00001;
 world.ledger.recordedLosses+=reserve-cost-org.energy;
 const low=sim.applyWakingPlasticity(org,dt,world.ledger);
 assert.ok(low<=.00001 && low>0);
 close(org.energy,0,1e-8);
 assert.equal(learnedTotal(org),0);
 close(totalAccountedEnergy(world),before);
});

test('evolved whole-body scope updates non-Angle motor commands through real feeding, with conserved costs and exact saves', () => {
 const settingsAll={...settings,waterViscosity:.18};
 const make=(scope:'all'|'angle')=>{
   const state=createInitialWorld(settingsAll,713,'unbiased','standard',0);
   const g=policyGenome(.8);
   g.plasticMotorScope=scope;
   g.motorForce=3; // Actual articulated stroke mechanics remain enabled
   const engage=g.outputKeys!.findIndex(k=>k.endsWith(':Engage'));
   const drive=g.outputKeys!.findIndex(k=>k.endsWith(':Drive'));
   assert.ok(engage>=0 && drive>=0);
   g.weightsHO[engage][0]=.4;
   g.weightsHO[drive][0]=.4;
   const org=addExternalOrganism(state,g,settingsAll,1200,750,0)!;
   const anchor=sim.getOrganAnchor(g.mouths[0],g.parts[0].width,g.parts[0].height);
   state.nutrients.push({id:'earned-food',x:1200+anchor.x,y:750,vx:0,vy:0,
      energyValue:3000,radius:18,kind:'nutrient',bottomTimer:0,pulseTimer:0});
   state.ledger.externalInflow+=3000;
   return {state,org,engage,drive};
 };
 const all=make('all'), angles=make('angle');
 assert.ok(sim.plasticMotorEdges(all.org.genome).some(e=>e.output===all.drive));
 assert.ok(sim.plasticMotorEdges(all.org.genome).some(e=>e.output===all.engage));
 assert.ok(sim.plasticMotorEdges(all.org.genome).length<=sim.MAX_PLASTIC_MOTOR_SYNAPSES);
 assert.ok(sim.plasticMotorEdges(all.org.genome).some(e=>e.output===all.org.genome.outputKeys!.length-1),
   'all-output selection must sample last physical joint, not just the first');
 assert.ok(!sim.plasticMotorEdges(angles.org.genome).some(e=>e.output===angles.engage));
 const startAngle=all.org.joints[0].currentRelAngle;
 for(let i=0;i<35;i++){
   sim.stepSimulation(all.state,settingsAll,dt);
   sim.stepSimulation(angles.state,settingsAll,dt);
 }
 assert.ok(all.org.recentFeedings?.some(e=>e.energyTransferred>0),'reward must be genuine physical food contact');
 const extraEngage=all.org.learnedMotorWeights!.filter(e=>e.edge.includes(':Engage')&&Math.abs(e.delta)>1e-9);
 const extraDrive=all.org.learnedMotorWeights!.filter(e=>e.edge.includes(':Drive')&&Math.abs(e.delta)>1e-9);
 assert.ok(extraEngage.length>0 && extraDrive.length>0,'all-output ability must change multiple live motor channels');
 assert.ok(Math.abs(all.org.neuralOutputs[all.engage]-angles.org.neuralOutputs[angles.engage])>1e-5);
 assert.ok(Math.abs(all.org.joints[0].currentRelAngle-startAngle)>1e-7,'real hinged anatomy must still articulate');
 assert.ok(Math.abs(all.org.joints[0].appliedTorque)>0);
 for(const row of [all,angles]) assert.ok(Math.abs(totalAccountedEnergy(row.state)-row.state.ledger.externalInflow)<1e-4);
 const snapshot=createSnapshot(all.state,settingsAll), restored=restoreSnapshot(snapshot);
 assert.deepEqual(createSnapshot(restored.state,restored.settings),snapshot);
 sim.stepSimulation(all.state,settingsAll,dt);
 sim.stepSimulation(restored.state,settingsAll,dt);
 assert.deepEqual(createSnapshot(restored.state,settingsAll),createSnapshot(all.state,settingsAll));
 assert.equal(all.org.genome.weightsHO[all.engage][0],.4,'somatic learning never rewrites DNA');
});

test('actual bites can teach negative valence without a scripted escape rule or fake injury', () => {
 const attackSettings={...settings,kinshipProtection:false};
 const make=(aversion:number,attackerMouth:'carnivore'|'herbivore')=>{
   const state=createInitialWorld(attackSettings,927,'unbiased','standard',0);
   const g=policyGenome(.8);
   g.injuryAversionRate=aversion;
   const prey=addExternalOrganism(state,g,attackSettings,1200,750,0)!;
   const rear=Math.min(...prey.segments.map((seg,i)=>seg.x-g.parts[i].width/2));
   const hunterG=sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(21));
   hunterG.parts=[hunterG.parts[0]];
   hunterG.eyes=[];
   hunterG.motorForce=0;
   hunterG.mouths=[{id:'bite-mouth',partIndex:0,direction:'EAST',intakeWidth:30,mouthType:attackerMouth}];
   hunterG.bodyCost=sim.calculateBodyCost(hunterG.parts,hunterG.eyes,hunterG.mouths);
   hunterG.maxEnergyCapacity=sim.calculateMaxEnergyCapacity(hunterG.parts,hunterG.storageTraitMultiplier);
   sim.remapBrain(hunterG);
   const hunterX=rear-hunterG.parts[0].width/2+6;
   addExternalOrganism(state,hunterG,attackSettings,hunterX,750,0)!;
   return {state,prey};
 };
 const injured=make(1,'carnivore'), neutral=make(0,'carnivore'), harmless=make(1,'herbivore');
 for(let i=0;i<20;i++)for(const x of [injured,neutral,harmless])
   sim.stepSimulation(x.state,attackSettings,dt);
 const motor=injured.prey.genome.outputKeys!.findIndex(x=>x.endsWith(':Angle'));
 const physicalPain=injured.prey.neuralInputs[injured.prey.genome.inputKeys!.indexOf('body:injury')];
 assert.ok(physicalPain>0,'only physical bites teach aversion');
 assert.equal(harmless.prey.neuralInputs[harmless.prey.genome.inputKeys!.indexOf('body:injury')],0);
 assert.equal(learnedTotal(neutral.prey),0);
 assert.equal(learnedTotal(harmless.prey),0);
 assert.ok(learnedTotal(injured.prey)>0);
 assert.ok(injured.prey.neuralOutputs[motor]<neutral.prey.neuralOutputs[motor],
   'negative reinforcement must reduce an implicated motor activation');
 for(const row of [injured,neutral,harmless])
   assert.ok(Math.abs(totalAccountedEnergy(row.state)-row.state.ledger.externalInflow)<1e-4);
 const son=sim.mutateGenome(injured.prey.genome,0,new sim.XoshiroPRNG(9));
 assert.equal(son.injuryAversionRate,1);
 assert.equal(son.plasticityRate,.8);
 assert.equal(sim.spawnOrganism(son,1800,750,0).learnedMotorWeights,undefined);
});

test('extended heritable traits have strict validation and preserve legacy angle-only saves',()=>{
 const gene=policyGenome(.8);
 const s=createInitialWorld(settings,81,'unbiased','standard',0);
 const org=addExternalOrganism(s,gene,settings,1200,750,0)!;
 sim.stepSimulation(s,settings,dt);
 const saved=createSnapshot(s,settings);
 assert.deepEqual(createSnapshot(restoreSnapshot(saved).state,settings),saved);
 for(const edit of [
  (g:sim.Genome)=>{g.plasticMotorScope='sideways' as 'all'},
  (g:sim.Genome)=>{g.injuryAversionRate=Number.NaN},
  (g:sim.Genome)=>{g.injuryAversionRate=-0.1},
  (g:sim.Genome)=>{g.injuryAversionRate=1.1}
 ]) {
   const mutant=structuredClone(gene);edit(mutant);
   assert.throws(()=>validateGenome(mutant),/Invalid snapshot/);
 }
 assert.ok(org.learnedMotorWeights?.every(x=>JSON.parse(x.edge)[1].endsWith(':Angle')));
});
