/** Frozen scalar experiment receipts. No observer result affects simulation. */
export type PhysicsReceipt =
  | {stage:'guard';id:string;part:number;incomingOmega:number;forceOmega:number;omega:number;speed:number;lossJ:number}
  | {stage:'constraint';id:string;part:number;beforeOmega:number;afterOmega:number}
  | {stage:'fluid';id:string;part:number;beforeJ:number;afterJ:number;physicalDissipationJ:number;numericalDissipationJ:number;iterations:number;residual:number}
  | {stage:'substep';id:string;anchorPx:number;limitRad:number;maxOmega:number}
  | {stage:'motor';id:string;joint:number;requested:number;applied:number;ceiling:number}
  | {stage:'budget';id:string;scale:number;positiveJ:number;negativeJ:number;costJ:number};
export type PhysicsObserver = (receipt:Readonly<PhysicsReceipt>)=>void;
