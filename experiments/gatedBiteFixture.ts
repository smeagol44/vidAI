/** OFFLINE mechanism control. An ordinary physical mouth creates injury;
 * this circuit is a test specimen, never a catalogue edit or runtime reflex. */
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS} from '../persistence';
import {makeGatedGenome} from './gatedGenome';
import type {GateArchitecture} from './gatedMotor';

export function gatedBiteFixture(architecture: GateArchitecture, hysteresisWidth: 0|.06) {
  const config: sim.SimulationSettings = {...DEFAULT_SETTINGS,physicsRegime:'passive-work-v3',motorExperiment:'gated-torque-v1',
    targetNutrients:0,inflowRate:0,mutationSeverity:0,kinshipProtection:false};
  const state = createInitialWorld(config,711,'balanced','standard',0);
  const g = makeGatedGenome(createFounderGenome('FND-001'),architecture,hysteresisWidth,711);
  g.weightsIH.forEach(row=>row.fill(0)); g.weightsHH.forEach(row=>row.fill(0));
  g.biasesH.fill(0); g.hiddenTimeConstants!.fill(0); g.disabledConnections=[];
  g.weightsHO.forEach(row=>row.fill(0));
  const count=architecture==='two-output'?2:3;
  g.biasesO=g.biasesO.map((_,i)=>i%count===0?-1.5:1.5);
  const input=g.inputKeys!.indexOf('body:injury');g.weightsIH[0][input]=3;
  for(let j=0;j<g.parts.length-1;j++)g.weightsHO[j*count][0]=3;
  const victim=addExternalOrganism(state,g,config,1200,750,.37)!;
  const hunterG=sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(21));
  hunterG.parts=[hunterG.parts[0]];hunterG.eyes=[];
  hunterG.mouths=[{id:'bite',partIndex:0,direction:'EAST',intakeWidth:12,mouthType:'omnivore'}];
  hunterG.motorForce=0;
  hunterG.bodyCost=sim.calculateBodyCost(hunterG.parts,[],hunterG.mouths);
  hunterG.maxEnergyCapacity=sim.calculateMaxEnergyCapacity(hunterG.parts,hunterG.storageTraitMultiplier);
  sim.remapBrain(hunterG);
  const tail=victim.segments.at(-1)!;
  addExternalOrganism(state,hunterG,config,
    tail.x-Math.cos(.37)*(hunterG.parts[0].width/2+8),tail.y-Math.sin(.37)*(hunterG.parts[0].width/2+8),.37);
  return {state,config,victim,input};
}
