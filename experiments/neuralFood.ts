/** Corrected #63 offline experiment. No imported scores or target cues in live ecology. */
import {initialNetwork as previousFresh,mutateNetwork,mutationSeed,BUDGET,TRAINING,HELD_OUT,START_SEEDS,GATES,parameterCount,chooseElite} from './neuralSelection';
import {remapBrain,addNutrients,nutrientBloomCenters,XoshiroPRNG,type Genome,type SimulationSettings} from '../simulation';
import {createInitialWorld,addExternalOrganism} from '../world';
import {createSnapshot,DEFAULT_SETTINGS,validateGenome} from '../persistence';
import {selectionMetrics} from './selectionMetrics';
export {BUDGET,TRAINING,HELD_OUT,START_SEEDS,GATES,parameterCount,chooseElite,mutationSeed};
export const FOOD_ARCHITECTURES=['oscillator-only','direct-only','two-output'] as const;
export type FoodArchitecture=typeof FOOD_ARCHITECTURES[number];
export const ENVIRONMENTS=['A','B','C'] as const;
export type FoodEnvironment=typeof ENVIRONMENTS[number];
export function foodNetwork(architecture:FoodArchitecture,seed:number):Genome{
 const latent=previousFresh('signed',seed),g=structuredClone(latent);
 g.motorController={version:'neural-motor-v1',architecture,hysteresisWidth:.06};remapBrain(g,latent);
 const count=architecture==='two-output'?2:1;
 for(let j=0;j<g.parts.length-1;j++)for(let channel=0;channel<count;channel++){
  const source=j*3+(count===2&&channel===0?0:1),target=j*count+channel;
  g.weightsHO[target]=[...latent.weightsHO[source]];g.biasesO[target]=latent.biasesO[source];
 }
 return validateGenome(g);
}
export function foodMutation(parent:Genome,key:number,index:number){
 // No hybrid selector special case: EVERY offspring has EIGHT neural events.
 return mutateNetwork(parent,'signed',key,index);
}
export function foodSource(g:Genome,environment:FoodEnvironment,c:{seed:number;heading:number;viscosity:number;seconds:number}=TRAINING,passive=false){
 const config:SimulationSettings={...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',motorExperiment:'neural-motor-v1',worldWidth:4800,worldHeight:3000,targetNutrients:0,inflowRate:0,mutationSeverity:0,gravity:0,waterViscosity:c.viscosity,mouthContactModel:'capsule-v1'};
 const genome=structuredClone(g),architecture=genome.motorController!.architecture;
 if(passive)for(let i=0;i<genome.outputKeys!.length;i++){
  genome.weightsHO[i].fill(0);genome.biasesO[i]=architecture==='oscillator-only'?-20:architecture==='two-output'&&i%2===0?-3:0;
 }
 const s=createInitialWorld(config,c.seed,'balanced','standard',0),o=addExternalOrganism(s,genome,config,2400,1500,c.heading)!;
 s.ledger.externalInflow+=BUDGET.reserveJ-o.energy;o.energy=BUDGET.reserveJ;
 // Use ordinary funded nutrient objects. Inflow remains zero, so no respawn.
 config.targetNutrients=environment==='C'?800:environment==='B'?1:0;
 addNutrients(s,config,config.targetNutrients);
 if(environment==='B'){s.nutrients[0].x=2400+60*Math.cos(c.heading);s.nutrients[0].y=1500+60*Math.sin(c.heading);}
 if(environment==='C'){
  const r=new XoshiroPRNG(c.seed^0x36e2079b),sites=nutrientBloomCenters(s,config);
  // Deterministic first200 of800: 25% mildly clustered,75% ordinary uniform.
  for(let i=0;i<200;i++){const site=sites[r.rangeInt(0,sites.length-1)];s.nutrients[i].x=Math.max(40,Math.min(4760,site.x+r.range(-400,400)));s.nutrients[i].y=Math.max(40,Math.min(2960,site.y+r.range(-400,400)));}
 }
 return createSnapshot(s,config);
}
export function foodMetrics(r:any,seconds:number){
 // Adapt the old read-only validity reducer: food is now permitted, eggs are not.
 const base=selectionMetrics({...r,snapshot:{...r.snapshot,state:{...r.snapshot.state,nutrients:[]}}},seconds),f=r.foodAudit;
 if(!f)throw new Error('Food observation required');
 const partitionResidualJ=base.spentJ+f.grossFoodJ-base.motorJ-base.metabolicJ;
 const reasons=[...base.reasons];if(Math.abs(partitionResidualJ)>=GATES.chemicalJ)reasons.push('food/work partition');
 if(f.grossFoodJ< -1e-6||f.absorbedJ< -1e-6||f.assimilationLossJ< -1e-6)reasons.push('food accounting');
 return{...base,partitionResidualJ,chemicalExpenditureJ:base.spentJ+f.absorbedJ,valid:reasons.length===0,reasons,food:f};
}
