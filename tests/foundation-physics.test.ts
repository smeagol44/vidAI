import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, LEGACY_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {surfaceResistance, muscleParameters, paidMotorImpulse, MECHANICAL_JOULES, MUSCLE_EFFICIENCY} from '../foundationPhysics';
import {SimulationHost} from '../simulationHost';
const dt = 1 / 60;
const near = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`);
function fixture(parts = 1, width = 14, height = 7, mu = .18, heading = 0, legacy = false) {
  const settings = {...(legacy ? LEGACY_SETTINGS : DEFAULT_SETTINGS), physicsRegime: legacy ? 'legacy-v0' as const : 'surface-work-v1' as const, targetNutrients: 0, inflowRate: 0,
    mutationSeverity: 0, waterViscosity: mu, gravity: 0};
  const state = createInitialWorld(settings, 97, 'balanced', 'standard', 0);
  const g = createFounderGenome('FND-001');
  g.parts = g.parts.slice(0, parts); g.eyes = []; g.mouths = [];
  for (const p of g.parts) Object.assign(p, {width, height, dimN: width/7, dimM: height/7, cpgPhaseOffset: Math.PI/2});
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier);
  sim.remapBrain(g); g.weightsHO.forEach(row => row.fill(0)); g.biasesO.fill(0);
  const org = addExternalOrganism(state, g, settings, 1200, 750, heading)!;
  return {settings, state, org};
}
function kinetic(org: sim.Organism) {
  return org.segments.reduce((sum, p, i) => {
    const def = org.genome.parts[i], mass = Math.max(.35, def.dimN*def.dimM*sim.BASE_PART_DENSITY);
    return sum + .5*mass*(p.vx*p.vx+p.vy*p.vy) + mass*(def.width**2+def.height**2)/24*p.angVel**2;
  }, 0);
}

test('four-face drag matches actual rotated kernel decay along both axes for sizes/aspect ratios', () => {
  for (const [w,h] of [[7,7],[28,7],[7,35],[28,14]]) for (const angle of [0,.73,-1.1]) {
    const {state,settings,org} = fixture(1,w,h,.18,angle), p = org.segments[0];
    const c = Math.cos(angle), s = Math.sin(angle), mass = w*h/49*sim.BASE_PART_DENSITY;
    const drag = surfaceResistance(w,h,.18), u=12, v=-4;
    p.vx=c*u-s*v; p.vy=s*u+c*v;
    const before=kinetic(org);
    for(let n=0;n<30;n++) sim.stepSimulation(state,settings,dt);
    near(p.vx*c+p.vy*s,u*(1-drag.x/mass/240)**120);
    near(-p.vx*s+p.vy*c,v*(1-drag.y/mass/240)**120);
    assert.ok(kinetic(org)<before); near(totalAccountedEnergy(state),state.ledger.externalInflow);
  }
});
test('passive spin, combined motion and zero viscosity dissipate or preserve real kernel kinetic energy', () => {
  for(const mu of [0,.18,.8]) for(const spinOnly of [false,true]) {
    const {state,settings,org}=fixture(1,28,7,mu,.6),p=org.segments[0];
    p.vx=spinOnly?0:12;p.vy=spinOnly?0:-4;p.angVel=.3;
    let before=kinetic(org);
    const inertia=.4*4*(28**2+7**2)/12;
    const expected=.3*(1-surfaceResistance(28,7,mu).angular/inertia/240)**120;
    for(let n=0;n<30;n++) {
      sim.stepSimulation(state,settings,dt);
      const after=kinetic(org); assert.ok(after<=before+1e-8);if(mu===0)near(after,before);before=after;
    }
    near(p.angVel,expected);if(spinOnly){near(p.vx,0);near(p.vy,0);}
  }
});
test('unit-depth muscle section gives 2x force and 4x torque at twice linear size; all cardinal faces count', () => {
  for(const direction of ['EAST','WEST','NORTH','SOUTH'] as const) {
    const {org}=fixture(2),[parent,child]=org.genome.parts;child.attachmentPoint=direction;
    const a=muscleParameters(parent,child,100,100,2,1,1);
    const big=(p:sim.PartDef)=>({...p,width:p.width*2,height:p.height*2});
    const b=muscleParameters(big(parent),big(child),1600,1600,2,1,1);
    near(b.section/a.section,2);near(b.lever/a.lever,2);near(b.maxTorque/a.maxTorque,4);near(b.kp/a.kp,4);
    near(b.kd/a.kd,8);
    near(a.section,direction==='EAST'||direction==='WEST'?7:14);
  }
});
test('exact torque impulse charges acceleration at rest, signed braking and finite reserve limits without a billing cap', () => {
  const accelerating=paidMotorImpulse(240,1/240,0,2,100);
  near(accelerating.positiveJ,MECHANICAL_JOULES);assert.ok(accelerating.costJ>0);
  const braking=paidMotorImpulse(-240,1/240,10,2,100);
  near(braking.negativeJ,9*MECHANICAL_JOULES);near(braking.costJ,0);
  const reversal=paidMotorImpulse(-240,1,10,2,100);
  assert.ok(reversal.positiveJ>0 && reversal.negativeJ>0);
  near(reversal.positiveJ-reversal.negativeJ,(-240*10+.5*240**2*2)*MECHANICAL_JOULES);
  const expensive=paidMotorImpulse(1e9,1,0,1,100);
  near(expensive.costJ,100);assert.ok(expensive.limited);assert.ok(expensive.costJ>40);
  for(const speed of [-100,0,100]) for(const reserve of [0,1e-12,.001,10]) {
    const result=paidMotorImpulse(10000,dt,speed,2,reserve);
    assert.ok(result.costJ<=reserve);near(result.costJ,result.positiveJ/MUSCLE_EFFICIENCY,1e-10);
    if(reserve===0)near(result.impulse,0);
  }
});
test('kernel prepays actual motor impulses, never moves on future food, and keeps equal/opposite COM momentum', () => {
  for(const reserve of [0,1e-12,.001,10000]) {
    const {state,settings,org}=fixture(2,14,7,0);state.ledger.externalInflow+=reserve-org.energy;org.energy=reserve;
    const before=sim.calculateOrganismCOM(org);
    sim.stepSimulation(state,settings,dt);
    const d=org.motorDiagnostics!;
    near(state.ledger.mechanicalWorkHeat,d.positiveWorkJ/MUSCLE_EFFICIENCY,1e-10);
    assert.ok(state.ledger.mechanicalWorkHeat<=reserve+1e-12);
    near(totalAccountedEnergy(state),state.ledger.externalInflow,1e-7);
    const after=sim.calculateOrganismCOM(org);near(after.vxCOM,before.vxCOM);near(after.vyCOM,before.vyCOM);
    if(reserve===0){near(kinetic(org),0);assert.ok(org.joints.every(j=>j.appliedTorque===0));}
    else assert.ok(d.positiveWorkJ>0);
    assert.equal(d.numericalGuardEvents,0);
  }
  // Directly demonstrate the historical unpaid-at-rest path at zero reserves.
  const old=fixture(2,14,7,0,0,true);old.org.energy=0;
  sim.stepSimulation(old.state,old.settings,dt);
  assert.ok(kinetic(old.org)>0);assert.equal(old.state.ledger.mechanicalWorkHeat,0);
});
test('corrected motor control can disengage without suppressing passive constraints or contacts', () => {
  const {state,settings,org}=fixture(2,14,7,0);org.genome.motorForce=0;
  sim.stepSimulation(state,settings,dt);near(kinetic(org),0);near(org.motorEnergyRate!,0);
  // An imposed anchor error is corrected by constraints even with unpaid muscles.
  org.segments[1].y+=.1;
  for(let n=0;n<20;n++)sim.stepSimulation(state,settings,dt);
  const child=org.genome.parts[1],parent=org.genome.parts[0],p=org.segments[0],c=org.segments[1];
  const a=sim.getCardinalAnchor(child.attachmentPoint,parent.width,parent.height);
  const b=sim.getChildAnchorForParentDir(child.attachmentPoint,child.width,child.height);
  const gap=Math.hypot(c.x+Math.cos(c.angle)*b.x-Math.sin(c.angle)*b.y-p.x-Math.cos(p.angle)*a.x+Math.sin(p.angle)*a.y,
    c.y+Math.sin(c.angle)*b.x+Math.cos(c.angle)*b.y-p.y-Math.sin(p.angle)*a.x-Math.cos(p.angle)*a.y);
  assert.ok(gap<.01);near(org.motorEnergyRate!,0);
});
test('v3-v11 imports select legacy; v12 persists and validates regimes; Worker host and direct continuation agree', () => {
  for(const legacy of [true,false]) {
    const {state,settings}=fixture(2,14,7,.18,.6,legacy);
    for(let n=0;n<12;n++)sim.stepSimulation(state,settings,dt);
    const saved=createSnapshot(state,settings),restored=restoreSnapshot(saved),host=new SimulationHost();
    host.reset(saved,1);assert.equal(host.settings.physicsRegime,settings.physicsRegime);
    for(let n=0;n<12;n++){sim.stepSimulation(state,settings,dt);sim.stepSimulation(restored.state,restored.settings,dt);host.tick();}
    assert.deepEqual(host.snapshot(),createSnapshot(state,settings));
    assert.deepEqual(createSnapshot(restored.state,restored.settings),createSnapshot(state,settings));
    const historical=structuredClone(saved);historical.schemaVersion='11.0.0';delete (historical.settings as sim.SimulationSettings).physicsRegime;
    assert.equal(restoreSnapshot(historical).settings.physicsRegime,'legacy-v0');
    for(const bad of [undefined,'future',null,{}]) {
      const invalid=structuredClone(saved);(invalid.settings as any).physicsRegime=bad;
      assert.throws(()=>restoreSnapshot(invalid),/physics regime/);
    }
  }
});
test('retired reproductionThreshold remains importable but cannot change funding or mutate in corrected offspring', () => {
  const {state,org,settings}=fixture(2);org.age=50;state.simTime=50;org.energy=org.genome.maxEnergyCapacity;
  const original=sim.evaluateReproductionAffordability(org,state.simTime,1,0);
  org.genome.reproductionThreshold=.99;
  assert.deepEqual(sim.evaluateReproductionAffordability(org,state.simTime,1,0),original);
  for(let seed=1;seed<=12;seed++) {
    const child=sim.mutateGenome(org.genome,1,new sim.XoshiroPRNG(seed),settings.physicsRegime);
    assert.equal(child.reproductionThreshold,.99);
  }
  const saved=createSnapshot(state,settings);assert.equal(restoreSnapshot(saved).state.organisms[0].genome.reproductionThreshold,.99);
});

test('food acquired after physics can fund only subsequent motor impulses', () => {
  const settings={...DEFAULT_SETTINGS,targetNutrients:0,inflowRate:0,waterViscosity:0};
  const state=createInitialWorld(settings,41,'balanced','standard',0);
  const g=createFounderGenome('FND-001');
  const org=addExternalOrganism(state,g,settings,1200,750,0)!;
  state.ledger.externalInflow-=org.energy;org.energy=0;
  const mouth=g.mouths[0],anchor=sim.getOrganAnchor(mouth,g.parts[mouth.partIndex].width,g.parts[mouth.partIndex].height);
  const part=org.segments[mouth.partIndex];
  state.nutrients.push({id:'finite-food',x:part.x+anchor.x,y:part.y+anchor.y,vx:0,vy:0,
    energyValue:3000,radius:18,bottomTimer:0});state.ledger.externalInflow+=3000;
  sim.stepSimulation(state,settings,dt);
  near(org.motorDiagnostics!.positiveWorkJ,0);near(org.motorEnergyRate!,0);assert.ok(org.energy>0);
  sim.stepSimulation(state,settings,dt);assert.ok(org.motorDiagnostics!.positiveWorkJ>0);
  near(totalAccountedEnergy(state),state.ledger.externalInflow,1e-7);
});
