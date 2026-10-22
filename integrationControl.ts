/** Offline analytic control: pure spin of a free prism under constant torque.
 * No articulated solver, speed guard, controller, pose/contact or fitted coefficient. */
import {prismProperties,prismResistance,integratePrismDrag} from './prismPhysics';
export function isolatedIntegrationControl() {
  const p=prismProperties(35,14),duration=1,a=10;
  const b=p.angular/p.inertiaKgM2,c=(prismResistance(p,0,0,1).rw-p.angular)/p.inertiaKgM2;
  const d=Math.sqrt(b*b+4*a*c),r=2*a/(b+d),q=(-b-d)/(2*c);
  const exact=r*(1-Math.exp(-d*duration))/(1-r/q*Math.exp(-d*duration));
  const rows=[];
  for(const method of ['motor-drag','motor-half-half','half-motor-half'])for(const hz of [240,480,960,1920,3840]) {
    let omega=0,workJ=0,physicalJ=0,numericalJ=0,maxBalanceErrorJ=0,sumBalanceErrorJ=0;
    const dt=1/hz;
    const drag=(h:number)=>{
      const before=.5*p.inertiaKgM2*omega*omega,s=integratePrismDrag(p,0,0,omega,h);omega=s.omega;
      physicalJ+=s.physicalDissipationJ;numericalJ+=s.numericalDissipationJ;
      const balanceErrorJ=Math.abs(before-.5*p.inertiaKgM2*omega*omega-s.physicalDissipationJ-s.numericalDissipationJ);
      maxBalanceErrorJ=Math.max(maxBalanceErrorJ,balanceErrorJ);sumBalanceErrorJ+=balanceErrorJ;
    };
    for(let i=0;i<hz*duration;i++) {
      if(method==='half-motor-half')drag(dt/2);
      // Exact constant-torque impulse path; full positive work prepaid at 25%.
      const delta=a*dt;workJ+=p.inertiaKgM2*delta*(omega+.5*delta);omega+=delta;
      if(method==='motor-drag')drag(dt);
      else {drag(dt/2);if(method==='motor-half-half')drag(dt/2);}
    }
    rows.push({method,hz,omega,exact,error:Math.abs(omega-exact),positiveJ:workJ,chemicalJ:4*workJ,physicalJ,numericalJ,maxBalanceErrorJ,sumBalanceErrorJ,
      wholeBalanceErrorJ:Math.abs(workJ-physicalJ-numericalJ-.5*p.inertiaKgM2*omega*omega)});
  }
  return {protocol:'isolated-spin-integration-control-v1',widthPx:35,heightPx:14,duration,aRadS2:a,rows};
}
