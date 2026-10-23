/** Opt-in read-only post-tick observations. Never supplied to the controller. */
import type {SimulationHost} from '../simulationHost';
import {CONTINUOUS_EAT_RATE,OMNIVORE_EAT_RATE} from '../simulation';
export function createFoodObservation(host:SimulationHost){
 const initialFoodJ=host.state.nutrients.reduce((s,n)=>s+n.energyValue,0),initialCount=host.state.nutrients.length;
 let nutrientRaySamples=0,detectionTicks=0,contactTicks=0,intakeTicks=0,absorbedJ=0,firstDetectionTick:number|null=null,firstContactTick:number|null=null,firstIntakeTick:number|null=null;
 const afterTick=(tick:number)=>{
  let sees=false,contact=false,eats=false;
  for(const o of host.state.organisms){
   const hits=o.rayHits.filter(r=>r.objectType==='nutrient').length;nutrientRaySamples+=hits;sees ||= hits>0;
   for(const m of o.genome.mouths){const f=o.mouthFeedback?.[m.id];contact ||= !!f?.contact;eats ||= !!f?.intake;
    absorbedJ+=(f?.intake??0)*(m.mouthType==='omnivore'?OMNIVORE_EAT_RATE:CONTINUOUS_EAT_RATE)/60;}
  }
  if(sees){detectionTicks++;firstDetectionTick??=tick+1;}if(contact){contactTicks++;firstContactTick??=tick+1;}if(eats){intakeTicks++;firstIntakeTick??=tick+1;}
 };
 return{afterTick,report:()=>{const s=host.state,grossFoodJ=initialFoodJ-s.nutrients.reduce((sum,n)=>sum+n.energyValue,0);
  return{initialCount,finalCount:s.nutrients.length,initialFoodJ,grossFoodJ,absorbedJ,assimilationLossJ:grossFoodJ-absorbedJ,nutrientRaySamples,detectionTicks,contactTicks,intakeTicks,firstDetectionTick,firstContactTick,firstIntakeTick,
   learnedMotorL1:s.organisms.reduce((sum,o)=>sum+(o.learnedMotorWeights??[]).reduce((v,e)=>v+Math.abs(e.delta),0),0),
   learnedSensoryL1:s.organisms.reduce((sum,o)=>sum+(o.learnedSensoryWeights??[]).reduce((v,e)=>v+Math.abs(e.delta),0),0)};}};
}
