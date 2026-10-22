/** Versioned rigid-body units and prepaid work; no controller/genome tuning. */
import type {PartDef} from './simulation';
import {PRISM_REFERENCE, prismProperties} from './prismPhysics';

export type PhysicsRegime = 'legacy-v0' | 'surface-work-v1' | 'paid-work-v2' | 'passive-work-v3' | 'prism-resistance-v4';
export const NEW_PHYSICS_REGIME: PhysicsRegime = 'passive-work-v3';
export function usesPaidActuation(regime?: PhysicsRegime): boolean {
  return regime === 'surface-work-v1' || regime === 'paid-work-v2' || regime === 'passive-work-v3' || regime === 'prism-resistance-v4';
}
// Historical v0–v3 reference: 1 px=.001 m, 1 M=.175 kg; 1 M px²/s²=1.75e-7 J.
export const MECHANICAL_JOULES = 1.75e-7;
export function mechanicalJoules(regime?: PhysicsRegime): number {
  return regime === 'prism-resistance-v4' ? PRISM_REFERENCE.joulesPerMechanicalUnit : MECHANICAL_JOULES;
}
export function bodyMass(def: PartDef, density: number, regime?: PhysicsRegime): number {
  return regime === 'prism-resistance-v4'
    ? prismProperties(def.width, def.height).massKg / PRISM_REFERENCE.kilogramsPerMass
    : Math.max(.35, def.dimN * def.dimM * density);
}
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
  inverseInertiaSum: number, reserveJ: number, joules = MECHANICAL_JOULES) {
  const requested = torque * dt;
  const direction = Math.sign(requested);
  const speedAlong = direction * relativeSpeed;
  const availableWork = Math.max(0, reserveJ) * MUSCLE_EFFICIENCY / joules;
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
  const positiveJ = positiveWork(actual) * joules;
  const negativeJ = -(speedAlong * brakingImpulse + .5 * inverseInertiaSum * brakingImpulse ** 2) * joules;
  return {impulse, positiveJ, negativeJ,
    costJ: Math.min(Math.max(0, reserveJ), positiveJ / MUSCLE_EFFICIENCY), limited};
}

/** Positive/negative actuator work along the shared substep velocity change.
 * All commands read the same initial state. External torque contributes to
 * angular travel but cannot offset positive work on a different joint. */
export function paidMotorBatch(impulses: ArrayLike<number>, speeds: ArrayLike<number>,
  externalChanges: ArrayLike<number>, motorChanges: ArrayLike<number>, count: number, reserveJ: number, joules = MECHANICAL_JOULES) {
  let positive = 0, negative = 0, boundA = 0, boundB = 0;
  const measure = (scale: number) => {
    positive = 0; negative = 0;
    for (let j = 0; j < count; j++) {
      const impulse = impulses[j] * scale;
      const p0 = impulse * speeds[j];
      const p1 = impulse * (speeds[j] + externalChanges[j] + scale * motorChanges[j]);
      if (p0 >= 0 && p1 >= 0) positive += .5 * (p0 + p1);
      else if (p0 <= 0 && p1 <= 0) negative -= .5 * (p0 + p1);
      else {
        const reversal = -p0 / (p1 - p0);
        if (p0 > 0) {positive += .5 * p0 * reversal; negative -= .5 * p1 * (1 - reversal);}
        else {negative -= .5 * p0 * reversal; positive += .5 * p1 * (1 - reversal);}
      }
    }
  };
  let scale = reserveJ > 0 ? 1 : 0;
  measure(scale);
  const available = Math.max(0, reserveJ) * MUSCLE_EFFICIENCY / joules;
  if (positive > available) {
    // A conservative bound avoids assuming the signed per-joint work is
    // monotone as all shared-part impulses are reduced together.
    for (let j = 0; j < count; j++) {
      boundA += Math.abs(impulses[j]) * (Math.abs(speeds[j]) + .5 * Math.abs(externalChanges[j]));
      boundB += .5 * Math.abs(impulses[j] * motorChanges[j]);
    }
    scale = boundB > 0 ? 2 * available / (boundA + Math.sqrt(boundA ** 2 + 4 * boundB * available))
      : available / boundA;
    scale = Math.min(1, Math.max(0, scale));
    measure(scale);
  }
  const positiveJ = positive * joules, negativeJ = negative * joules;
  return {scale, positiveJ, negativeJ,
    costJ: Math.min(Math.max(0, reserveJ), positiveJ / MUSCLE_EFFICIENCY), limited: scale < 1};
}

/** Delta KE(s*J) = s*linear + s*s*quadratic. Keep the complete historical
 * constraint batch when dissipative; otherwise use the largest non-energizing fraction.
 * The tiny inward margin protects the quadratic root from roundoff. */
export function passiveConstraintScale(linear: number, quadratic: number): number {
  if (linear + quadratic <= 0) return 1;
  if (linear >= 0 || quadratic <= 0) return 0;
  return Math.min(1, -linear / quadratic * (1 - 16 * Number.EPSILON));
}
