/** VIDA's unit-depth lamina model, independent of controller/genome tuning. */
import type {PartDef} from './simulation';

export type PhysicsRegime = 'legacy-v0' | 'surface-work-v1';
export const NEW_PHYSICS_REGIME: PhysicsRegime = 'surface-work-v1';
// 1 px = 0.001 m; 1 mass unit = 0.175 kg. Hence 1 M px²/s² = 1.75e-7 J.
export const MECHANICAL_JOULES = 1.75e-7;
export const MUSCLE_EFFICIENCY = 0.25;
// Constitutive model parameter, in simulated force / square pixel.
export const MUSCLE_STRESS = 300;

/** Integrate normal velocity over all four faces, depth=1, including connected
 * faces. No geometric shielding. v_face=v_COM+omega cross r. The cross terms
 * cancel; the s² integrals give (w³+h³)/6. */
export function surfaceResistance(width: number, height: number, mu: number) {
  return {x: 2 * mu * height, y: 2 * mu * width,
    angular: mu * (width ** 3 + height ** 3) / 6};
}

export function muscleParameters(parent: PartDef, child: PartDef, parentInertia: number,
  childInertia: number, force: number, stiffness: number, torqueMod: number) {
  const acrossParent = child.attachmentPoint === 'EAST' || child.attachmentPoint === 'WEST'
    ? parent.height : parent.width;
  const acrossChild = child.attachmentPoint === 'EAST' || child.attachmentPoint === 'WEST'
    ? child.height : child.width;
  const section = Math.min(acrossParent, acrossChild); // unit depth
  const lever = (Math.min(parent.width, parent.height) + Math.min(child.width, child.height)) / 4;
  const strength = MUSCLE_STRESS * section * lever;
  const effectiveInertia = 1 / (1 / parentInertia + 1 / childInertia);
  const kp = force * strength * (480 / 2200) * stiffness;
  const kd = Math.sqrt(kp * effectiveInertia) * 1.4 * stiffness;
  return {kp, kd, maxTorque: strength * torqueMod, section, lever};
}

/** Exact kinetic-energy change of a torque-only equal/opposite impulse.
 * Sequential impulses include acceleration from rest and shared-part effects.
 * Positive work is paid BEFORE application; braking never regenerates reserves.
 * The impulse is shortened to the available chemical budget, never its bill. */
export function paidMotorImpulse(torque: number, dt: number, relativeSpeed: number,
  inverseInertiaSum: number, reserveJ: number) {
  const requested = torque * dt;
  const direction = Math.sign(requested);
  const speedAlong = direction * relativeSpeed;
  const availableWork = Math.max(0, reserveJ) * MUSCLE_EFFICIENCY / MECHANICAL_JOULES;
  // Resolve a within-impulse reversal explicitly: braking cannot cancel the
  // positive work used to accelerate in the other direction.
  const reversalImpulse = Math.max(0, -speedAlong / inverseInertiaSum);
  const magnitude = Math.abs(requested);
  const positiveWork = (j: number) => speedAlong >= 0
    ? speedAlong * j + .5 * inverseInertiaSum * j * j
    : .5 * inverseInertiaSum * Math.max(0, j - reversalImpulse) ** 2;
  let actual = reserveJ > 0 ? magnitude : 0;
  const limited = actual < magnitude || positiveWork(actual) > availableWork;
  if (positiveWork(actual) > availableWork) {
    const bound = speedAlong >= 0
      ? 2 * availableWork / (speedAlong + Math.sqrt(speedAlong ** 2 + 2 * inverseInertiaSum * availableWork))
      : reversalImpulse + Math.sqrt(2 * availableWork / inverseInertiaSum);
    actual = Math.min(actual, bound);
  }
  const impulse = direction * actual;
  const brakingImpulse = Math.min(actual, reversalImpulse);
  const positiveJ = positiveWork(actual) * MECHANICAL_JOULES;
  const negativeJ = -(speedAlong * brakingImpulse + .5 * inverseInertiaSum * brakingImpulse ** 2) * MECHANICAL_JOULES;
  return {impulse, positiveJ, negativeJ,
    costJ: Math.min(Math.max(0, reserveJ), positiveJ / MUSCLE_EFFICIENCY), limited};
}
