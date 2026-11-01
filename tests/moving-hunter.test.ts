import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {LEGACY_SETTINGS, totalAccountedEnergy, validateGenome} from '../persistence';
import {EcologyIntakeObserver} from '../ecologyAudit';

const settings = {...LEGACY_SETTINGS,targetNutrients:0,inflowRate:0,mutationSeverity:0,kinshipProtection:false};
type Response = 'connected'|'disconnected';
function hunterGenomeFor(hunterSpeed:number,powered=true){
 const g=createFounderGenome('FND-001','unbiased');
 g.maturityAge=1000;
 g.motorFrequency*=hunterSpeed;
 g.mouths[0].mouthType='omnivore';
 g.mouths[0].intakeWidth=8;g.mouths[0].intakeLength=30;
 if(!powered)g.motorForce=0;
 g.bodyCost=sim.calculateBodyCost(g.parts,g.eyes,g.mouths);
 assert.deepEqual(validateGenome(g),g,'the physical fixture must obey the current diet/diameter contract');
 return g;
}
function observeMotion(org:sim.Organism){
 let previous=sim.calculateOrganismCOM(org),pathPx=0,motorJ=0,jointExcursion=0,maxTorque=0;
 const relativeAngles=()=>org.segments.slice(1).map((p,i)=>p.angle-org.segments[org.genome.parts[i+1].parentIndex].angle);
 const initialAngles=relativeAngles();
 return {
   sample(){
     const next=sim.calculateOrganismCOM(org);
     pathPx+=Math.hypot(next.x-previous.x,next.y-previous.y);previous=next;
     motorJ+=org.motorEnergyRate/60;
     for(const [i,angle] of relativeAngles().entries())
       jointExcursion=Math.max(jointExcursion,Math.abs(Math.atan2(Math.sin(angle-initialAngles[i]),Math.cos(angle-initialAngles[i]))));
     for(const joint of org.joints)maxTorque=Math.max(maxTorque,Math.abs(joint.appliedTorque));
   },
   result(){return {pathPx,motorJ,jointExcursion,maxTorque};},
 };
}
function assertSwimming(row:{motion:ReturnType<ReturnType<typeof observeMotion>['result']>},minimumPath:number){
 assert.ok(row.motion.pathPx>minimumPath,'actual COM path must show motion even when the swimmer returns near its start');
 assert.ok(row.motion.motorJ>0&&row.motion.maxTorque>0,'swimming must use paid physical joint torques');
 assert.ok(row.motion.jointExcursion>1e-6,'the articulated body must actually change relative joint angles');
}
function trial(response:Response, hunterSpeed:number, separation:number, hunterAngle=0, preyId='FND-001', steps=180, placeByRearEdge=false){
 const state=createInitialWorld(settings,733,'unbiased','standard',0);
 const preyGenome=createFounderGenome(preyId,'unbiased');
 preyGenome.maturityAge=1000;
 let circuitSeed=13;
 if(preyId!=='FND-001'){
   for(let seed=1;seed<175;seed++){
     const copy=structuredClone(preyGenome);
     if(!sim.mutateBrainTopology(copy,'wire-injury-motor',new sim.XoshiroPRNG(seed))) continue;
     const h=copy.hiddenIds!.length-1, input=copy.inputKeys!.indexOf('body:injury');
     const amp=copy.outputKeys!.findIndex(key=>key.endsWith(':Amp'));
     const sensory=copy.weightsIH[h][input], motor=copy.weightsHO[amp][h];
     if(sensory*motor>3 && !copy.disabledConnections!.includes(sim.brainEdgeKey('ho',copy.outputKeys![amp],copy.hiddenIds![h]))) {
       circuitSeed=seed; break;
     }
   }
 }
 const ctrl=sim.mutateBrainTopology(preyGenome,'wire-injury-motor',new sim.XoshiroPRNG(circuitSeed));
 assert.equal(ctrl,true);
 const injury=preyGenome.inputKeys!.indexOf('body:injury'),h=preyGenome.hiddenIds!.length-1;
 if(response==='disconnected')preyGenome.weightsIH[h][injury]=0;
 assert.deepEqual(validateGenome(preyGenome),preyGenome);
 const prey=addExternalOrganism(state,preyGenome,settings,1200,750,0)!;
 const hunterGenome=hunterGenomeFor(hunterSpeed);
 const rearEdge=Math.min(...prey.segments.map((p,i)=>p.x-prey.genome.parts[i].width/2));
 const hunterX=placeByRearEdge ? rearEdge - hunterGenome.parts[0].width/2 + separation : 1200-separation;
 assert.ok(Number.isFinite(hunterX),'test placement must be a real physical location');
 const hunter=addExternalOrganism(state,hunterGenome,settings,hunterX,750,hunterAngle)!;
 const hunterStart=sim.calculateOrganismCOM(hunter),preyStart=sim.calculateOrganismCOM(prey);
 const initialTotal=totalAccountedEnergy(state);
 assert.equal(hunter.structuralBiomass,hunterGenome.bodyCost,'construction must be funded');
 const motion=observeMotion(hunter),intake=new EcologyIntakeObserver();
 let biteJ=0,hitTicks=0,peakSignal=0,peakCircuit=0;
 for(let t=0;t<steps;t++){
  const queued=prey.biteFeedbackJ??0;
  sim.stepSimulation(state,settings,1/60);
  motion.sample();intake.sample(state);
  assert.equal(prey.neuralInputs[injury],Math.min(1,queued/60),
    'injury must equal the preceding actual bite, never proximity or ordinary metabolism');
  const taken=prey.biteFeedbackJ??0;
  if(taken>0)assert.ok(hunter.mouthFeedback?.[hunterGenome.mouths[0].id].contact,
    'predation must require actual oral contact');
  biteJ+=taken;if(taken>0)hitTicks++;
  peakSignal=Math.max(peakSignal,prey.neuralInputs[injury]??0);
  peakCircuit=Math.max(peakCircuit,Math.abs(prey.neuralHidden[h]));
 }
 const endH=sim.calculateOrganismCOM(hunter),endP=sim.calculateOrganismCOM(prey);
 assert.ok(Math.abs(totalAccountedEnergy(state)-initialTotal)<.0001);
 const absorbedJ=intake.perOrganismTotals()[hunter.id]?.Prey??0;
 assert.ok(Math.abs(absorbedJ-biteJ*sim.MOUTH_ASSIMILATION)<1e-8,
   'all removed prey reserve must reconcile with actual predator absorption');
 if(response==='disconnected')assert.equal(peakCircuit,0,'the isolated injury pathway must stay silent when disconnected');
 else if(peakSignal>0)assert.ok(peakCircuit>0,'a sensed bite must actually activate the inherited circuit');
 return {motion:motion.result(),absorbedJ,peakCircuit,response,hunterSpeed,separation,hunterAngle,preyId,circuitSeed,biteJ:+biteJ.toFixed(2),hitTicks,peakSignal:+peakSignal.toFixed(2),
   hunterDx:+(endH.x-hunterStart.x).toFixed(1),preyDx:+(endP.x-preyStart.x).toFixed(1),
   hunterDy:+(endH.y-hunterStart.y).toFixed(1),preyDy:+(endP.y-preyStart.y).toFixed(1),
   finalSeparation:+Math.hypot(endH.x-endP.x,endH.y-endP.y).toFixed(1),surviving:!prey.dissolving,
   predatorEnergy:hunter.energy, victimEnergy:prey.energy};
}

