/** Independent generalized-coordinate impulse/work reconstruction from receipts.
 * Imports no simulation/solver functions. Does not execute a simulation. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const JOULES=8.575e-10,KG=8.575e-4,L=.001;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const q=p=>[p.vx,p.vy,p.omega];
const flat=ps=>ps.flatMap(q);
const cross=(x,y,u,v)=>x*v-y*u;
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const records=JSON.parse(gunzipSync(readFileSync('docs/experiments/solver-event-windows-v1.json.gz')));
const input=JSON.parse(readFileSync('docs/experiments/prism-integration-v1-CUR-006.json'));
const defs=input.snapshot.state.organisms[0].genome.parts;
const report={protocol:'solver-event-independent-checks-v1',source:records.source,tolerances:{algebraRelative:1e-10,workResidualJ:1e-14,anchorBias:'4*EPSILON*sum(abs(world-coordinate terms))*.35*Hz plus algebra roundoff'},windows:[]};
for(const window of records.windows) {
 const es=window.measured.solverTrace.events,reference=es.find(e=>e.stage==='body-reference').parts;
 const stat={counts:{},maxRelativeError:{},maxWorkResidualJ:0,maxContactGainJ:0,maxJointGainJ:0,maxProjectionEnergyChangeJ:0,maxProjectionVelocityChange:0,
  maxContactCorrectionAngularMomentumChangeJs:0,maxContactCorrectionEnergyChangeJ:0,maxProjectionComShiftPx:0,maxProjectionAngularMomentumChangeJs:0,maxContactLinearMomentumErrorKgMS:0,maxContactAngularMomentumErrorJs:0,
  contactWorkJ:0,jointNetWorkJ:0,projectionSamples:0,guardLossJ:0,contacts:[],firstOverspeed:null};
 const mass=reference.map(r=>r.mass),inertia=reference.map(r=>r.inertia);
 const fail=[];
 function check(label,actual,expected,tol=1e-10,absoluteBound=0) {
  if(Array.isArray(actual)){actual.forEach((x,i)=>check(label,x,expected[i],tol,Array.isArray(absoluteBound)?absoluteBound[i]:absoluteBound));return;}
  const relative=Math.abs(actual-expected)/Math.max(1,Math.abs(actual),Math.abs(expected));
  stat.maxRelativeError[label]=Math.max(stat.maxRelativeError[label]??0,relative);
  if(!Number.isFinite(relative)||Math.abs(actual-expected)>tol*Math.max(1,Math.abs(actual),Math.abs(expected))+absoluteBound)fail.push({label,actual,expected,relative});
 }
 function workCheck(actual,expected) {const error=Math.abs(actual-expected);stat.maxWorkResidualJ=Math.max(stat.maxWorkResidualJ,error);if(error>1e-14)fail.push({label:'work',actual,expected,error});}
 const energy=(parts,indices=parts.map((_,i)=>i))=>parts.reduce((sum,p,i)=>sum+.5*(mass[indices[i]]*(p.vx*p.vx+p.vy*p.vy)+inertia[indices[i]]*p.omega*p.omega)*JOULES,0);
 const com=parts=>{const m=mass.reduce((a,b)=>a+b,0);return [parts.reduce((s,p,i)=>s+mass[i]*p.x,0)/m,parts.reduce((s,p,i)=>s+mass[i]*p.y,0)/m];};
 const momentum=(parts,indices,origin=[0,0])=>parts.reduce((s,p,i)=>{
  const m=mass[indices[i]],I=inertia[indices[i]];s[0]+=m*p.vx*KG*L;s[1]+=m*p.vy*KG*L;
  s[2]+=(m*cross(p.x-origin[0],p.y-origin[1],p.vx,p.vy)+I*p.omega)*JOULES;return s;
 },[0,0,0]);
 function generalized(event,indices,rows,impulses) {
  const inv=indices.flatMap(i=>[1/mass[i],1/mass[i],1/inertia[i]]),before=flat(event.before),after=flat(event.after);
  const k=rows.map(a=>rows.map(b=>dot(a.map((x,i)=>x*inv[i]),b))),relative=rows.map(row=>dot(row,before));
  const predicted=before.map((v,i)=>v+inv[i]*dot(rows.map(row=>row[i]),impulses));
  check('velocityImpulse',after,predicted);
  const delta=energy(event.after,indices)-energy(event.before,indices),expected=(dot(impulses,relative)+.5*dot(impulses,k.map(row=>dot(row,impulses))))*JOULES;
  workCheck(delta,expected);return {k,relative,delta,inv};
 }
 const localAnchor=(def,dir)=>({EAST:[def.width/2,0],WEST:[-def.width/2,0],NORTH:[0,-def.height/2],SOUTH:[0,def.height/2]})[dir];
 const rotate=(v,a)=>[Math.cos(a)*v[0]-Math.sin(a)*v[1],Math.sin(a)*v[0]+Math.cos(a)*v[1]];
 const opposite={EAST:'WEST',WEST:'EAST',NORTH:'SOUTH',SOUTH:'NORTH'};
 for(const r of reference) {
  const siMass=1000*(r.width*L)*(r.height*L)*.007,siInertia=siMass*((r.width*L)**2+(r.height*L)**2)/12;
  check('massUnits',r.mass*KG,siMass);check('inertiaUnits',r.inertia*JOULES,siInertia);
  check('inverseMass',r.inverseMass,1/r.mass);check('inverseInertia',r.inverseInertia,1/r.inertia);
 }
 for(const e of es) {
  stat.counts[e.stage]=(stat.counts[e.stage]??0)+1;
  if(e.stage==='joint-anchor') {
   const [rpX,rpY,rcX,rcY]=e.arms,rows=[[-1,0,rpY,1,0,-rcY],[0,-1,-rpX,0,1,rcX]];
   const g=generalized(e,[e.parent,e.child],rows,e.impulse),[[a,b],[,d]]=g.k;
   check('anchorEffectiveInverse',e.effectiveInverse,[a,b,d]);check('anchorRelativeSpeed',e.relative,g.relative);
   check('anchorImpulseResidual',g.k.map(row=>dot(row,e.impulse)),g.relative.map((x,i)=>-x-e.bias[i]));
   const cd=defs[e.child],pd=defs[e.parent],ap=rotate(localAnchor(pd,cd.attachmentPoint),e.before[0].angle),ac=rotate(localAnchor(cd,opposite[cd.attachmentPoint]),e.before[1].angle);
   check('anchorArms',e.arms,[...ap,...ac]);
   const biasExpected=[(e.before[1].x-e.before[0].x+ac[0]-ap[0])*.35*e.hz,(e.before[1].y-e.before[0].y+ac[1]-ap[1])*.35*e.hz];
   const biasBound=[Math.abs(e.before[1].x)+Math.abs(e.before[0].x)+Math.abs(ac[0])+Math.abs(ap[0]),
    Math.abs(e.before[1].y)+Math.abs(e.before[0].y)+Math.abs(ac[1])+Math.abs(ap[1])].map(x=>4*Number.EPSILON*x*.35*e.hz);
   check('anchorBias',e.bias,biasExpected,0,biasBound);
  }else if(e.stage==='joint-limit') {
   const g=generalized(e,[e.parent,e.child],[[0,0,-1,0,0,1]],[e.impulse]);
   check('limitEffectiveInverse',e.effectiveInverse,g.k[0][0]);check('limitImpulseResidual',e.impulse*g.k[0][0],-g.relative[0]-e.bias);
   const rel=wrap(e.before[1].angle-e.before[0].angle-defs[e.child].baseAngleOffset),excess=Math.sign(rel)*(Math.abs(rel)-defs[e.child].maxAngle);
   check('limitBias',e.bias,.2*e.hz*excess);
  }else if(e.stage==='contact-impulse') {
   const indices=[e.a.part,e.b.part],[a,b]=e.before,{nx,ny,x,y,depth}=e.contact;
   check('unitNormal',nx*nx+ny*ny,1);
   if(depth<=0||(b.x-a.x)*nx+(b.y-a.y)*ny<0)fail.push({label:'contactNormalOrientation',depth});
   for(let k=0;k<2;k++) {
    const p=e.before[k],d=defs[indices[k]],c=Math.cos(p.angle),s=Math.sin(p.angle),u=(x-p.x)*c+(y-p.y)*s,v=-(x-p.x)*s+(y-p.y)*c;
    if(Math.abs(u)>d.width/2+1e-9||Math.abs(v)>d.height/2+1e-9)fail.push({label:'contactOutsideBody',part:indices[k],u,v});
   }
   const ra=[x-a.x,y-a.y],rb=[x-b.x,y-b.y],ca=cross(...ra,nx,ny),cb=cross(...rb,nx,ny);
   const row=[-nx,-ny,-ca,nx,ny,cb],inv=indices.flatMap(i=>[1/mass[i],1/mass[i],1/inertia[i]]),eff=dot(row.map((x,i)=>x*inv[i]),row),vn=dot(row,flat(e.before));
   const impulse=vn<0?-vn/eff:0,g=generalized(e,indices,[row],[impulse]);
   check('contactInverseMass',e.inverseMass,indices.map(i=>1/mass[i]));check('contactInverseInertia',e.inverseInertia,indices.map(i=>1/inertia[i]));
   check('contactRestitution',dot(row,flat(e.after)),Math.max(0,vn));workCheck(g.delta,vn<0?-.5*vn*vn/eff*JOULES:0);
   const before=momentum(e.before,indices,[x,y]),after=momentum(e.after,indices,[x,y]);
   stat.maxContactLinearMomentumErrorKgMS=Math.max(stat.maxContactLinearMomentumErrorKgMS,Math.hypot(after[0]-before[0],after[1]-before[1]));
   stat.maxContactAngularMomentumErrorJs=Math.max(stat.maxContactAngularMomentumErrorJs,Math.abs(after[2]-before[2]));
   stat.maxContactGainJ=Math.max(stat.maxContactGainJ,g.delta);stat.contactWorkJ+=g.delta;
   stat.contacts.push({startTime:e.startTime,endTime:e.endTime,iteration:e.iteration,pair:indices,depth,normal:[nx,ny],point:[x,y],arms:[ca,cb],normalSpeed:vn,
    impulseMpxS:impulse,impulseNS:impulse*KG*L,effectiveMassM:1/eff,effectiveMassKg:KG/eff,workJ:g.delta,beforeOmega:e.before.map(p=>p.omega),afterOmega:e.after.map(p=>p.omega)});
  }else if(e.stage==='joint-accept') {
   const before=energy(e.before),provisional=energy(e.provisional),after=energy(e.after);
   workCheck(provisional-before,(e.linear+e.quadratic)*JOULES);workCheck(after-before,(e.scale*e.linear+e.scale*e.scale*e.quadratic)*JOULES);
   const scale=e.linear+e.quadratic<=0?1:e.linear>=0||e.quadratic<=0?0:Math.min(1,-e.linear/e.quadratic*(1-16*Number.EPSILON));check('passiveScale',e.scale,scale);
   e.before.forEach((p,i)=>check('acceptedVelocity',q(e.after[i]),q(p).map((v,j)=>v+e.scale*(q(e.provisional[i])[j]-v))));
   stat.jointNetWorkJ+=after-before;stat.maxJointGainJ=Math.max(stat.maxJointGainJ,after-before);
   if(!stat.firstOverspeed&&e.maxOmega>20.001)stat.firstOverspeed={time:e.endTime,startTime:e.startTime,beforeJ:before,afterJ:after,deltaJ:after-before,scale:e.scale,
    beforeOmega:e.before.map(p=>p.omega),afterOmega:e.after.map(p=>p.omega),linear:e.linear*JOULES,quadratic:e.quadratic*JOULES};
  }else if(e.stage==='joint-pose'||e.stage==='contact-projection') {
   stat.projectionSamples++;const d=energy(e.after)-energy(e.before),ac=com(e.before),bc=com(e.after);
   stat.maxProjectionEnergyChangeJ=Math.max(stat.maxProjectionEnergyChangeJ,Math.abs(d));
   stat.maxProjectionComShiftPx=Math.max(stat.maxProjectionComShiftPx,Math.hypot(ac[0]-bc[0],ac[1]-bc[1]));
   const indices=e.before.map((_,i)=>i),ma=momentum(e.before,indices,ac),mb=momentum(e.after,indices,ac);
   stat.maxProjectionAngularMomentumChangeJs=Math.max(stat.maxProjectionAngularMomentumChangeJs,Math.abs(ma[2]-mb[2]));
   e.before.forEach((p,i)=>{stat.maxProjectionVelocityChange=Math.max(stat.maxProjectionVelocityChange,...q(p).map((v,j)=>Math.abs(v-q(e.after[i])[j])));check('projectionVelocity',q(p),q(e.after[i]));});
  }else if(e.stage==='contact-correction') {
   const ids=[e.a.part,e.b.part],expected=Math.min(3,Math.max(0,e.contact.depth-.02)*.6)/(1/mass[ids[0]]+1/mass[ids[1]]);
   check('contactPositionCorrection',e.correction,expected);
   const origin=[e.contact.x,e.contact.y],pa=momentum(e.before,ids,origin),pb=momentum(e.after,ids,origin);
   stat.maxContactCorrectionAngularMomentumChangeJs=Math.max(stat.maxContactCorrectionAngularMomentumChangeJs,Math.abs(pa[2]-pb[2]));
   stat.maxContactCorrectionEnergyChangeJ=Math.max(stat.maxContactCorrectionEnergyChangeJ,Math.abs(energy(e.after,ids)-energy(e.before,ids)));
   e.before.forEach((p,i)=>check('positionCorrectionVelocity',q(p),q(e.after[i])));
  }else if(e.stage==='guard') {
   check('guardPlacement',e.after.omega,Math.max(-20,Math.min(20,e.before.omega)));
   const i=e.part,d=energy([e.after],[i])-energy([e.before],[i]);stat.guardLossJ-=d;if(d>1e-14)fail.push({label:'guardGain',d});
  }else if(e.stage==='physics-fluid') {
   workCheck(e.beforeJ-e.afterJ,e.physicalDissipationJ+e.numericalDissipationJ);
  }
 }
 report.windows.push({name:window.name,hz:window.measured.hz,startTime:window.startTime,endTime:window.endTime,reference,checks:stat,failures:fail,
  energy:{motorJ:window.measured.motorJ,positiveJ:window.measured.positiveJ,brakingJ:window.measured.brakingJ,maxChemicalErrorJ:window.measured.maxChemicalErrorJ,
   requestMismatch:window.measured.mismatches,energyLimited:window.measured.energyLimited,observedUnobservedExact:window.observedUnobservedExact}});
}
report.passed=report.windows.every(w=>w.failures.length===0);
writeFileSync('docs/experiments/solver-event-checks-v1.json',JSON.stringify(report,null,2)+'\n');
for(const w of report.windows)console.log(JSON.stringify({name:w.name,hz:w.hz,failures:w.failures.slice(0,8),maxRelative:w.checks.maxRelativeError,
 maxWorkResidualJ:w.checks.maxWorkResidualJ,maxContactGainJ:w.checks.maxContactGainJ,maxJointGainJ:w.checks.maxJointGainJ,
 projectionAngularMomentumJs:w.checks.maxProjectionAngularMomentumChangeJs,firstOverspeed:w.checks.firstOverspeed,firstContact:w.checks.contacts[0]}));
if(!report.passed)throw Error('Solver receipt identity failure; inspect raw data, do not promote or relax existing gates');
