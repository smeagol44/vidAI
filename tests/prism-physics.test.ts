import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PRISM_REFERENCE as ref, prismProperties, prismResistance, integratePrismDrag} from '../prismPhysics';
import {bodyMass, mechanicalJoules, paidMotorBatch, MECHANICAL_JOULES} from '../foundationPhysics';
import {mechanicalFixture} from '../mechanicalAudit';
import {stepSimulation, BASE_PART_DENSITY} from '../simulation';
import {partKineticEnergy} from '../mechanicalObservation';
import {createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {enableClosedEconomy} from '../energyEconomy';
import {SimulationHost} from '../simulationHost';
const near=(a:number,b:number,relative=1e-10)=>assert.ok(Math.abs(a-b)<=relative*Math.max(1e-25,Math.abs(a),Math.abs(b)),`${a} != ${b}`);

test('approved prism volume, mass, inertia and work conversion have coherent SI dimensions',()=>{
  const p=prismProperties(35,21);
  near(p.volumeM3,.035*.021*.007);near(p.massKg,1000*p.volumeM3);
  near(p.inertiaKgM2,p.massKg*(.035**2+.021**2)/12);
  near(ref.kilogramsPerMass*.001**2,ref.joulesPerMechanicalUnit);
  near(MECHANICAL_JOULES/mechanicalJoules('prism-resistance-v4'),10000/49);
  const {org}=mechanicalFixture(1);const def=org.genome.parts[0];
  near(bodyMass(def,.4,'prism-resistance-v4')*ref.kilogramsPerMass,prismProperties(def.width,def.height).massKg);
  const paid=paidMotorBatch([2,-1],[1,-.2],[.1,-.3],[4,-2],2,100);
  const candidate=paidMotorBatch([2,-1],[1,-.2],[.1,-.3],[4,-2],2,100,mechanicalJoules('prism-resistance-v4'));
  near(paid.costJ/candidate.costJ,10000/49);assert.equal(candidate.scale,1);
});

test('translation uses projected pressure area once and spin integrates the same pressure moment',()=>{
  for(const [w,h] of [[7,7],[35,7],[7,35],[28,14]]) {
    const p=prismProperties(w,h),u=.06,omega=3;
    const translation=prismResistance(p,u,0,0);
    near(translation.rx,p.linear*u+.5*ref.waterDensityKgM3*ref.pressureCd*p.h*p.d*u*u);
    assert.equal(translation.ry,0);assert.ok(Math.abs(translation.rw)<1e-22);
    const spin=prismResistance(p,0,0,omega);
    near(spin.rw,p.angular*omega+ref.waterDensityKgM3*ref.pressureCd*p.d*(p.w**4+p.h**4)/64*omega**2);
    assert.ok(Math.abs(spin.rx)+Math.abs(spin.ry)<1e-18);
  }
});

test('independent six-face quadrature agrees in combined translation/spin and dissipates for all aspect ratios',()=>{
  for(const [width,height] of [[7,7],[35,7],[7,35],[28,14]]) {
    const p=prismProperties(width,height),u=.06,v=-.02,omega=3.7;
    const gamma=ref.dynamicViscosityPaS/Math.min(p.w,p.h,p.d);
    let fx=0,fy=0,tau=0,power=0;
    // Independent midpoint surface mesh: four side faces and both broad faces.
    const n=120;
    for(let normal=0;normal<3;normal++) for(const side of [-1,1]) {
      const lengths=[p.w,p.h,p.d], axes=[0,1,2].filter(a=>a!==normal);
      for(let i=0;i<n;i++)for(let j=0;j<n;j++) {
        const r=[0,0,0];r[normal]=side*lengths[normal]/2;
        r[axes[0]]=lengths[axes[0]]*((i+.5)/n-.5);r[axes[1]]=lengths[axes[1]]*((j+.5)/n-.5);
        const vel=[u-omega*r[1],v+omega*r[0],0],vn=side*vel[normal],area=lengths[axes[0]]*lengths[axes[1]]/n**2;
        const f=vel.map(q=>-gamma*q*area);
        f[normal]-=.5*ref.waterDensityKgM3*ref.pressureCd*Math.max(0,vn)**2*side*area;
        fx+=f[0];fy+=f[1];tau+=r[0]*f[1]-r[1]*f[0];power+=f[0]*vel[0]+f[1]*vel[1];
      }
    }
    const r=prismResistance(p,u,v,omega);
    near(fx,-r.rx,1e-4);near(fy,-r.ry,1e-4);near(tau,-r.rw,2e-4);
    near(power,r.powerW,2e-4);near(power,fx*u+fy*v+tau*omega,1e-10);assert.ok(power<0);
  }
});

test('implicit drag is passive at large timesteps and separates physical from numerical dissipation',()=>{
  for(const size of [[7,7],[42,7],[7,42],[35,21]])for(const dt of [0,1/960,1/240,1/60,.1,1]) {
    const p=prismProperties(size[0],size[1]);
    for(const [u,v,w] of [[0,0,0],[.4,-.2,30],[-2,1,-100]]) {
      const r=integratePrismDrag(p,u,v,w,dt);
      const before=.5*p.massKg*(u*u+v*v)+.5*p.inertiaKgM2*w*w;
      const after=.5*p.massKg*(r.u*r.u+r.v*r.v)+.5*p.inertiaKgM2*r.omega*r.omega;
      assert.ok(after<=before+1e-18);
      if(before>0&&dt>0)near(before-after,r.physicalDissipationJ+r.numericalDissipationJ,2e-8);
      assert.ok(r.physicalDissipationJ>=0&&r.numericalDissipationJ>=0);
    }
  }
});

test('free translation converges toward the independent linear-plus-quadratic analytic solution',()=>{
  const p=prismProperties(35,14),u0=.2,duration=.5;
  const a=p.linear/p.massKg,b=.5*ref.waterDensityKgM3*ref.pressureCd*p.h*p.d/p.massKg;
  const exact=u0*Math.exp(-a*duration)/(1+b*u0/a*(1-Math.exp(-a*duration)));
  let previousError=Infinity;
  for(const hz of [60,120,240,480]) {
    let u=u0;for(let n=0;n<duration*hz;n++)u=integratePrismDrag(p,u,0,0,1/hz).u;
    const error=Math.abs(u-exact);assert.ok(error<previousError*.6);previousError=error;
  }
});

test('kernel free rotated motion dissipates, and zero reserves never fund active torque',()=>{
  for(const angle of [0,.73,-1.1]) {
    const f=mechanicalFixture(1);f.config.physicsRegime='prism-resistance-v4';
    const p=f.org.segments[0];p.angle=angle;p.vx=12;p.vy=-4;p.angVel=.3;
    let before=partKineticEnergy(p,f.org.genome.parts[0],BASE_PART_DENSITY,f.config.physicsRegime);
    for(let tick=0;tick<12;tick++) {
      stepSimulation(f.state,f.config,1/60,undefined,(phase,a,b)=>{
        if(phase==='fluid-resistance')assert.ok(b<=a+1e-16);
      });
      const after=partKineticEnergy(p,f.org.genome.parts[0],BASE_PART_DENSITY,f.config.physicsRegime);
      assert.ok(after<=before+1e-16);before=after;
    }
    assert.ok(Math.abs(totalAccountedEnergy(f.state)-f.state.ledger.externalInflow)<1e-6);
  }
  const f=mechanicalFixture();f.config.physicsRegime='prism-resistance-v4';f.org.genome.motorForce=20;
  f.state.ledger.externalInflow-=f.org.energy;f.org.energy=0;
  stepSimulation(f.state,f.config,1/60);
  assert.ok(f.org.joints.every(j=>j.appliedTorque===0));assert.equal(f.state.ledger.mechanicalWorkHeat,0);
});

test('actual v4 force integration reconciles SI kinetic work and prepaid debit, including tiny reserves',()=>{
  for(const reserve of [0,1e-12,.001,10000]) {
    const f=mechanicalFixture();f.config.physicsRegime='prism-resistance-v4';f.org.genome.motorForce=20;
    f.org.genome.plasticityRate=0;f.org.genome.sensoryPlasticityRate=0;
    f.state.ledger.externalInflow+=reserve-f.org.energy;f.org.energy=reserve;
    let forceWorkJ=0;
    stepSimulation(f.state,f.config,1/60,undefined,(phase,a,b)=>{if(phase==='forces-and-motors')forceWorkJ+=b-a;});
    const d=f.org.motorDiagnostics!;
    if(forceWorkJ>1e-20)near(d.positiveWorkJ-d.negativeWorkJ,forceWorkJ,1e-8);
    assert.ok(d.positiveWorkJ/.25<=reserve+1e-14);
    near(f.state.ledger.mechanicalWorkHeat,d.positiveWorkJ/.25);
    assert.ok(Math.abs(totalAccountedEnergy(f.state)-f.state.ledger.externalInflow)<1e-6);
  }
});

test('schema 17 strictly owns v4 and continues exactly with observations in both ecology/contact choices',()=>{
  for(const closed of [false,true])for(const contact of [undefined,'capsule-v1'] as const) {
    const f=mechanicalFixture();f.config.physicsRegime='prism-resistance-v4';f.config.mouthContactModel=contact;
    f.org.genome.motorForce=20;
    if(closed){enableClosedEconomy(f.state);f.config.ecologyRegime='closed-v1';f.config.nutrientLimit=null;}
    for(let i=0;i<3;i++)stepSimulation(f.state,f.config,1/60);
    const saved=createSnapshot(f.state,f.config),a=new SimulationHost(),b=new SimulationHost();
    assert.equal(saved.schemaVersion,'17.0.0');a.reset(saved,1);b.reset(saved,1);
    for(let i=0;i<12;i++){a.tick(()=>{},receipt=>assert.ok(Object.isFrozen(receipt)));b.tick();}
    assert.deepEqual(a.snapshot(),b.snapshot());
    for(const schemaVersion of ['3.0.0','11.0.0','12.0.0','13.0.0','14.0.0','15.0.0','16.0.0'])
      assert.throws(()=>restoreSnapshot({...saved,schemaVersion}));
    assert.throws(()=>restoreSnapshot({...saved,settings:{...saved.settings,physicsRegime:'passive-work-v3'}}),/physics regime/);
  }
});