test('hunter locomotion is self-propelled by funded articulation in empty water, with motionless motor-off controls',()=>{
 const controls=[];
 for(const speed of [1,1.5,2.2])for(const powered of [false,true]){
   const state=createInitialWorld(settings,733,'unbiased','standard',0);
   const org=addExternalOrganism(state,hunterGenomeFor(speed,powered),settings,1200,750,0)!;
   const initial=totalAccountedEnergy(state),motion=observeMotion(org);
   for(let tick=0;tick<120;tick++){sim.stepSimulation(state,settings,1/60);motion.sample();}
   const result=motion.result();
   assert.ok(Math.abs(totalAccountedEnergy(state)-initial)<.0001);
   if(powered)assertSwimming({motion:result},15);
   else{
     assert.ok(result.pathPx<1e-8,'no passive contact, prescribed movement or unpowered drift may impersonate swimming');
     assert.equal(result.motorJ,0);assert.equal(result.maxTorque,0);
     assert.ok(result.jointExcursion<1e-8);
   }
   controls.push({speed,powered,...result});
 }
 console.log('PHASE5C_UNASSISTED_MOTION '+JSON.stringify(controls));
});
test('a mobile, swimming hunter exposes protective and harmful inherited bite responses', () => {
 const results=[];
 let wins=0,losses=0,ties=0,contacts=0,untouched=0;
 for(const hunterSpeed of [1,1.5,2.2])for(const separation of [82,94,106,118,130]) {
   const connected=trial('connected',hunterSpeed,separation);
   const disconnected=trial('disconnected',hunterSpeed,separation);
   assertSwimming(connected,15);assertSwimming(disconnected,15);
   assert.ok(connected.surviving && disconnected.surviving);
   if(disconnected.biteJ===0) {
     assert.equal(connected.biteJ,0,'no bite is not evidence of escaping one');
     untouched++;
   } else {
     assert.ok(connected.peakSignal>0 && disconnected.peakSignal>0);
     contacts++;
     if(connected.biteJ<disconnected.biteJ) wins++;
     else if(connected.biteJ>disconnected.biteJ) losses++;
     else ties++;
   }
   results.push({speed:hunterSpeed,startSeparation:separation,withInjury:connected.biteJ,
     withoutInjury:disconnected.biteJ,hunterTravel:connected.hunterDx,
     withMotion:connected.motion,withoutMotion:disconnected.motion,
     withSeparation:connected.finalSeparation,withoutSeparation:disconnected.finalSeparation});
 }
 assert.equal(contacts+untouched,results.length);
 assert.ok(contacts>0&&untouched>0,'the fixed scenarios must cover actual biting and true noncontact controls');
 // Encounter proportions depend on the aperture; both signs remain required.
 assert.ok(wins>=1 && losses>=1 && ties>=1,
   'a somatic circuit is useful in some moving encounters, but not universally protective');
 console.log('PHASE5C_MOBILE_VALIDATION '+JSON.stringify({wins,losses,ties,untouched,results}));
});

