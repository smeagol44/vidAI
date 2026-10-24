/** #103 explicit, real transfer bookkeeping. No reward or target input. */
import type {SimulationState,SimulationSettings} from './simulation';
import type {MovingState} from './movingNutrient';
export interface ProximitySample {time:number;mouthId:string;gap:number;strength:number;contact:boolean;grossJ:number;absorbedJ:number;state:MovingState}
export interface ProximityFeedingState {version:'proximity-90-v1';contactJ:number;proximityJ:number;samples:ProximitySample[];bodyTrace:number[][]}
export const feedingStrength=(gap:number)=>Math.max(0,Math.min(1,1-Math.max(0,gap)/90));
export function validateProximity(state:SimulationState,settings:SimulationSettings){
 const p=state.proximityFeeding;
 if(settings.experimentalFeedingMode===undefined){if(p!==undefined)throw Error('Proximity state in contact-only world');return;}
 if(settings.experimentalFeedingMode!=='proximity-90-v1'||settings.experimentalVelocityMode!=='uncapped-pursuit-v1'||settings.mouthContactModel!=='capsule-v1'||settings.physicsRegime!=='passive-work-v3'||!state.pursuit||!p||p.version!=='proximity-90-v1'||p.contactJ<0||p.proximityJ<0||!Array.isArray(p.samples)||!Array.isArray(p.bodyTrace)||p.bodyTrace.length!==state.pursuit.steps||Math.abs(p.contactJ+p.proximityJ-state.pursuit.absorbedJ)>1e-7||state.nutrients.length!==1)throw Error('Invalid experimental proximity world');
 for(const s of p.samples)if(s.gap<0||s.strength!==feedingStrength(s.gap)||typeof s.contact!=='boolean'||s.grossJ<0||s.absorbedJ!==s.grossJ*.8||!['moving','paused','frozen'].includes(s.state))throw Error('Invalid proximity receipt');
}
