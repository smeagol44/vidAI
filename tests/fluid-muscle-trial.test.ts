import assert from 'node:assert/strict';
import {test} from 'node:test';
import {anisotropicFaceResistance, anatomicalMuscleParameters, MUSCLE_REFERENCE} from '../foundationPhysics';
import {createFounderGenome} from '../founders';
import {observeSolver} from '../solverPassivityAudit';

const close = (a: number,b: number) => assert.ok(Math.abs(a-b) <= 1e-10 * Math.max(1,Math.abs(b)),a+' vs '+b);

test('anisotropic face law matches existing linear drag and its own rotational integral', () => {
  for (const [w,h] of [[7,7],[14,7],[7,28],[35,7],[14,28]]) for (const mu of [0,.18,.4]) {
    const r=anisotropicFaceResistance(w,h,mu);
    close(r.x,.05*mu*h);close(r.y,2*mu*w);
    close(r.angular,mu*(w**3+h**3/40)/6);
    assert.ok(r.angular>=0);
    // Each face contributes a nonnegative dissipative quadratic form.
    assert.ok(r.x*12**2 + r.y*7**2 + r.angular*3**2>=0);
  }
});

test('fixed reference pair matches existing absolute strength, while geometric size doubles torque 4x', () => {
  const p=createFounderGenome('CUR-001').parts[0], c=createFounderGenome('CUR-001').parts[1];
  const parent={...p,width:14,height:7,dimN:2,dimM:1};
  const child={...c,width:14,height:7,dimN:2,dimM:1,attachmentPoint:'EAST' as const};
  const i=MUSCLE_REFERENCE.cellsAcross*MUSCLE_REFERENCE.cellsAlong*MUSCLE_REFERENCE.baseDensity*(14**2+7**2)/12;
  const ref=anatomicalMuscleParameters(parent,child,i,i,1.2,1,1);
  close(ref.kp,1.2*i*480);close(ref.maxTorque,i*2200);
  const big=(x:typeof parent)=>({...x,width:x.width*2,height:x.height*2,dimN:x.dimN*2,dimM:x.dimM*2});
  const larger=anatomicalMuscleParameters(big(parent),big(child),i*16,i*16,1.2,1,1);
  close(larger.maxTorque/ref.maxTorque,4);
  close(larger.kp/ref.kp,4);
  close(larger.kd/ref.kd,8);
});

test('unrequested foundation trials do not change frozen v3 behavior or old v2 continuation', () => {
  const ordinary=observeSolver('CUR-001','passive-work-v3');
  const historical=observeSolver('CUR-001','paid-work-v2');
  close(ordinary.displacementPx,190.50394871487816);
  close(historical.displacementPx,190.4994092650809);
  assert.equal(ordinary.guards,0);
  assert.equal(historical.guards,0);
});
