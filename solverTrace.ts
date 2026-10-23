/** Offline, read-only solver receipts. Never emit live state/geometry references. */
import type {Organism, PartPhys} from './simulation';
export interface SolverTraceEvent {stage:string;[key:string]:unknown}
export interface SolverTrace {
  readonly detailed:boolean;
  begin(substep:number):void;
  emit(event:Readonly<SolverTraceEvent>):void;
}
export function solverPart(p:PartPhys) {
  return Object.freeze({x:p.x,y:p.y,angle:p.angle,vx:p.vx,vy:p.vy,omega:p.angVel});
}
export function solverParts(org:Organism) {return Object.freeze(org.segments.map(solverPart));}
export function solverPeak(org:Organism) {return Math.max(...org.segments.map(p=>Math.abs(p.angVel)));}
export function solverEmit(trace:SolverTrace|undefined,event:SolverTraceEvent) {
  if(!trace)return;
  // Packets contain only owned scalar objects/arrays constructed at the call site.
  const freeze=(v:unknown):void=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)) {
    for(const value of Object.values(v))freeze(value);Object.freeze(v);
  }};
  freeze(event);trace.emit(event);
}
