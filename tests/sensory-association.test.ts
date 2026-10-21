import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import BrainGraph from '../BrainGraph';
import * as sim from '../simulation';
import {createFounderGenome, FOUNDER_BLUEPRINTS} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy, validateGenome} from '../persistence';

const settings={...DEFAULT_SETTINGS,targetNutrients:0,inflowRate:0,mutationSeverity:0};
const dt=1/60;
const conserved=(state:sim.SimulationState)=>assert.ok(
  Math.abs(totalAccountedEnergy(state)-state.ledger.externalInflow)<1e-4,
  'learning must neither generate nor erase chemical energy');

function episode(sensoryRate:number,food=true) {
  const state=createInitialWorld(settings,821,'unbiased','standard',0);
  const g=createFounderGenome('FND-001','balanced');
  g.sensoryPlasticityRate=sensoryRate;
  g.forgettingRate=.08;
  g.motorForce=0; // Restrict only this lab exposure, not the production learning rule.
  g.maturityAge=1000;
  const org=addExternalOrganism(state,g,settings,1200,750,0)!;
  if(food){
    const mouth=g.mouths[0],root=g.parts[mouth.partIndex];
    const anchor=sim.getOrganAnchor(mouth,root.width,root.height);
    state.nutrients.push({id:'real-finite-meal',x:1200+anchor.x,y:750+anchor.y,
      vx:0,vy:0,kind:'nutrient',radius:18,energyValue:3000,bottomTimer:0,pulseTimer:0});
    state.ledger.externalInflow+=3000;
  }
  return {state,org};
}
const step=(s:sim.SimulationState,count:number)=>{
  for(let i=0;i<count;i++)sim.stepSimulation(s,settings,dt);
};
const learnedSize=(org:sim.Organism)=>(org.learnedSensoryWeights??[]).reduce(
  (sum,s)=>sum+Math.abs(s.delta),0);

test('real compatible mouth food writes a bounded retinal association that modifies the same brain on later sight',()=>{
  const actual=episode(.8,true), unfed=episode(.8,false), legacy=episode(0,true);
  const genes=structuredClone(actual.org.genome);
  step(actual.state,30); step(unfed.state,30);step(legacy.state,30);
  const absorbed=(actual.org.recentFeedings??[]).reduce((sum,e)=>sum+e.energyTransferred,0);
  assert.ok(absorbed>0,'reward must come from real contact and removal of finite nutrient energy');
  assert.ok(actual.org.neuralInputs.some((x,i)=>
    actual.org.genome.inputKeys![i].startsWith('eye:') && x>.01 && x<1),
  'physical RGB stimulus must reach neural channels');
  assert.ok(learnedSize(actual.org)>1e-5,'food-conditioned sensory associations must form');
  assert.equal(learnedSize(unfed.org),0,'no intake means no learned weight rewrite');
  assert.ok(Math.abs((unfed.org.plasticityEnergyRate ?? 0)
    - sim.plasticSensoryEdges(unfed.org.genome).length * sim.PLASTIC_UPKEEP_J_PER_EDGE_SECOND) < 1e-8,
    'sensory-only learning expense meter must describe this tick, not the cumulative run');
  assert.equal(legacy.org.learnedSensoryWeights,undefined,'zero gene is fully inactive');
  assert.deepEqual(actual.org.genome,genes,'experience must not modify any inherited synapse');
  assert.ok(actual.org.learnedSensoryWeights!.length<=sim.MAX_PLASTIC_SENSORY_SYNAPSES);
  assert.ok(actual.org.learnedSensoryWeights!.every(s=>JSON.parse(s.edge)[0]==='ih'));
  const stateBefore=createSnapshot(actual.state,settings);
  const withoutMemory=restoreSnapshot(stateBefore).state;
  const unloaded=withoutMemory.organisms[0];
  unloaded.learnedSensoryWeights=unloaded.learnedSensoryWeights!.map(s=>({...s,delta:0}));
  sim.stepSimulation(actual.state,settings,dt);
  sim.stepSimulation(withoutMemory,settings,dt);
  const hiddenDifference=Math.max(...actual.org.neuralHidden.map((h,i)=>Math.abs(h-unloaded.neuralHidden[i])));
  assert.ok(hiddenDifference>1e-7,'retained sensory association must change a later hidden-neuron response');
  assert.ok(actual.org.neuralOutputs.some((o,i)=>Math.abs(o-unloaded.neuralOutputs[i])>1e-8),
    'sensory association must propagate into a motor command, not only a telemetry counter');
  for(const x of [actual,unfed,legacy])conserved(x.state);
  conserved(withoutMemory);
  const diagram=renderToStaticMarkup(React.createElement(BrainGraph,{organism:actual.org,threshold:.002}));
  assert.match(diagram,/adapted retinal synapses/);
  console.log('VIDA_PHASE5_RETINAL_ASSOCIATION '+JSON.stringify({
    realFoodAbsorbedJ:absorbed,retinalChangeMagnitude:learnedSize(actual.org),
    laterHiddenResponseDifference:hiddenDifference,
    retainedRetinalEdges:actual.org.learnedSensoryWeights!.length}));
});

