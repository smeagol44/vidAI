import type {SolverTrace} from './solverTrace';
/** Frozen scalar experiment receipts. No observer result affects simulation. */
export type PhysicsReceipt =
  | {stage:'joint-batch';id:string;dt:number;scale:number;repairPose:boolean;maxBias:number;maxAngularBias:number}
  | {stage:'guard';id:string;part:number;dt:number;incomingOmega:number;forceOmega:number;omega:number;speed:number;lossJ:number}
  | {stage:'constraint';id:string;part:number;dt:number;deltaV:number;deltaOmega:number;beforeOmega:number;afterOmega:number}
  | {stage:'fluid';id:string;part:number;beforeJ:number;afterJ:number;physicalDissipationJ:number;numericalDissipationJ:number;iterations:number;residual:number}
  | {stage:'substep';id:string;dt:number;parts:number;overspeedParts:number;anchorPx:number;limitRad:number;maxOmega:number}
  | {stage:'motor';id:string;joint:number;dt:number;requested:number;applied:number;ceiling:number}
  | {stage:'budget';id:string;scale:number;positiveJ:number;negativeJ:number;costJ:number};
export type PhysicsObserver = (receipt:Readonly<PhysicsReceipt>)=>void;

/** Ephemeral, offline-only physical integration experiment. Never serialized in saves.
 * Held outputs supply capacity modulation without overwriting the live brain. */
export interface IntegrationDiagnostic {
  /** Private #80 fixture only; not a world setting or save field. */
  scissor?: {version: 'corner-scissor-v2'; fluidOff: boolean};
  serpent?: {version: 'corner-serpent-v1'; fluidOff: boolean};
  trace?: SolverTrace;
  jointLimits?: 'unilateral-stop-v1';
  substeps: number;
  splitting: 'motor-drag' | 'motor-half-half' | 'half-motor-half';
  outputs?: ReadonlyMap<string, readonly number[]>;
  torqueAt?: (id:string, substep:number) => readonly number[];
  captureOutputs?: (id:string, outputs:readonly number[]) => void;
}
