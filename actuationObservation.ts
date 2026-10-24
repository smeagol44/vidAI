/** Opt-in scalar receipts. Never persisted, evaluated by a brain, or read by
 * the solver. Torque is in simulation units; J uses the existing conversion. */
export type ActuationSample = Readonly<
  | {kind:'uncapped-part';time:number;organism:string;part:number;stage:'forces'|'contact';vx:number;vy:number;omega:number}
  | {kind: 'demand'; time: number; organism: string; joint: number; mode: 'servo'|'off'|'direct'|'oscillator';
      modeBand?: 0|1|2|3; neuralCommand: number; modeSignal: number; rawWave: number; strength: number;
      rawTorque: number; requestedTorque: number; ceiling: number; baseCeiling: number;
      proportionalTorque: number; dampingTorque: number; engagement: number;
      relativeAngle: number; relativeSpeed: number; maxAngle: number; dt: number;
      freeRelativeDelta: number}
  | {kind: 'delivery'; time: number; organism: string; joint: number; appliedTorque: number;
      budgetScale: number; motorRelativeDelta: number; externalRelativeDelta: number; dt: number}
  | {kind: 'budget'; time: number; organism: string; scale: number; availableJ: number;
      positiveJ: number; negativeJ: number; costJ: number}
  | {kind: 'guard'; time: number; organism: string; part: number; speed: number; angularSpeed: number; lostJ: number;
      incomingAngularSpeed: number; motorAngularDelta: number; externalAngularDelta: number; withoutMotorAngularSpeed: number}
  | {kind: 'constraint'; time: number; organism: string; part: number; beforeAngularSpeed: number; afterAngularSpeed: number; scale: number}
  | {kind: 'pose'; time: number; organism: string; maxAnchorPx: number; maxLimitRad: number; maxAngularSpeed: number}
>;
export type ActuationObserver = (sample: ActuationSample) => void;