test('learned retinal associations retain exact save continuation, decay and do not enter offspring DNA',()=>{
  const {state,org}=episode(.8,true);
  step(state,28);
  assert.ok(learnedSize(org)>1e-5);
  const snapshot=createSnapshot(state,settings);
  assert.equal(snapshot.schemaVersion,'12.0.0');
  const clone=restoreSnapshot(snapshot);
  assert.deepEqual(createSnapshot(clone.state,settings),snapshot);
  step(state,4);step(clone.state,4);
  assert.deepEqual(createSnapshot(clone.state,settings),createSnapshot(state,settings));
  const child=sim.mutateGenome(org.genome,0,new sim.XoshiroPRNG(94));
  assert.equal(child.sensoryPlasticityRate,.8);
  const newborn=sim.spawnOrganism(child,1800,750,0,undefined,undefined,new sim.XoshiroPRNG(31));
  assert.equal(newborn.learnedSensoryWeights,undefined);
  const remembered=learnedSize(org);
  const remaining=state.nutrients.reduce((sum,n)=>sum+n.energyValue,0);
  state.ledger.recordedLosses+=remaining;
  state.nutrients=[];
  step(state,120);
  assert.ok(learnedSize(org)<remembered,'learned association fades without reinforcement');
  conserved(state);conserved(clone.state);
});

test('old founders and saved minds remain unchanged; new trait evolves and malformed somatic inputs are rejected',()=>{
  for(const blueprint of FOUNDER_BLUEPRINTS){
    const g=createFounderGenome(blueprint.id);
    assert.equal(g.sensoryPlasticityRate,undefined);
    assert.equal(sim.plasticSensoryEdges(g).length,0);
  }
  const base=episode(0,false);
  const before=createSnapshot(base.state,settings);
  step(base.state,2);
  assert.equal(base.org.learnedSensoryWeights,undefined);
  const replay=restoreSnapshot(before);
  step(replay.state,2);
  assert.deepEqual(createSnapshot(replay.state,settings),createSnapshot(base.state,settings));
  const parent=createFounderGenome('FND-001','unbiased');
  let found=false;
  for(let i=1;i<=180;i++){
    const child=sim.mutateGenome(parent,1,new sim.XoshiroPRNG(i));
    if((child.sensoryPlasticityRate??0)>0){
      assert.deepEqual(validateGenome(child),child);
      found=true;break;
    }
  }
  assert.ok(found,'ordinary offspring mutation must reach the new heritable capacity');
  assert.equal(parent.sensoryPlasticityRate,undefined);
  for(const badValue of [-.1,.81,Infinity,NaN]){
    const invalid=structuredClone(parent);invalid.sensoryPlasticityRate=badValue;
    assert.throws(()=>validateGenome(invalid),/Invalid snapshot/);
  }
  const trained=episode(.8,true);
  step(trained.state,9);
  assert.ok(trained.org.learnedSensoryWeights?.length);
  const snapshot=createSnapshot(trained.state,settings);
  const rejects=(fn:(v:typeof snapshot)=>void)=>{
    const bad=structuredClone(snapshot);fn(bad);
    assert.throws(()=>restoreSnapshot(bad),/Invalid snapshot/);
  };
  rejects(s=>{s.state.organisms[0].learnedSensoryWeights![0].delta=2;});
  rejects(s=>{s.state.organisms[0].learnedSensoryWeights![0].eligibility=1.3;});
  rejects(s=>{s.state.organisms[0].learnedSensoryWeights![0].edge='["ih","hidden:0","body:energy"]';});
  rejects(s=>{s.state.organisms[0].learnedSensoryWeights!.push(
    structuredClone(s.state.organisms[0].learnedSensoryWeights![0]));});
  rejects(s=>{s.state.organisms[0].genome.sensoryPlasticityRate=0;});
  rejects(s=>{const edge=s.state.organisms[0].learnedSensoryWeights![0].edge;
    s.state.organisms[0].genome.disabledConnections!.push(edge);});
  conserved(trained.state);conserved(base.state);
});
