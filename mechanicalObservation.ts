import type {Organism, PartDef, PartPhys} from './simulation';
import {bodyMass, mechanicalJoules, type PhysicsRegime} from './foundationPhysics';

export type MechanicalPhase = 'forces-and-motors' | 'fluid-resistance' | 'sequential-motor' | 'speed-guards' |
  'constraint-batch' | 'anchor-constraint' | 'angular-limit' | 'contact-impulse' | 'position-projection';
/** Opt-in observer only. Never persisted, sent to brains, or used by the solver. */
export type MechanicalObserver = (phase: MechanicalPhase, beforeJ: number, afterJ: number) => void;

export function partKineticEnergy(p: PartPhys, def: PartDef, density: number, regime?: PhysicsRegime): number {
  const mass = bodyMass(def, density, regime);
  const inertia = mass * (def.width * def.width + def.height * def.height) / 12;
  return (.5 * mass * (p.vx * p.vx + p.vy * p.vy) + .5 * inertia * p.angVel * p.angVel) * mechanicalJoules(regime);
}
export function organismKineticEnergy(org: Organism, density: number, regime?: PhysicsRegime): number {
  return org.segments.reduce((sum, part, i) => sum + partKineticEnergy(part, org.genome.parts[i], density, regime), 0);
}
