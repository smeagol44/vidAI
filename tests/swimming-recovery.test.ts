import assert from 'node:assert/strict';
import {test} from 'node:test';
import {legacyMouthState} from './support/legacy-mouth-state';
import {createHash} from 'node:crypto';
import {createFounderGenome,FEATURED_BLUEPRINTS} from '../founders';
import {DEFAULT_SETTINGS,createSnapshot,restoreSnapshot,totalAccountedEnergy} from '../persistence';
import {createInitialWorld,addExternalOrganism} from '../world';
import {stepSimulation,calculateOrganismCOM} from '../simulation';
import {paidMotorBatch,MECHANICAL_JOULES,MUSCLE_EFFICIENCY,type PhysicsRegime} from '../foundationPhysics';
import {SimulationHost} from '../simulationHost';
import {runTwinOarApproach} from '../foragingAudit';
import {runControlledGrazing} from '../ecologyBaseline';
const dt=1/60;
function world(id:string,physicsRegime:PhysicsRegime){
  const config={...DEFAULT_SETTINGS,physicsRegime,targetNutrients:0,inflowRate:0,mutationSeverity:0};
  const state=createInitialWorld(config,711,'balanced','standard',0);
  const org=addExternalOrganism(state,createFounderGenome(id),config,1200,750,.37)!;
  return {config,state,org};
}
function observe(id:string,regime:PhysicsRegime){
  const w=world(id,regime),start=calculateOrganismCOM(w.org),initial=w.org.energy;let guards=0;
  for(let i=0;i<300;i++){stepSimulation(w.state,w.config,dt);guards+=w.org.motorDiagnostics?.numericalGuardEvents??0;}
  const end=calculateOrganismCOM(w.org);
  return {...w,guards,distance:Math.hypot(end.x-start.x,end.y-start.y),spent:initial-w.org.energy};
}
for(const f of FEATURED_BLUEPRINTS)test(`${f.id}: recovery preserves frozen starter swimming and bounded total energy cost`,()=>{
  const old=observe(f.id,'legacy-v0'),fixed=observe(f.id,'paid-work-v2');
  // A two-sided gate catches large "improvements" as well as collapses.
  const ratio=fixed.distance/old.distance;
  assert.ok(ratio>=.9&&ratio<=1.1,JSON.stringify({id:f.id,old:old.distance,fixed:fixed.distance}));
  assert.ok(fixed.spent>=old.spent*.9&&fixed.spent<=old.spent*1.1,JSON.stringify({oldSpent:old.spent,newSpent:fixed.spent}));
  // Legacy clamp counts measured with an observer before velocity clamping,
  // without changing forces, state or arithmetic (seed 711, heading .37).
  const oldGuards:Record<string,number>={'CUR-004':352,'CUR-005':117,'CUR-006':1136};
  assert.ok(fixed.guards<=(oldGuards[f.id]??0),'No added numerical-guard dependence');
  assert.equal(fixed.org.dissolving,false);assert.ok(fixed.org.energy>0);
  assert.ok(Math.abs(totalAccountedEnergy(fixed.state)-fixed.state.ledger.externalInflow)<1e-6);
  assert.deepEqual(fixed.org.genome,old.org.genome,'No founder gene retuning');
});
test('shared-part simultaneous work includes acceleration and charges positive work independently of braking',()=>{
  const r=paidMotorBatch([1,-.5],[0,0],[0,0],[2.5,-2],2,100);
  assert.equal(r.scale,1);assert.equal(r.positiveJ,1.75*MECHANICAL_JOULES);
  assert.equal(r.costJ,r.positiveJ/MUSCLE_EFFICIENCY);
  const reverse=paidMotorBatch([1,1],[-.5,2],[0,0],[1,-1],2,100);
  assert.equal(reverse.positiveJ,1.625*MECHANICAL_JOULES);
  assert.equal(reverse.negativeJ,.125*MECHANICAL_JOULES);
  for(const reserve of [0,1e-12,.001,100]){
    const b=paidMotorBatch([1000,-500],[3,-2],[.1,-.2],[2500,-2000],2,reserve);
    assert.ok(b.costJ<=reserve);assert.ok(b.positiveJ/MUSCLE_EFFICIENCY<=reserve+1e-10);
    if(reserve===0)assert.equal(b.scale,0);
  }
});
test('recovery reserves limit actuation before it acts, with zero unpaid motion or future-food borrowing',()=>{
  for(const reserve of [0,1e-12,.001,10000]){
    const {state,org,config}=world('CUR-001','paid-work-v2');
    org.genome.plasticityRate=0;org.genome.sensoryPlasticityRate=0;
    state.ledger.externalInflow+=reserve-org.energy;org.energy=reserve;
    stepSimulation(state,config,dt);
    assert.ok(state.ledger.mechanicalWorkHeat<=reserve+1e-10);
    assert.ok(Math.abs(totalAccountedEnergy(state)-state.ledger.externalInflow)<1e-6);
    if(reserve===0){
      assert.ok(org.joints.every(j=>j.appliedTorque===0));
      assert.ok(org.segments.every(p=>p.vx===0&&p.vy===0&&p.angVel===0));
    }else assert.ok(org.motorDiagnostics!.positiveWorkJ>0);
  }
});
const surfaceGolden={
  'CUR-001':'0c047eb7d77179a8416653908504ca302daaebf319f0ea4a173461f90be53a5f',
  'CUR-006':'08a677b9922d03a0a06a494b50bd1ebe481492fa6b19a3d49a2e9c6c0bd50370',
};
for(const [id,expected]of Object.entries(surfaceGolden))test(`${id}: v0.34.0 saves retain exact surface-model continuation`,()=>{
  const {state,config}=world(id,'surface-work-v1');
  for(let i=0;i<120;i++)stepSimulation(state,config,dt);
  assert.equal(createHash('sha256').update(JSON.stringify(legacyMouthState(createSnapshot(state,config).state))).digest('hex'),expected);
});
test('recovery snapshots fork and continue exactly in Worker host and direct kernel',()=>{
  const {state,config}=world('CUR-001','paid-work-v2');
  for(let i=0;i<30;i++)stepSimulation(state,config,dt);
  const saved=createSnapshot(state,config),restored=restoreSnapshot(saved),host=new SimulationHost();host.reset(saved,1);
  for(let i=0;i<30;i++){stepSimulation(state,config,dt);stepSimulation(restored.state,restored.settings,dt);host.tick();}
  assert.deepEqual(host.snapshot(),createSnapshot(state,config));
  assert.deepEqual(createSnapshot(restored.state,restored.settings),createSnapshot(state,config));
});
test('recovery retains Darter and Twin Oar physical off-axis food acquisition',()=>{
  const a=runControlledGrazing(17,-1,135,true,'legacy-v0');
  const b=runControlledGrazing(17,-1,135,true,'paid-work-v2');
  assert.ok(a.absorbedJ.Nutrient>0);assert.ok(b.absorbedJ.Nutrient>=a.absorbedJ.Nutrient*.9);
  const setup={side:-1,distance:135,heading:.8,viscosity:.15};
  const old=runTwinOarApproach('current',setup,'legacy-v0');
  const fixed=runTwinOarApproach('current',setup,'paid-work-v2');
  assert.equal(old.absorbedJ,2400);assert.equal(fixed.absorbedJ,2400);
});
