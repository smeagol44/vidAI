import assert from 'node:assert/strict';
import {test} from 'node:test';
import {matchedWrench,matchedImplicit,prescribedDragGrid,MATCHED_UNITS} from '../matchedDrag';
import {matchedFixture,runMatchedBenchmark as run} from '../matchedBenchmark';
import {rectangleContact} from '../contacts';
import {validateGenome} from '../persistence';
test('identical velocity drag wrenches dissipate, rotate covariantly and share one unit conversion',()=>{
 const grid=prescribedDragGrid();for(const r of grid.rows)assert.ok(r.powerJPerS<=1e-15);
 for(const law of ['v3','v4'] as const){
  const a=matchedWrench({width:1,height:7},5,-3,.7,0,law),ang=.37,c=Math.cos(ang),s=Math.sin(ang);
  const b=matchedWrench({width:1,height:7},5*c+3*s,5*s-3*c,.7,ang,law);
  assert.ok(Math.abs(b.fx-a.fx*c+a.fy*s)<1e-12&&Math.abs(b.fy-a.fx*s-a.fy*c)<1e-12);
  assert.ok(Math.abs(b.torque-a.torque)<1e-12);
  const p={width:1,height:7},m=.35,I=m*50/12,dt=1/240;
  const d=matchedImplicit(p,m,I,5,-3,.7,0,dt,law),J=MATCHED_UNITS.joulesPerUnit;
  const before=(.5*m*34+.5*I*.49)*J,after=(.5*m*(d.vx*d.vx+d.vy*d.vy)+.5*I*d.omega*d.omega)*J;
  assert.ok(Math.abs(before-after-d.physicalJ-d.numericalJ)<1e-15);
 }
});
test('paddles have independent hinges and clear their prescribed shape domain without save relaxation',()=>{
 const {o,anchors}=matchedFixture('paddles');assert.throws(()=>validateGenome(o.genome),/dimensions/);
 assert.equal(o.genome.parts[1].parentIndex,0);assert.equal(o.genome.parts[2].parentIndex,0);
 for(let a=-30;a<=30;a+=3)for(let b=-30;b<=30;b+=3){
  for(const [j,deg] of [a,b].entries()){
   const p=o.segments[j+1],phi=deg*Math.PI/180,c=Math.cos(phi),s=Math.sin(phi),d=anchors[j];p.angle=phi;
   p.x=1200+d.parent.x-c*d.child.x+s*d.child.y;p.y=750+d.parent.y-s*d.child.x-c*d.child.y;
  }
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok((rectangleContact(o.segments[i],o.genome.parts[i],o.segments[j],o.genome.parts[j])?.depth??0)<1e-10);
 }
});
test('matched laws share exact starting reference/tape/capacity; private costs exclude biology and preserve work',()=>{
 const request={version:'matched-drag-v1' as const,body:'paddles' as const,law:'v3' as const,integration:'explicit' as const,substeps:4 as const,cycles:1 as const};
 const native=run(request);
 for(const law of ['v3','v4'] as const)for(const integration of ['explicit','implicit'] as const){
  const r=run({...request,law,integration,tape:native.tape});
  assert.deepEqual(r.reference,native.reference);assert.deepEqual(r.initialState,native.initialState);assert.deepEqual(r.tape,native.tape);
  assert.equal(r.metabolicJ,0);assert.equal(r.energyLimited,0);assert.equal(r.torqueMismatch,0);
  assert.ok(Math.abs(r.motorJ-4*r.positiveJ)<1e-12&&Math.abs(r.motorJ-r.ledgerMotorJ)<1e-12);
  assert.ok(r.maxChemicalErrorJ<1e-8&&Math.abs(r.mechanicalResidualJ!)<1e-12);
  const quiet=run({...request,law,integration,tape:native.tape,audit:false});assert.deepEqual(quiet.finalState,r.finalState);
 }
 const p=run({...request,law:'v4',passive:true});assert.ok(p.displacementPx<1e-9);assert.equal(p.motorJ,0);
 assert.throws(()=>run({...request,tape:native.tape.map((row,i)=>i===959?[row[0],NaN]:row)}),/Invalid/);
});
