/** Explicit heritable-plastic-v1 identities. No reward or force equations. */
import type {Genome} from './simulation';
export interface PlasticConnections {version:'heritable-plastic-v1';motor:string[];sensory:string[]}
export const PLASTIC_EDGE_CAP=96;
export function plasticEdgePools(g:Genome){
 const inactive=new Set(g.disabledConnections??[]),motor:string[]=[],sensory:string[]=[];
 for(const output of g.outputKeys??[])for(const hidden of g.hiddenIds??[]){const key=JSON.stringify(['ho',output,hidden]);if(!inactive.has(key))motor.push(key);}
 for(const hidden of g.hiddenIds??[])for(const input of g.inputKeys??[])if(input.startsWith('eye:')&&/:(red|green|blue)$/.test(input)){const key=JSON.stringify(['ih',hidden,input]);if(!inactive.has(key))sensory.push(key);}
 return{motor,sensory};
}
export function validPlasticConnections(g:Genome):boolean{
 const c=g.plasticConnections;if(!c||c.version!=='heritable-plastic-v1'||g.brainVersion!==7||!Array.isArray(g.hiddenIds)||!Array.isArray(g.outputKeys)||!Array.isArray(g.inputKeys))return false;
 const pools=plasticEdgePools(g);
 return(['motor','sensory']as const).every(kind=>Array.isArray(c[kind])&&c[kind].length<=96&&new Set(c[kind]).size===c[kind].length&&c[kind].every(e=>typeof e==='string'&&e.length<=320&&pools[kind].includes(e)));
}
/** Only invoked by explicit genetic/topology editing, never import repair. */
export function prunePlasticConnections(g:Genome){if(!g.plasticConnections)return;const pools=plasticEdgePools(g),c=g.plasticConnections;g.plasticConnections={version:c.version,motor:[...new Set(c.motor)].filter(e=>pools.motor.includes(e)).slice(0,96).sort(),sensory:[...new Set(c.sensory)].filter(e=>pools.sensory.includes(e)).slice(0,96).sort()};}
/** Fixed three draws per category, independent of mask size or fallback branch. */
export function editPlasticMask(selected:string[],pool:string[],draws:readonly number[]){
 const before=[...selected],unselected=pool.filter(e=>!before.includes(e));let op=(['add','remove','swap']as const)[Math.min(2,Math.floor(draws[0]*3))];
 if(op==='add'&&(before.length>=96||!unselected.length))op=before.length&&unselected.length?'swap':'remove';
 if(op==='remove'&&!before.length)op='add';if(op==='swap'&&(!before.length||!unselected.length))op=before.length?'remove':'add';
 const removed=op!=='add'&&before.length?before[Math.min(before.length-1,Math.floor(draws[1]*before.length))]:null;
 const added=op!=='remove'&&unselected.length?unselected[Math.min(unselected.length-1,Math.floor(draws[2]*unselected.length))]:null;
 const after=before.filter(e=>e!==removed);if(added)after.push(added);after.sort();
 return{before,after,op,removed,added};
}
