/** Explicit #100 environmental resource. Never supplied to neural inputs. */
import {calculateOrganismCOM,getOrganAnchor,getCardinalBaseAngle,getCardinalOutwardNormal,distPointToSegment,type Organism,type SimulationState,type Nutrient,XoshiroPRNG} from './simulation';
import {mouthDimensions} from './mouthGeometry';
export type Point={x:number;y:number};
export type MovingState='moving'|'paused'|'frozen';
export interface PursuitState {
 version:'moving-nutrient-v1';organismId:string;nutrientId:string;stockJ:number;radius:number;
 motionSeed:number;schedule:Array<{stop:boolean;offset:number}>;interval:number;heading:number;status:MovingState;steps:number;
 reservoirInputJ:number;absorbedJ:number;grossByState:Record<MovingState,number>;absorbedByState:Record<MovingState,number>;
 decisions:Array<{interval:number;time:number;stop:boolean;offset:number;heading:number;x:number;y:number;com:Point}>;
 events:Array<{kind:string;time:number;x:number;y:number;eyes:Point[];fraction:number}>;
 trace:number[][];
}
export function organs(o:Organism){
 const point=(organ:any)=>{const p=o.segments[organ.partIndex],d=o.genome.parts[organ.partIndex],a=getOrganAnchor(organ,d.width,d.height),c=Math.cos(p.angle),s=Math.sin(p.angle);return{x:p.x+c*a.x-s*a.y,y:p.y+s*a.x+c*a.y};};
 return{com:calculateOrganismCOM(o),eyes:o.genome.eyes.map(e=>({...point(e),heading:o.segments[e.partIndex].angle+getCardinalBaseAngle(e.direction)})),mouths:o.genome.mouths.map(m=>{const p=o.segments[m.partIndex],a=point(m),n=getCardinalOutwardNormal(m.direction),c=Math.cos(p.angle),s=Math.sin(p.angle),{radius,halfSpan}=mouthDimensions(m),tx=c*-n.y-s*n.x,ty=s*-n.y+c*n.x;return{...a,radius,x1:a.x-tx*halfSpan,y1:a.y-ty*halfSpan,x2:a.x+tx*halfSpan,y2:a.y+ty*halfSpan};})};
}
export function mouthGap(o:Organism,n:Nutrient){return Math.min(...organs(o).mouths.map(m=>distPointToSegment(n.x,n.y,m.x1,m.y1,m.x2,m.y2)-m.radius-n.radius));}
export function initPursuit(o:Organism,n:Nutrient,seed:number):PursuitState{
 const rng=new XoshiroPRNG(seed^0xa100e5ed);return{version:'moving-nutrient-v1',organismId:o.id,nutrientId:n.id,stockJ:n.energyValue,radius:n.radius,motionSeed:seed,schedule:Array.from({length:10},()=>({stop:rng.nextFloat()<.25,offset:Math.PI*(rng.nextFloat()-.5)})),interval:-1,heading:0,status:'paused',steps:0,reservoirInputJ:0,absorbedJ:0,grossByState:{moving:0,paused:0,frozen:0},absorbedByState:{moving:0,paused:0,frozen:0},decisions:[],events:[],trace:[]};
}
// The interval of t in [0,1] inside a radius405 disk for linear relative motion.
export function diskInterval(a:Point,b:Point,r=405):[number,number]|null{
 const dx=b.x-a.x,dy=b.y-a.y,A=dx*dx+dy*dy,B=2*(a.x*dx+a.y*dy),C=a.x*a.x+a.y*a.y-r*r;
 if(A===0)return C<=0?[0,1]:null;const D=B*B-4*A*C;if(D<0)return null;const lo=Math.max(0,(-B-Math.sqrt(D))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(D))/(2*A));return lo<=hi?[lo,hi]:null;
}
export function unionExit(start:Point,end:Point,before:Point[],after:Point[]):number{
 const spans=before.map((e,i)=>diskInterval({x:start.x-e.x,y:start.y-e.y},{x:end.x-after[i].x,y:end.y-after[i].y})).filter((x):x is [number,number]=>!!x).sort((a,b)=>a[0]-b[0]);let right=0;
 for(const [lo,hi]of spans){if(lo>right)break;right=Math.max(right,hi);}return right;
}
export function advancePursuit(state:SimulationState,before:ReturnType<typeof organs>,dt:number){
 const p=state.pursuit!,o=state.organisms.find(o=>o.id===p.organismId),n=state.nutrients.find(n=>n.id===p.nutrientId);if(!o||!n)throw Error('Missing pursuit body/source');
 if(Math.abs(dt-1/240)>1e-15)throw Error('Pursuit requires registered240Hz clock');
 const after=organs(o),time=p.steps/240,interval=Math.min(9,Math.floor(p.steps/360));
 if(interval!==p.interval){p.interval=interval;const decision=p.schedule[interval];p.heading=Math.atan2(n.y-before.com.y,n.x-before.com.x)+decision.offset;if(p.status!=='frozen')p.status=decision.stop?'paused':'moving';p.decisions.push({interval,time,stop:decision.stop,offset:decision.offset,heading:p.heading,x:n.x,y:n.y,com:{...before.com}});}
 const start={x:n.x,y:n.y};let fraction=p.status==='moving'?1:0;const vx=22*Math.cos(p.heading),vy=22*Math.sin(p.heading);
 if(fraction){const initial=vx*(n.x-before.com.x)+vy*(n.y-before.com.y),final=vx*(n.x+vx*dt-after.com.x)+vy*(n.y+vy*dt-after.com.y);if(initial<0)fraction=0;else if(final<0)fraction=initial/(initial-final);}
 const interpolate=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 const mid={x:start.x+vx*dt*fraction,y:start.y+vy*dt*fraction},eyesMid=before.eyes.map((e,i)=>interpolate(e,after.eyes[i],fraction));let freeze:number|null=null;
 if(p.status!=='frozen'){
  if(fraction>0){const f=unionExit(start,mid,before.eyes,eyesMid);if(f<1)freeze=f*fraction;}
  if(freeze===null&&fraction<1){const f=unionExit(mid,mid,eyesMid,after.eyes);if(f<1)freeze=fraction+(1-fraction)*f;}
 }
 if(freeze!==null){const travel=Math.min(fraction,freeze);n.x=start.x+vx*dt*travel;n.y=start.y+vy*dt*travel;p.status='frozen';p.events.push({kind:'freeze',time:time+dt*freeze,x:n.x,y:n.y,eyes:before.eyes.map((e,i)=>interpolate(e,after.eyes[i],freeze)),fraction:freeze});}
 else{n.x=mid.x;n.y=mid.y;if(p.status==='moving'&&fraction<1){p.status='paused';p.events.push({kind:'no-toward-pause',time:time+dt*fraction,x:n.x,y:n.y,eyes:eyesMid,fraction});}}
 n.vx=p.status==='moving'?vx:0;n.vy=p.status==='moving'?vy:0;p.steps++;
 const m=after.mouths[0];p.trace.push([p.steps/240,n.x,n.y,p.status==='moving'?0:p.status==='paused'?1:2,p.heading,after.com.x,after.com.y,m.x,m.y,mouthGap(o,n),...after.eyes.flatMap(e=>[e.x,e.y]),Math.min(...after.eyes.map(e=>Math.hypot(e.x-n.x,e.y-n.y)))]);
 if(![n.x,n.y,n.vx,n.vy,...p.trace.at(-1)!].every(Number.isFinite))throw Error('Nonfinite pursuit state');
}
export function validatePursuit(state:SimulationState){
 const p=state.pursuit;if(!p||p.version!=='moving-nutrient-v1'||p.schedule.length!==10||p.schedule.some(d=>typeof d.stop!=='boolean'||!Number.isFinite(d.offset)||Math.abs(d.offset)>Math.PI/2)||!Number.isInteger(p.steps)||p.steps<0||!['moving','paused','frozen'].includes(p.status)||p.trace.length!==p.steps||p.stockJ!==3000||p.reservoirInputJ<0||state.organisms.length!==1||!state.organisms.some(o=>o.id===p.organismId)||!state.nutrients.some(n=>n.id===p.nutrientId&&n.energyValue===p.stockJ&&n.radius===p.radius))throw Error('Invalid saved moving source');
}
