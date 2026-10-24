/** #89 explicit neural-motor-v2. Old ±.30 gate remains byte-for-byte separate. */
import {gatedTorque,type GateMode} from './gatedMotor';
export type HybridBand=0|1|2|3;
export const HYBRID_BOUNDARIES=[-.9,0,.9] as const;
export const hybridBandMode=(band:HybridBand):GateMode=>band===1?'direct':band===2?'oscillator':'off';
export function selectHybridBand(raw:number,previous:HybridBand,width=.06):HybridBand{
 if(!Number.isFinite(raw)||!Number.isInteger(previous)||previous<0||previous>3||!Number.isFinite(width)||width<0||width>=.1)throw new Error('Invalid revised hybrid gate');
 const x=Math.max(-1,Math.min(1,raw));
 if(width===0)return x<-.9?0:x<=0?1:x<=.9?2:3;
 let band:number=previous;
 // All crossed boundaries are considered in THIS call, never across ticks.
 // Distinct OFF bands retain the side needed for all three Schmitt triggers.
 while(band<3&&x>HYBRID_BOUNDARIES[band]+width)band++;
 while(band>0&&x<HYBRID_BOUNDARIES[band-1]-width)band--;
 return band as HybridBand;
}
export function revisedHybridTorque(mode:number,command:number,previous:HybridBand,wave:number,ceiling:number,width=.06){
 const band=selectHybridBand(mode,previous,width),selected=hybridBandMode(band);
 // Exact existing command/strength/work semantics, only mode selection differs.
 const result=gatedTorque({architecture:'two-output',mode:selected==='off'?-1:selected==='direct'?0:1,command},selected,wave,ceiling,0);
 return{...result,band};
}

/** Explicit neural-motor-v3: same four-band gate, separate direct/strength heads. */
export function revisedHybridThreeTorque(mode:number,direct:number,strength:number,previous:HybridBand,wave:number,ceiling:number,width=.06){
 const band=selectHybridBand(mode,previous,width),selected=hybridBandMode(band);
 return{...gatedTorque({architecture:'three-output',mode:selected==='off'?-1:selected==='direct'?0:1,direct,strength},selected,wave,ceiling,0),band};
}
