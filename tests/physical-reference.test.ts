import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CURRENT_COMMENT_REFERENCE, unitFactors, fixedDepthReference, impliedDepth,
  inspectReference, currentResistance, normalFaceResistance, inspectPart, reynolds} from '../physicalReferenceAudit';
import {MECHANICAL_JOULES} from '../foundationPhysics';
import {createFounderGenome, FEATURED_BLUEPRINTS} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createSnapshot, DEFAULT_SETTINGS} from '../persistence';
import {SimulationHost} from '../simulationHost';

const close = (a: number, b: number) => assert.ok(Math.abs(a-b) <= 1e-12 * Math.max(1e-30,Math.abs(a),Math.abs(b)), `${a} != ${b}`);
test('SI conversions preserve force, impulse, torque, work and power identities with independent time scale', () => {
  for (const ref of [CURRENT_COMMENT_REFERENCE, {metresPerPixel: .003, secondsPerSecond: .7, kilogramsPerMass: .002}]) {
    const f = unitFactors(ref);
    close(f.force, f.mass * f.length / f.time ** 2);
    close(f.momentum, f.force * f.time); close(f.angularMomentum, f.torque * f.time);
    close(f.torque, f.force * f.length); close(f.work, f.torque);
    close(f.power, f.work / f.time); close(f.work, f.mass * f.velocity ** 2);
    close(f.linearResistance * f.velocity, f.force);
    close(f.angularResistance * f.angularVelocity, f.torque);
    close(f.normalTractionCoefficient * f.area * f.velocity, f.force);
    close(f.dynamicViscosity * f.length * f.velocity, f.force);
  }
  close(unitFactors(CURRENT_COMMENT_REFERENCE).work, MECHANICAL_JOULES);
  close(impliedDepth(CURRENT_COMMENT_REFERENCE, 1000), 10/7);
  const proposed = fixedDepthReference(.001, 1, 1000, .007);
  close(proposed.kilogramsPerMass, .0008575); close(impliedDepth(proposed, 1000), .007);
  close(inspectReference(proposed).currentWorkFactorRatio, 10000/49);
  for (const invalid of [0,-1,Infinity,NaN]) assert.throws(() => unitFactors({...proposed,metresPerPixel:invalid}));
  close(reynolds(.035,.05,1000,.001),1750);
});

test('same face weights link translation and spin across sizes and aspect ratios; current extra spin is empirical', () => {
  for (const w of [7,14,35]) for (const h of [7,21,35]) {
    const old = currentResistance(w,h,.18), face = normalFaceResistance(w,h,1,.18*.025,.18);
    close(old.x,face.x); close(old.y,face.y);
    close(old.angular-face.angular,.975*.18*h**3/6);
    // Independently integrate traction moments on all faces at their local velocities.
    const gx=.4,gy=1.7,d=.003,u=2,v=-3,omega=.9,n=1000;
    let fx=0,fy=0,tau=0,power=0;
    for(let i=0;i<n;i++) {
      const x=w*((i+.5)/n-.5), y=h*((i+.5)/n-.5);
      for(let face=0;face<2;face++) {
        const vx=u-omega*y, f=-gx*d*h/n*vx;
        fx+=f;tau-=y*f;power+=f*vx;
        const vy=v+omega*x, g=-gy*d*w/n*vy;
        fy+=g;tau+=x*g;power+=g*vy;
      }
    }
    const r=normalFaceResistance(w,h,d,gx,gy);
    assert.ok(Math.abs(tau+r.angular*omega)<r.angular*omega*1.1e-6);
    close(fx,-r.x*u);close(fy,-r.y*v);close(power,fx*u+fy*v+tau*omega);
    assert.ok(power<0);
  }
});

test('read-only reference diagnostics leave frozen genes, authoritative continuation and PRNG exactly unchanged', () => {
  for (const id of ['CUR-001','CUR-002','CUR-009']) {
    const settings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3' as const,targetNutrients:0,inflowRate:0};
    const state=createInitialWorld(settings,711,'balanced','standard',0);
    addExternalOrganism(state,createFounderGenome(id),settings,1200,750,.37);
    const source=createSnapshot(state,settings), host=new SimulationHost(), control=new SimulationHost();
    host.reset(source,1);control.reset(source,1);
    for(let i=0;i<12;i++) {
      const snapshot=host.snapshot(), before=structuredClone(snapshot);
      for(const org of snapshot.state.organisms) for(const part of org.genome.parts)
        inspectPart(part, settings.waterViscosity ?? .22, CURRENT_COMMENT_REFERENCE);
      assert.deepEqual(snapshot,before);
      host.tick();control.tick();
    }
    assert.deepEqual(host.snapshot(),control.snapshot());
  }
  for(const {id} of FEATURED_BLUEPRINTS) {
    const g=createFounderGenome(id), before=structuredClone(g);
    for(const p of g.parts) inspectPart(p,.18,CURRENT_COMMENT_REFERENCE);
    assert.deepEqual(g,before);
  }
});