test('five morphologies show both beneficial and harmful physical injury responses, not universal escape', () => {
 const observations=[];
 let wins=0,losses=0,ties=0;
 for(const preyId of ['FND-001','FND-006','FND-021','FND-031','FND-051']) {
   for(const overlap of [3,6,9]) {
     const connected=trial('connected',1.5,overlap,0,preyId,120,true);
     const disconnected=trial('disconnected',1.5,overlap,0,preyId,120,true);
     assert.ok(Number.isFinite(connected.finalSeparation)&&Number.isFinite(disconnected.finalSeparation));
     assert.ok(connected.biteJ>0 && disconnected.biteJ>0,
       'all included body geometries must have real predation');
     assertSwimming(connected,1);assertSwimming(disconnected,1);
     assert.ok(connected.peakSignal>0 && disconnected.peakSignal>0);
     if(connected.biteJ<disconnected.biteJ) wins++;
     else if(connected.biteJ>disconnected.biteJ) losses++;
     else ties++;
     observations.push({preyId,rearOverlap:overlap,withInjury:connected.biteJ,
       withoutInjury:disconnected.biteJ,hunterTravel:connected.hunterDx,
       withMotion:connected.motion,withoutMotion:disconnected.motion,
       withSeparation:connected.finalSeparation,withoutSeparation:disconnected.finalSeparation});
   }
 }
 assert.equal(observations.length,15);
 assert.ok(wins>=1 && losses>=1 && ties>=1,
   'one inherited neural circuit must not be advertised as broadly beneficial');
 console.log('PHASE5C_MULTIMORPH_VALIDATION '+JSON.stringify({wins,losses,ties,observations}));
});
