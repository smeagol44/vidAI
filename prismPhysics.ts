/** Testing-only prism-resistance-v4 constitutive profile. No controller tuning.
 * All equations here use SI. See docs/experiments/prism-resistance-v4.md.
 */
export const PRISM_REFERENCE = Object.freeze({metresPerPixel: .001, depthM: .007,
  densityKgM3: 1000, kilogramsPerMass: .0008575, joulesPerMechanicalUnit: 8.575e-10,
  waterDensityKgM3: 1000, dynamicViscosityPaS: .001, pressureCd: 1});

export function prismProperties(widthPx: number, heightPx: number) {
  const w = widthPx * PRISM_REFERENCE.metresPerPixel, h = heightPx * PRISM_REFERENCE.metresPerPixel;
  if (!(w > 0 && h > 0 && Number.isFinite(w + h))) throw new Error('Invalid prism dimensions');
  const d = PRISM_REFERENCE.depthM, volumeM3 = w * h * d;
  const massKg = PRISM_REFERENCE.densityKgM3 * volumeM3;
  const inertiaKgM2 = massKg * (w * w + h * h) / 12;
  // Provisional local shear-length closure, not a solved water boundary layer.
  const gamma = PRISM_REFERENCE.dynamicViscosityPaS / Math.min(w, h, d);
  const area = 2 * (w * h + w * d + h * d);
  // Integral of in-plane r² over all six faces. Broad faces supply shear too.
  const surfaceMoment = 2 * w * h * (w * w + h * h) / 12
    + 2 * h * d * (w * w / 4 + h * h / 12)
    + 2 * w * d * (h * h / 4 + w * w / 12);
  return {w, h, d, volumeM3, massKg, inertiaKgM2, linear: gamma * area,
    angular: gamma * surfaceMoment, radius: Math.hypot(w,h) / 2};
}
export type PrismProperties = ReturnType<typeof prismProperties>;

/** Integrals of |a+b*s|*(a+b*s), its first moment, and derivatives.
 * Split at the velocity zero. Two-point Gauss is exact for each polynomial
 * piece (including the cubic moment/potential); no centre-face approximation.
 */
function edge(length: number, a: number, b: number) {
  let force = 0, moment = 0, j0 = 0, j1 = 0, j2 = 0, potential = 0;
  const lo = -length / 2, hi = length / 2, root = b === 0 ? hi : -a / b;
  const split = root > lo && root < hi ? root : hi;
  for (let interval = 0; interval < (split === hi ? 1 : 2); interval++) {
    const left = interval === 0 ? lo : split, right = interval === 0 ? split : hi;
    const mid = (left + right) / 2, half = (right - left) / 2;
    for (const sign of [-1,1]) {
      const s = mid + sign * half / Math.sqrt(3), q = a + b * s, abs = Math.abs(q);
      const f = half * abs * q, derivative = half * 2 * abs;
      force += f; moment += s * f; j0 += derivative; j1 += s * derivative; j2 += s * s * derivative;
      potential += half * abs ** 3 / 3;
    }
  }
  return {force, moment, j0, j1, j2, potential};
}

/** Positive resistance R, so physical wrench is -R. Linear traction -gamma*v
 * acts on all six faces. Pressure acts only on leading normal surface elements;
 * opposite pairs therefore use projected area once, not twice.
 */
export function prismResistance(p: PrismProperties, u: number, v: number, omega: number) {
  const x = edge(p.h,u,-omega), y = edge(p.w,v,omega);
  const k = .5 * PRISM_REFERENCE.waterDensityKgM3 * PRISM_REFERENCE.pressureCd * p.d;
  const rx = p.linear * u + k * x.force, ry = p.linear * v + k * y.force;
  const rw = p.angular * omega + k * (-x.moment + y.moment);
  return {rx, ry, rw, jxx: p.linear + k*x.j0, jyy: p.linear + k*y.j0,
    jxw: -k*x.j1, jyw: k*y.j1, jww: p.angular + k*(x.j2+y.j2),
    potential: .5*p.linear*(u*u+v*v)+.5*p.angular*omega*omega+k*(x.potential+y.potential),
    powerW: -(rx*u+ry*v+rw*omega)};
}

/** Backward Euler local drag, after the prepaid motor/wall impulse. Convex
 * resistance potential makes the 3x3 Jacobian SPD. No fluid kinetic storage.
 * Numerical BE loss is exposed separately from endpoint traction dissipation.
 */
export function integratePrismDrag(p: PrismProperties, u0: number, v0: number, w0: number, dt: number) {
  if (![u0,v0,w0,dt].every(Number.isFinite) || dt < 0) throw new Error('Invalid prism velocity/timestep');
  const m=p.massKg, I=p.inertiaKgM2;
  let u=u0/(1+dt*p.linear/m), v=v0/(1+dt*p.linear/m), omega=w0/(1+dt*p.angular/I);
  const objective=(a:number,b:number,c:number)=>.5*m*((a-u0)**2+(b-v0)**2)+.5*I*(c-w0)**2
    +dt*prismResistance(p,a,b,c).potential;
  let iterations=0, residual=0;
  const tolerance=1e-11*Math.max(1,Math.abs(u0),Math.abs(v0),Math.abs(w0)*p.radius);
  for (;iterations<24;iterations++) {
    const r=prismResistance(p,u,v,omega);
    const rx=m*(u-u0)+dt*r.rx, ry=m*(v-v0)+dt*r.ry, rw=I*(omega-w0)+dt*r.rw;
    residual=Math.max(Math.abs(rx)/m,Math.abs(ry)/m,Math.abs(rw)/I*p.radius);
    if(residual<=tolerance)break;
    const a=m+dt*r.jxx,b=m+dt*r.jyy,c=I+dt*r.jww,d=dt*r.jxw,e=dt*r.jyw;
    const dw=(rw-d*rx/a-e*ry/b)/(c-d*d/a-e*e/b), du=(rx-d*dw)/a, dv=(ry-e*dw)/b;
    const before=objective(u,v,omega);let scale=1,accepted=false;
    for(let back=0;back<24;back++) {
      if(objective(u-scale*du,v-scale*dv,omega-scale*dw)<=before*(1+1e-14)+1e-30) {accepted=true;break;}
      scale*=.5;
    }
    if(!accepted)throw new Error('Prism drag line search failed');
    u-=scale*du;v-=scale*dv;omega-=scale*dw;
  }
  if(iterations===24)throw new Error('Prism drag did not converge');
  const r=prismResistance(p,u,v,omega);
  return {u,v,omega,iterations,residual,physicalDissipationJ:-dt*r.powerW,
    numericalDissipationJ:.5*m*((u-u0)**2+(v-v0)**2)+.5*I*(omega-w0)**2};
}
