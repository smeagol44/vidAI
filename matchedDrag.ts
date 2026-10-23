/** #80 offline adapter: identical v3 mass, inertia and work reference for both laws. */
import {prismProperties,prismResistance,integratePrismDrag} from './prismPhysics';
import type {PartDef} from './simulation';
export type DragLaw='v3'|'v4';
export const MATCHED_UNITS=Object.freeze({metresPerPixel:.001,kgPerMass:.175,joulesPerUnit:1.75e-7,
  newtonsPerForce:.000175,newtonMetresPerTorque:1.75e-7});
export interface MatchedMethod {
 version:'matched-drag-v1';law:DragLaw;integration:'explicit'|'implicit';fluidOff:boolean;
 anchors:ReadonlyArray<{parent:{x:number;y:number};child:{x:number;y:number}}>;
}
export function matchedWrench(d:Pick<PartDef,'width'|'height'>,vx:number,vy:number,w:number,angle:number,law:DragLaw,mu=.18) {
 const c=Math.cos(angle),s=Math.sin(angle),u=vx*c+vy*s,v=-vx*s+vy*c;
 let x:number,y:number,t:number;
 if(law==='v3'){x=-(.05*mu*d.height)*u;y=-2*mu*d.width*v;t=-(mu*w*(d.width**3+d.height**3))/6;}
 else {const r=prismResistance(prismProperties(d.width,d.height),u*.001,v*.001,w);
   x=-r.rx/MATCHED_UNITS.newtonsPerForce;y=-r.ry/MATCHED_UNITS.newtonsPerForce;t=-r.rw/MATCHED_UNITS.newtonMetresPerTorque;}
 const fx=x*c-y*s,fy=x*s+y*c;
 return {fx,fy,torque:t,powerJPerS:(fx*vx+fy*vy+t*w)*MATCHED_UNITS.joulesPerUnit};
}
export function matchedImplicit(d:Pick<PartDef,'width'|'height'>,mass:number,inertia:number,vx:number,vy:number,w:number,angle:number,dt:number,law:DragLaw,mu=.18) {
 const c=Math.cos(angle),s=Math.sin(angle),u=vx*c+vy*s,v=-vx*s+vy*c,J=MATCHED_UNITS.joulesPerUnit;
 let u1:number,v1:number,w1:number,physicalJ:number,numericalJ:number,iterations:number,residual:number;
 if(law==='v3'){
  u1=u/(1+dt*.05*mu*d.height/mass);v1=v/(1+dt*2*mu*d.width/mass);
  w1=w/(1+dt*mu*(d.width**3+d.height**3)/(6*inertia));
  physicalJ=dt*(.05*mu*d.height*u1*u1+2*mu*d.width*v1*v1+mu*(d.width**3+d.height**3)*w1*w1/6)*J;
  numericalJ=(.5*mass*((u1-u)**2+(v1-v)**2)+.5*inertia*(w1-w)**2)*J;iterations=0;
  residual=Math.max(Math.abs(mass*(u1-u)+dt*.05*mu*d.height*u1)/mass,
    Math.abs(mass*(v1-v)+dt*2*mu*d.width*v1)/mass,
    Math.abs(inertia*(w1-w)+dt*mu*(d.width**3+d.height**3)*w1/6)/inertia*Math.hypot(d.width,d.height)/2)*.001;
 }else{
  // Resistance geometry/coefficients unchanged; only kinetic reference is matched.
  const p={...prismProperties(d.width,d.height),massKg:mass*.175,inertiaKgM2:inertia*J};
  const r=integratePrismDrag(p,u*.001,v*.001,w,dt);u1=r.u/.001;v1=r.v/.001;w1=r.omega;
  physicalJ=r.physicalDissipationJ;numericalJ=r.numericalDissipationJ;iterations=r.iterations;residual=r.residual;
 }
 return {vx:u1*c-v1*s,vy:u1*s+v1*c,omega:w1,physicalJ,numericalJ,iterations,residual};
}
export function prescribedDragGrid(){
 const rows=[];
 for(const [width,height] of [[1,7],[7,1],[7,7],[7,21]])for(const angle of [0,.37,Math.PI/2])
 for(const [vx,vy,omega] of [[0,0,0],[1,0,0],[0,1,0],[20,0,0],[0,20,0],[0,0,1],[5,-3,.7]])for(const law of ['v3','v4'] as const){
  const w=matchedWrench({width,height},vx,vy,omega,angle,law);
  rows.push({width,height,angle,vx,vy,omega,law,...w,forceN:[w.fx*.000175,w.fy*.000175],torqueNm:w.torque*1.75e-7});
 }
 return {version:'matched-drag-wrenches-v1',units:MATCHED_UNITS,rows};
}
