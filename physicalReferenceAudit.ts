/** OFFLINE ONLY: dimensional diagnostics, never a live physics regime/default.
 * References and unapproved choices: docs/experiments/physical-reference-61.md.
 */
import {BASE_PART_DENSITY, UNIT_SIZE, LONGITUDINAL_DRAG, NUM_SUBSTEPS,
  type PartDef} from './simulation';
import {MECHANICAL_JOULES} from './foundationPhysics';

export interface ReferenceUnits {
  metresPerPixel: number;
  secondsPerSecond: number;
  kilogramsPerMass: number;
}
/** Exponents in mass, length, time. Angles are dimensionless radians. */
export const dimensions = {
  length: [0, 1, 0], time: [0, 0, 1], mass: [1, 0, 0],
  area: [0, 2, 0], volume: [0, 3, 0], arealDensity: [1, -2, 0], density: [1, -3, 0],
  velocity: [0, 1, -1], angularVelocity: [0, 0, -1], inertia: [1, 2, 0],
  momentum: [1, 1, -1], angularMomentum: [1, 2, -1],
  force: [1, 1, -2], torque: [1, 2, -2], work: [1, 2, -2], power: [1, 2, -3],
  dynamicViscosity: [1, -1, -1], normalTractionCoefficient: [1, -2, -1],
  linearResistance: [1, 0, -1], angularResistance: [1, 2, -1],
} as const;
function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive and finite`);
  return value;
}
export function unitFactors(ref: ReferenceUnits) {
  const L = positive(ref.metresPerPixel, 'length'), T = positive(ref.secondsPerSecond, 'time');
  const M = positive(ref.kilogramsPerMass, 'mass');
  return Object.fromEntries(Object.entries(dimensions).map(([key, [m, l, t]]) =>
    [key, M ** m * L ** l * T ** t])) as Record<keyof typeof dimensions, number>;
}
// Existing comment reference, measured rather than endorsed.
export const CURRENT_COMMENT_REFERENCE: Readonly<ReferenceUnits> = Object.freeze({
  metresPerPixel: .001, secondsPerSecond: 1, kilogramsPerMass: .175,
});
/** A fixed-depth prism reference would preserve present area-proportional mass
 * above the floor. These parameters are supplied by the caller, not defaults. */
export function fixedDepthReference(metresPerPixel: number, secondsPerSecond: number,
  densityKgM3: number, depthM: number): ReferenceUnits {
  const L = positive(metresPerPixel, 'length');
  return {metresPerPixel: L, secondsPerSecond: positive(secondsPerSecond, 'time'),
    kilogramsPerMass: positive(densityKgM3, 'density') * positive(depthM, 'depth')
      * L ** 2 * UNIT_SIZE ** 2 / BASE_PART_DENSITY};
}
export function impliedDepth(ref: ReferenceUnits, densityKgM3: number) {
  return BASE_PART_DENSITY / UNIT_SIZE ** 2 * unitFactors(ref).arealDensity
    / positive(densityKgM3, 'density');
}
/** Legacy/v2/v3 generalized resistance. It is dissipative for mu>=0; it is
 * not the integral of the same anisotropic normal traction on all faces. */
export function currentResistance(w: number, h: number, mu: number) {
  positive(w, 'width'); positive(h, 'height');
  if (!Number.isFinite(mu) || mu < 0) throw new Error('resistance parameter must be finite and nonnegative');
  return {x: LONGITUDINAL_DRAG * mu * h, y: 2 * mu * w,
    angular: mu * (w ** 3 + h ** 3) / 6};
}
/** Pure analytic reference integral, NOT applied to any creature. gx/gy are
 * linear normal traction per area per speed (SI kg/m²/s when inputs are SI).
 * Counts both faces in each direction, including covered faces. */
export function normalFaceResistance(w: number, h: number, depth: number, gx: number, gy: number) {
  positive(w, 'width'); positive(h, 'height'); positive(depth, 'depth');
  if (![gx, gy].every(x => Number.isFinite(x) && x >= 0)) throw new Error('traction must be nonnegative');
  return {x: 2 * gx * h * depth, y: 2 * gy * w * depth,
    angular: depth * (gy * w ** 3 + gx * h ** 3) / 6};
}
export function reynolds(lengthM: number, speedMS: number, densityKgM3: number, viscosityPaS: number) {
  positive(lengthM, 'length'); positive(densityKgM3, 'density'); positive(viscosityPaS, 'viscosity');
  if (!Number.isFinite(speedMS) || speedMS < 0) throw new Error('speed must be finite and nonnegative');
  return densityKgM3 * lengthM * speedMS / viscosityPaS;
}
export function inspectPart(part: PartDef, mu: number, ref: ReferenceUnits) {
  const {width: w, height: h} = part;
  const mass = Math.max(.35, part.dimN * part.dimM * BASE_PART_DENSITY);
  const inertia = mass * (w * w + h * h) / 12, factors = unitFactors(ref);
  const drag = currentResistance(w, h, mu);
  const sameFaceWeights = normalFaceResistance(w, h, 1, mu * LONGITUDINAL_DRAG / 2, mu);
  const dt = 1 / 60 / NUM_SUBSTEPS;
  return {id: part.id, widthPx: w, heightPx: h, mass, inertia,
    massKg: mass * factors.mass, inertiaKgM2: inertia * factors.inertia,
    arealDensityKgM2: mass / (w * h) * factors.arealDensity,
    massFloorActive: part.dimN * part.dimM * BASE_PART_DENSITY < .35,
    resistance: drag, sameFaceWeightsAngular: sameFaceWeights.angular,
    angularRatioToSameFaceWeights: mu === 0 ? null : drag.angular / sameFaceWeights.angular,
    isolatedEulerFractions: {x: dt * drag.x / mass, y: dt * drag.y / mass, angular: dt * drag.angular / inertia}};
}
export function inspectReference(ref: ReferenceUnits) {
  const factors = unitFactors(ref);
  return {reference: ref, factors, currentWorkFactorJ: MECHANICAL_JOULES,
    currentWorkFactorRatio: MECHANICAL_JOULES / factors.work,
    bulkArealDensityKgM2: BASE_PART_DENSITY / UNIT_SIZE ** 2 * factors.arealDensity,
    impliedDepthAt1000KgM3: impliedDepth(ref, 1000),
    // Only an effective viscosity interpretation, assuming depth/shear-length=1.
    effectiveViscosityAtParameter018PaS: .18 * factors.dynamicViscosity};
}
