import {mouthDimensions, capsuleContactsPart} from './mouthGeometry';
import {partKineticEnergy, type MechanicalObserver} from './mechanicalObservation';
import {passiveConstraintScale, paidMotorBatch, usesPaidActuation, muscleParameters, paidMotorImpulse, surfaceResistance, anisotropicFaceResistance, anatomicalMuscleParameters, type FoundationTrial, type PhysicsRegime} from './foundationPhysics';
import {markLineageChanged} from './lineageChanges';
import {compiledBrain, compiledDeltas, alignPlasticRecords, invalidateCompiledBrain} from './neuralRuntime';
import {resolveBodyContacts} from './contacts';
import {NutrientSightGrid} from './sightBroadphase';
import {OrderedSpatialIndex, type SpatialBounds} from './spatialIndex';
import {type EnergyPool, occupiedPopulation, eggEnergyRequirement, fundIncubatingEggs,
  initializeClosedEgg, EGG_LIFETIME_MULTIPLIER, FOOD_SAFETY_LIMIT} from './energyEconomy';
// ============================================================================
// 1. DETERMINISTIC PRNG (xoshiro128++)
// ============================================================================
export class XoshiroPRNG {
  private s: Uint32Array;

  constructor(seed = 1337) {
    this.s = new Uint32Array(4);
    this.reseed(seed);
  }

  reseed(seed: number) {
    let x = (seed >>> 0) || 1;
    for (let i = 0; i < 4; i++) {
      let z = (x = (x + 0x9e3779b9) >>> 0);
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      const val = (z ^ (z >>> 16)) >>> 0;
      this.s[i] = val || (0x9e3779b9 + i);
    }
  }

  nextUint32(): number {
    const s = this.s;
    const sum = (s[0] + s[3]) >>> 0;
    const result = ((((sum << 7) | (sum >>> 25)) >>> 0) + s[0]) >>> 0;
    const t = s[1] << 9;

    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];

    s[2] ^= t;
    s[3] = ((s[3] << 11) | (s[3] >>> 21)) >>> 0;

    return result;
  }

  nextFloat(): number {
    return (this.nextUint32() >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  getState(): [number, number, number, number] {
    return [this.s[0], this.s[1], this.s[2], this.s[3]];
  }

  setState(state: [number, number, number, number]) {
    this.s[0] = state[0];
    this.s[1] = state[1];
    this.s[2] = state[2];
    this.s[3] = state[3];
  }

  clone(): XoshiroPRNG {
    const copy = new XoshiroPRNG(1);
    copy.setState(this.getState());
    return copy;
  }
}

export const rng = new XoshiroPRNG(4242);

// ============================================================================
// 2. DATA STRUCTURES & MORPHOLOGY DEFINITIONS
// ============================================================================
export type CardinalDir = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
export type MouthType = 'herbivore' | 'carnivore' | 'omnivore';
export type FoodCategory = 'Nutrient' | 'Prey' | 'Egg' | 'Carrion';

export interface FeedingEvent {
  timestamp: number;
  mouthId: string;
  mouthType: MouthType;
  foodCategory: FoodCategory;
  energyTransferred: number;
}

export const UNIT_SIZE = 7.0; // Base unit in px
export const BASE_PART_DENSITY = 0.40; // Base mass density
export const FORCE_COST_MULTIPLIER = 0.000000175; // Mechanical work to heat dissipation (1/20th calibration)
export const BASAL_METABOLIC_RATE = 12.0; // J/s for founder-sized body (BASE_FOUNDER_AREA = 36)
export const SENSORY_NEURAL_METABOLIC_RATE = 0.45; // J/s per sensory channel/neuron.
export const NEURAL_EDGE_METABOLIC_RATE = 0.00025; // J/s per enabled synapse, relative to a legacy dense-24 budget.
export const MAX_BRAIN_MEMORY_SECONDS = 4.0; // Upper bound for inherited hidden-neuron activation relaxation.
export const MEMORY_METABOLIC_RATE = 0.08; // Extra J/s per second of combined neuronal time constants.
// Phase 5: only heritably enabled organisms can adapt their own motor synapses.
// No per-genome weight edit is performed while an organism lives.
export const MAX_PLASTIC_MOTOR_SYNAPSES = 96;
export const MAX_PLASTIC_SENSORY_SYNAPSES = 96;
export const MAX_LEARNED_MOTOR_DELTA = 0.8;
export const PLASTIC_ELIGIBILITY_SECONDS = 0.6;
export const PLASTIC_UPKEEP_J_PER_EDGE_SECOND = 0.002;
export const PLASTIC_REWRITE_J_PER_WEIGHT = 0.4;
export const CONSOLIDATED_MEMORY_UPKEEP_J_PER_SECOND = 0.004; // Extra J/s at 100% retained per eligible synapse.
export const MAX_FRAME_MOTOR_WORK = 40.0; // Legacy motor-heat cap per complete tick, not per substep
export const LONGITUDINAL_DRAG = 0.05; // Calibrated nonzero resistance along each segment.
export const MOTOR_RESPONSE_SECONDS = 0.12;

export const MATURITY_AGE = 20.0; // 20.0s until sexual maturity
export const MIN_PARENT_SURVIVAL_RESERVE_BASE = 2000.0; // 2,000 J minimum survival reserve floor
export const MIN_PARENT_SURVIVAL_FRACTION = 0.12; // 12% of capacity; protected when laying.
export const BASE_FOUNDER_AREA = 36.0; // Baseline body grid area (e.g. 3 segments of 12 units)
export const FOUNDER_DEFAULT_RESERVE = 10000.0; // 10,000 J starting usable reserve
export const FOUNDER_DEFAULT_CAPACITY = 100000.0; // 100,000 J max capacity

export const CONTINUOUS_EAT_RATE = 3600.0; // Gross J/s per specialist; actual intake remains contact-/storage-limited.
export const OMNIVORE_EAT_RATE = CONTINUOUS_EAT_RATE * 0.5; // 50% rate
export const MOUTH_ASSIMILATION = 0.8; // All mouths dissipate 20% of removed chemical energy.
export const NUTRIENT_ENERGY_VALUE = 3000.0; // 3,000 J per nutrient
export const BASE_NUTRIENT_RADIUS = 18.0;
export const CARRION_DECAY_SECONDS = 60; // Unconsumed remains mineralize without adding energy.

// Empty space is optically black. Display water, walls and effects are not sensed.
export const WATER_AMBIENT_RGB: [number, number, number] = [0, 0, 0];
export const EGG_RGB: [number, number, number] = [1, 1, 1];

// Recurrent Brain Specs
export const NUM_INPUT_RAYS = 5;
export const RAYS_PER_EYE = 5;
export const NUM_INPUTS = NUM_INPUT_RAYS * 3 + 7; // 15 optical + 3 joint + speed + energy + sin + cos = 22
export const NUM_HIDDEN = 24; // Compatibility default for existing founders.
export const MAX_HIDDEN = 96;
export const MAX_ENABLED_BRAIN_EDGES = 65_536; // Dense legacy layouts fit; larger layouts may need sparsity.
export const MAX_PARTS = 7;
export const LEGACY_OUTPUTS_PER_JOINT = 4;
export const LEGACY_MAX_OUTPUTS = (MAX_PARTS - 1) * LEGACY_OUTPUTS_PER_JOINT;
export const OUTPUTS_PER_JOINT = 6; // Angle, frequency, torque, stiffness, amplitude, engagement.
export const MAX_OUTPUTS = (MAX_PARTS - 1) * OUTPUTS_PER_JOINT;
export const MAX_CLUTCH_SIZE = 8;

export const INPUT_LABELS = [
  'R1-Red', 'R1-Grn', 'R1-Blu',
  'R2-Red', 'R2-Grn', 'R2-Blu',
  'R3-Red', 'R3-Grn', 'R3-Blu',
  'R4-Red', 'R4-Grn', 'R4-Blu',
  'R5-Red', 'R5-Grn', 'R5-Blu',
  'J1 RelAngle', 'J2 RelAngle', 'J3 RelAngle',
  'Norm Speed', 'Norm Energy',
  'CPG Sin', 'CPG Cos',
];

export const OUTPUT_LABELS = ['Angle', 'Drive', 'Torque', 'Stiff', 'Amp', 'Engage'];

export const CARDINAL_DIRS: CardinalDir[] = ['EAST', 'WEST', 'NORTH', 'SOUTH'];
export const ORGAN_SLOTS_PER_FACE = 3;
// Absolute import bounds. Physical joints reduce the actual number of available slots.
export const MAX_SURFACE_ORGANS = MAX_PARTS * 4 * ORGAN_SLOTS_PER_FACE;
export const MAX_NEURAL_INPUTS = MAX_SURFACE_ORGANS * RAYS_PER_EYE * 4 + (MAX_PARTS - 1) * 2 + 7;

export interface SurfaceOrgan {
  id: string;
  partIndex: number;
  direction: CardinalDir;
  slot?: 0 | 1 | 2; // 0=center, 1/2=mirrored side slots; absent preserves legacy center placement.
}

export interface SensoryEye extends SurfaceOrgan {
  fov: number; // in radians
  range: number; // optical distance
  spectralSensitivity?: [number, number, number]; // Inherited red/green/blue receptor gains (0..1). Absent = legacy [1,1,1].
}

/** Five physical rays per eye remain; attenuated receptor activity has an
 * energy cost, while even a fully blind eye retains 25% structural upkeep.
 * Omitted alleles exactly preserve the original sensory metabolic rate. */
export function eyeSensoryUpkeep(eyes: readonly SensoryEye[]): number {
  return eyes.reduce((sum, eye) => {
    const receptors = eye.spectralSensitivity;
    const active = receptors ? (receptors[0] + receptors[1] + receptors[2]) / 3 : 1;
    return sum + RAYS_PER_EYE * (0.25 + 0.75 * active);
  }, 0);
}

export interface SensoryMouth extends SurfaceOrgan {
  intakeWidth: number; // aperture contact width
  mouthType: MouthType;
}

export interface PartDef {
  id: string;
  parentIndex: number; // -1 for root
  attachmentPoint: CardinalDir;
  dimN: number;
  dimM: number;
  width: number;
  height: number;
  maxAngle: number;
  baseAngleOffset: number;
  cpgPhaseOffset: number;
  cpgAmp: number;
  cpgFreqMult: number;
  oscillatorMix?: number; // Heritable rhythmic contribution 0..1; absent = exact legacy sine controller.
  waveHarmonics?: number[]; // Up to four bounded sine harmonics (2nd..5th); absent = exact sine.
}

export type ArchetypeId = 'eel' | 'flapper' | 'tadpole' | 'glider' | 'predator' | 'nematode' | 'random';

export interface Genome {
  anatomyVersion?: 1; // Absent in legacy saves; new anatomy uses exclusive physical/organ faces.
  id: string;
  name?: string;
  archetype?: string;
  generation: number;
  parentIds: string[];
  hue: number;
  saturation: number;
  lightness: number;
  colorMutationRate?: number; // Heritable multiplier (0..1) of the world's pigment mutation probability.
  parts: PartDef[];
  eyes: SensoryEye[];
  mouths: SensoryMouth[];
  motorFrequency: number;
  motorForce: number;
  // Recurrent Neural Weights
  weightsIH: number[][]; // [hidden neuron x sensory key]
  weightsHH: number[][]; // [target hidden neuron x source hidden neuron]
  biasesH: number[];     // [hidden neuron]
  weightsHO: number[][]; // [motor key x hidden neuron]
  biasesO: number[];     // [motor key]
  brainVersion?: 2 | 3 | 4 | 5 | 6 | 7;
  hiddenIds?: string[]; // Stable neuron identities; index order defines the matrix axes.
  hiddenTimeConstants?: number[]; // Seconds of leaky activation memory per hidden ID; 0 is the exact legacy update.
  plasticityRate?: number; // Heritable motor-learning rate 0..0.8 / s. Absent or 0 = exact legacy brain.
  forgettingRate?: number; // Heritable learned-weight relaxation 0..1 / s. Absent = 0.1 for learning-enabled descendants.
  plasticMotorScope?: 'angle' | 'all'; // Heritable learner motor scope; absent = exact old Angle-only pathway.
  injuryAversionRate?: number; // Heritable 0..1 / s loss-based teaching signal from REAL body:injury only; absent = 0.
  sensoryPlasticityRate?: number; // Heritable 0..0.8 / s associative retinal IH learning; absent = no acquired perception changes.
  memoryConsolidationRate?: number; // Heritable 0..2/s: preserve repeatedly reinforced somatic edges; absent = old forgetting.
  disabledConnections?: string[]; // Canonical edge keys; absent/empty means legacy fully enabled.
  inputKeys?: string[];
  outputKeys?: string[];
  founderMode?: 'balanced' | 'unbiased';
  // Life History Traits
  targetClutchSize: number;    // integer 1..6 eggs desired per clutch
  maturityAge: number;         // seconds until sexual maturity (10.0..45.0s)
  incubationTime: number;      // seconds
  eggReserveFraction: number;  // fraction of budget to reserve
  reproductionThreshold: number; // Retired compatibility allele; funding/reserve rules govern laying.
  reproductionCooldown: number;  // cooldown in seconds
  maxLifespan: number;          // seconds
  metabolicEfficiency: number;
  bodyCost: number;
  storageTraitMultiplier?: number;
  maxEnergyCapacity: number;
}

export interface PartPhys {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angVel: number;
}

export interface JointState {
  phase: number;
  targetAngle: number;
  currentRelAngle: number;
  currentRelAngVel: number;
  appliedTorque: number;
  stiffness: number;
  amplitude?: number;
  engagement?: number;
}

export interface RayHit {
  eyeId?: string;
  rayIndex?: number;
  hit: boolean;
  dist: number;
  pointX: number;
  pointY: number;
  r: number;
  g: number;
  b: number;
  objectType: 'wall' | 'creature' | 'nutrient' | 'carrion' | 'egg' | 'none';
}

export interface Organism {
  id: string;
  clutchId?: string;
  genome: Genome;
  segments: PartPhys[];
  joints: JointState[];
  energy: number;
  structuralBiomass: number;
  basalEnergyRate?: number;
  sensoryEnergyRate?: number;
  motorEnergyRate: number;
  plasticityEnergyRate?: number; // Somatic upkeep + rewrite cost, charged once to metabolic heat.
  totalEnergyRate?: number;
  age: number;
  maxLifespan: number;
  foodEaten: number;
  preyEaten: number;
  eggsPredated: number;
  offspringCount: number;
  clutchesLaid: number;
  isGravid: boolean;
  lastReproductionAge: number;
  lastReproductionTime: number;
  deathCause?: DeathCause;
  distanceTraveled: number;
  speed: number;
  neuralInputs: number[];
  neuralHidden: number[]; // Recurrent state h_t
  neuralOutputs: number[];
  // Somatic motor-synapse offsets and recent eligibility, keyed by stable HO
  // identities. NEVER written into genome or inherited by offspring.
  learnedMotorWeights?: Array<{edge: string; delta: number; eligibility: number; consolidation?: number}>;
  learnedSensoryWeights?: Array<{edge: string; delta: number; eligibility: number; consolidation?: number}>; // Somatic RGB retina→hidden associations, never inherited.
  rayHits: RayHit[];
  glowPulse: number;
  dissolving: boolean;
  dissolveAlpha: number;
  isFeedingHighlight: number;
  traceHistory?: Array<{x: number; y: number; time: number}>;
  recentFeedings?: FeedingEvent[];
  mouthFeedback?: Record<string, {contact: number; intake: number}>;
  motorDiagnostics?: {positiveWorkJ: number; negativeWorkJ: number; energyLimitedImpulses: number; numericalGuardEvents: number; constraintLimitedBatches?: number};
  biteFeedbackJ?: number; // Actual reserve/tissue energy physically bitten since the last neural tick.
}

export interface Egg {
  id: string;
  clutchId: string;
  parentOrgId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  genome: Genome;
  fundedStructural: number; // E_structural needed for offspring body
  fundedReserve: number;    // Usable energy given to offspring
  incubationProgress: number; // 0..1
  totalIncubationTime: number;
  pulseTimer: number;
  colorHue: number;
  readyToHatch: boolean;
  hatchHeading?: number; // Chosen once; blocked eggs do not redraw randomness each tick.
  ageSeconds?: number;
  hatchReserveTarget?: number;
}

export interface Nutrient {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energyValue: number;
  radius: number;
  bottomTimer: number;
  isSuper?: boolean;
  pulseTimer?: number;
  kind?: 'nutrient' | 'carrion'; // Missing in older saves means ordinary plant food.
  decayTimeRemaining?: number;
}

export interface BubbleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  hue: number;
}

export interface CausticWave {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
  angle: number;
}

export type DeathCause = 'Old Age' | 'Starvation' | 'Predation';
export type LifeStage = 'Juvenile' | 'Adult' | 'Aging' | 'Deceased';

export interface DeathRecord {
  id: string;
  name: string;
  generation: number;
  cause: DeathCause;
  age: number;
  energyAtDeath: number;
  offspringCount: number;
  timestamp: number;
}

export interface LineageRecord {
  id: string;
  name?: string;
  parentIds: string[];
  generation: number;
  birthTime: number;
  deathTime?: number;
  deathCause?: DeathCause;
  deathAge?: number;
  deathEnergy?: number;
  offspringCount: number;
  archetype: string;
  hue: number;
  diet: string;
  genome: Genome;
}

export interface SpecimenBankItem {
  id: string;
  name: string;
  savedAt: string;
  genome: Genome;
  tags: string[];
}

export interface SimulationLedger {
  externalInflow: number;
  metabolicDissipation: number;
  mechanicalWorkHeat: number;
  recordedLosses: number; // Nonviable egg decomposition or excess feeding discard
}

export interface SimulationSettings {
  /** Omitted retains exact historical prey-contact geometry. */
  mouthContactModel?: 'capsule-v1';
  ecologyRegime?: 'closed-v1';
  /** null means no ecological count cap; a visible particle safety limit remains. */
  nutrientLimit?: number | null;
  /** Omitted by historical callers: exact legacy continuation. */
  physicsRegime?: PhysicsRegime;
  worldWidth: number;
  worldHeight: number;
  waterViscosity: number;
  targetNutrients: number;
  inflowRate: number;
  /** Absent/undefined retains exact historical uniform nutrient placement. */
  nutrientPattern?: 'uniform' | 'blooms';
  kinshipProtection: boolean;
  mutationSeverity: number;
  gravity?: number;
  maxOrganisms?: number;
}

export interface SimulationState {
  energyPool?: EnergyPool;
  initialSeed?: number;
  simTime: number;
  organisms: Organism[];
  eggs: Egg[];
  nutrients: Nutrient[];
  bubbles: BubbleParticle[];
  caustics: CausticWave[];
  ledger: SimulationLedger;
  nutrientAccumulator: number;
  totalBirths: number;
  totalDeaths: number;
  prng: XoshiroPRNG;
  lineage: Map<string, LineageRecord>;
  recentDeaths: DeathRecord[];
}

export const NUM_SUBSTEPS = 4; // 4 Substeps @ 1/240s for smooth, symplectic integration

// Scratch buffers
const scratchFx = new Float64Array(16);
const scratchFy = new Float64Array(16);
const scratchTorque = new Float64Array(16);
const scratchMotorTorque = new Float64Array(16);
const scratchMotorImpulses = new Float64Array(16);
const scratchMotorSpeeds = new Float64Array(16);
const scratchMotorExternalChanges = new Float64Array(16);
const scratchMotorChanges = new Float64Array(16);
const scratchMasses = new Float64Array(16);
const scratchInvMasses = new Float64Array(16);
const scratchInertias = new Float64Array(16);
const scratchInvInertias = new Float64Array(16);
const scratchPrevHidden = new Float64Array(MAX_HIDDEN);
// A velocity solve changes velocities only. Its geometry, effective masses,
// positional bias and angle-limit error stay fixed through all ten iterations.
// Recompute once per substep; never cache across moving poses or world swaps.
const scratchConstraintStart = new Float64Array(MAX_PARTS * 3);
const scratchConstraints = Array.from({length: MAX_PARTS - 1}, () => ({
  parentIdx: 0, childIdx: 0, rPx: 0, rPy: 0, rCx: 0, rCy: 0,
  biasX: 0, biasY: 0, wP: 0, wC: 0, iP: 0, iC: 0,
  k11: 0, k22: 0, k12: 0, det: 0, limited: false, angularBias: 0,
}));

export const clampVal = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const hsl = (h: number, s: number, l: number, a = 1) =>
  `hsla(${Math.floor(h)}, ${Math.floor(s)}%, ${Math.floor(l)}%, ${a})`;

/** Normalize pigment hue without diet restrictions or excluded colors. */
export function sanitizeCreatureHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/** The same opaque body pigment is used by rendering and creature vision. */
export function getBodyPigment(org: Organism, partIndex: number): [number, number, number] {
  return [Math.floor(sanitizeCreatureHue(org.genome.hue + partIndex * 8)),
    Math.floor(org.genome.saturation),
    Math.floor(org.energy < org.genome.maxEnergyCapacity * .2 ? 30 : org.genome.lightness)];
}

export function getFoodRGB(food: Nutrient): [number, number, number] {
  return food.kind === 'carrion' ? [240 / 255, 120 / 255, 106 / 255] : [34 / 255, 224 / 255, 120 / 255];
}

export interface DietInfo {
  category: 'Herbivore' | 'Carnivore' | 'Omnivore' | 'Passive';
  label: string;
  composition: string;
  badgeClass: string;
  textClass: string;
  icon: string;
  herbivores: number;
  carnivores: number;
  omnivores: number;
}

export function getLifeStage(org: Organism): LifeStage {
  if (org.dissolving || org.dissolveAlpha < 1.0) return 'Deceased';
  const maturityAge = org.genome.maturityAge || MATURITY_AGE;
  if (org.age < maturityAge) return 'Juvenile';
  if (org.age >= org.maxLifespan * 0.8) return 'Aging';
  return 'Adult';
}

/** Inherited egg allocation: 20–55% of the former 10 kJ founder reserve.
 * Better-funded hatchlings cost more to produce. No energy is created. */
export function getEggReserveFunding(g: Pick<Genome, 'eggReserveFraction'>): number {
  return FOUNDER_DEFAULT_RESERVE * clampVal(g.eggReserveFraction ?? .35, .2, .55);
}

export function evaluateReproductionAffordability(
  org: Organism,
  simTime: number,
  livingCount: number,
  eggCount: number,
  maxOrgs = 50,
  maxEggs = 75,
  populationIncludesEggs = false,
): {
  eligible: boolean;
  affordableCount: number;
  desiredCount: number;
  actualClutchSize: number;
  eggCost: number;
  parentReserve: number;
  availableForReproduction: number;
  requiredBudget: number;
  requiredForOneEgg: number;
  statusText: string;
  badgeClass: string;
  remainingCooldown: number;
} {
  const g = org.genome;
  const maturityAge = g.maturityAge || MATURITY_AGE;
  const desiredCount = g.targetClutchSize || 2;
  const parentReserve = Math.max(MIN_PARENT_SURVIVAL_RESERVE_BASE, g.maxEnergyCapacity * MIN_PARENT_SURVIVAL_FRACTION);
  const eggCost = g.bodyCost + getEggReserveFunding(g);
  const availableForReproduction = org.energy - parentReserve;
  const requiredForOneEgg = eggCost + parentReserve;
  const requiredBudget = eggCost * desiredCount + parentReserve;
  const cooldown = g.reproductionCooldown || 18.0;
  const timeSinceRepro = simTime - (org.lastReproductionTime || 0);
  const remainingCooldown = Math.max(0, cooldown - timeSinceRepro);

  const affordableCount = Math.max(0, Math.floor(availableForReproduction / eggCost));
  const actualClutchSize = Math.max(0, Math.min(desiredCount, affordableCount,
    populationIncludesEggs ? maxOrgs - livingCount - eggCount : Infinity,
    populationIncludesEggs ? maxEggs - eggCount : Infinity));

  if (org.dissolving || org.dissolveAlpha < 1.0) {
    return {
      eligible: false,
      affordableCount: 0,
      desiredCount,
      actualClutchSize: 0,
      eggCost,
      parentReserve,
      availableForReproduction: 0,
      requiredBudget,
      requiredForOneEgg,
      statusText: '💀 Deceased',
      badgeClass: 'bg-slate-900 border-slate-700 text-slate-500',
      remainingCooldown: 0,
    };
  }

  if (org.age < maturityAge) {
    const timeToMaturity = maturityAge - org.age;
    return {
      eligible: false,
      affordableCount: 0,
      desiredCount,
      actualClutchSize: 0,
      eggCost,
      parentReserve,
      availableForReproduction,
      requiredBudget,
      requiredForOneEgg,
      statusText: `🌱 Immature (${timeToMaturity.toFixed(1)}s to maturity)`,
      badgeClass: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300',
      remainingCooldown: 0,
    };
  }

  if (livingCount + (populationIncludesEggs ? eggCount : 0) >= maxOrgs) {
    return {
      eligible: false,
      affordableCount,
      desiredCount,
      actualClutchSize,
      eggCost,
      parentReserve,
      availableForReproduction,
      requiredBudget,
      requiredForOneEgg,
      statusText: '🚫 Pop Cap Reached',
      badgeClass: 'bg-rose-950/80 border-rose-500/40 text-rose-300',
      remainingCooldown: 0,
    };
  }

  if (eggCount >= maxEggs) {
    return {
      eligible: false,
      affordableCount,
      desiredCount,
      actualClutchSize,
      eggCost,
      parentReserve,
      availableForReproduction,
      requiredBudget,
      requiredForOneEgg,
      statusText: '🥚 Egg Cap Reached',
      badgeClass: 'bg-amber-950/80 border-amber-500/40 text-amber-300',
      remainingCooldown: 0,
    };
  }

  if (remainingCooldown > 0.05) {
    return {
      eligible: false,
      affordableCount,
      desiredCount,
      actualClutchSize,
      eggCost,
      parentReserve,
      availableForReproduction,
      requiredBudget,
      requiredForOneEgg,
      statusText: `⏳ Cooldown (${remainingCooldown.toFixed(1)}s)`,
      badgeClass: 'bg-blue-950/80 border-blue-500/40 text-blue-300',
      remainingCooldown,
    };
  }

  if (actualClutchSize < 1) {
    return {
      eligible: false,
      affordableCount: 0,
      desiredCount,
      actualClutchSize: 0,
      eggCost,
      parentReserve,
      availableForReproduction,
      requiredBudget,
      requiredForOneEgg,
      statusText: `⚡ Foraging for 1st egg (${Math.round(Math.max(0, org.energy))} / ${Math.round(requiredForOneEgg)} J)`,
      badgeClass: 'bg-slate-900/80 border-slate-700 text-slate-400',
      remainingCooldown: 0,
    };
  }

  return {
    eligible: true,
    affordableCount,
    desiredCount,
    actualClutchSize,
    eggCost,
    parentReserve,
    availableForReproduction,
    requiredBudget,
    requiredForOneEgg,
    statusText: `★ Ready (Laying ${actualClutchSize}/${desiredCount} eggs)`,
    badgeClass: 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold',
    remainingCooldown: 0,
  };
}

export function getDietClassification(mouths: SensoryMouth[] | undefined): DietInfo {
  if (!mouths || mouths.length === 0) {
    return {
      category: 'Passive',
      label: 'Passive Grazer',
      composition: '0 Mouths (Passive)',
      badgeClass: 'bg-slate-900/80 border-slate-700 text-slate-400',
      textClass: 'text-slate-400',
      icon: '⚪',
      herbivores: 0,
      carnivores: 0,
      omnivores: 0,
    };
  }

  let herbivores = 0;
  let carnivores = 0;
  let omnivores = 0;

  for (const m of mouths) {
    if (m.mouthType === 'carnivore') carnivores++;
    else if (m.mouthType === 'omnivore') omnivores++;
    else herbivores++;
  }

  const parts: string[] = [];
  if (carnivores > 0) parts.push(`${carnivores} Carnivore`);
  if (omnivores > 0) parts.push(`${omnivores} Omnivore`);
  if (herbivores > 0) parts.push(`${herbivores} Herbivore`);
  const composition = parts.join(' · ');

  if (carnivores > 0 && herbivores === 0 && omnivores === 0) {
    return {
      category: 'Carnivore',
      label: 'Carnivore',
      composition,
      badgeClass: 'bg-rose-950/80 border-rose-500/40 text-rose-300',
      textClass: 'text-rose-400 font-bold',
      icon: '🥩',
      herbivores: 0,
      carnivores,
      omnivores: 0,
    };
  }

  if (herbivores > 0 && carnivores === 0 && omnivores === 0) {
    return {
      category: 'Herbivore',
      label: 'Herbivore',
      composition,
      badgeClass: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300',
      textClass: 'text-emerald-400 font-bold',
      icon: '🌿',
      herbivores,
      carnivores: 0,
      omnivores: 0,
    };
  }

  // Overall diet follows edible categories; mouth anatomy remains individually typed.
  return {
    category: 'Omnivore', label: 'Omnivore', composition,
    badgeClass: 'bg-purple-950/80 border-purple-500/40 text-purple-300',
    textClass: 'text-purple-300 font-bold', icon: '🟣',
    herbivores, carnivores, omnivores,
  };
}

export function recordFeedingEvent(
  org: Organism,
  simTime: number,
  mouthId: string,
  mouthType: MouthType,
  foodCategory: FoodCategory,
  energyTransferred: number,
) {
  if (energyTransferred <= 0) return;
  if (!org.recentFeedings) org.recentFeedings = [];

  const last = org.recentFeedings[org.recentFeedings.length - 1];
  if (
    last &&
    last.mouthId === mouthId &&
    last.foodCategory === foodCategory &&
    simTime - last.timestamp < 0.25
  ) {
    last.energyTransferred += energyTransferred;
    last.timestamp = simTime;
  } else {
    org.recentFeedings.push({
      timestamp: simTime,
      mouthId,
      mouthType,
      foodCategory,
      energyTransferred,
    });
    if (org.recentFeedings.length > 8) {
      org.recentFeedings.shift();
    }
  }
}

export function getNutrientRadius(energy: number): number {
  const ratio = Math.max(0.1, energy / NUTRIENT_ENERGY_VALUE);
  const scale = 1 + 0.35 * Math.log2(ratio);
  return Math.max(8.0, BASE_NUTRIENT_RADIUS * Math.max(0.4, scale));
}

/**
 * Repeatable abiotic bloom sites in the tank, with no organism influence.
 * Center jitter uses an independent seed stream, so observing the sites or
 * loading a save never advances the world's PRNG. The same seed and tank
 * dimensions reproduce the same fixed sites after exact-state continuation.
 */
export function nutrientBloomCenters(state: Pick<SimulationState, 'initialSeed'>,
  settings: Pick<SimulationSettings, 'worldWidth' | 'worldHeight'>): {x: number; y: number}[] {
  const local = new XoshiroPRNG(((state.initialSeed ?? 0) ^ 0x6d2b79f5) >>> 0);
  const centers: {x: number; y: number}[] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    centers.push({
      x: (col + .5 + local.range(-.16, .16)) * settings.worldWidth / 4,
      y: (row + .5 + local.range(-.16, .16)) * settings.worldHeight / 3,
    });
  }
  return centers;
}

/** Shared by initialization, environmental inflow, Feed and Feed All. */
export function nutrientSpawnSlots(state: SimulationState, settings: SimulationSettings): number {
  const plants = state.nutrients.filter(n => n.kind !== 'carrion').length;
  if (state.energyPool) return Math.max(0, Math.min(
    (settings.nutrientLimit ?? Infinity) - plants,
    FOOD_SAFETY_LIMIT - state.nutrients.length,
    Math.floor(Math.max(0, state.energyPool.reserve) / NUTRIENT_ENERGY_VALUE)));
  return Math.max(0, Math.min(Math.floor(settings.targetNutrients) - plants, 2200 - state.nutrients.length));
}

export function addNutrients(state: SimulationState, settings: SimulationSettings, requested: number,
  patch?: {x: number; y: number; spread: number}): number {
  const count = Math.min(Math.max(0, Math.floor(requested)), nutrientSpawnSlots(state, settings));
  const prng = state.prng;
  // In bloom mode, 65% of abiotic input is clustered around twelve stable
  // sites, while 35% remains dispersed. No sources track organism locations,
  // energy, diets, deaths or reproductive needs. The manual Feed patch
  // argument always takes precedence. Uniform/old saves take the original
  // PRNG path byte-for-byte.
  const bloomCenters = !patch && settings.nutrientPattern === 'blooms'
    ? nutrientBloomCenters(state, settings) : undefined;
  const spread = Math.max(40, Math.min(170, Math.min(settings.worldWidth, settings.worldHeight) * .12));
  for (let i = 0; i < count; i++) {
    const bloom = bloomCenters && prng.nextFloat() < .65
      ? bloomCenters[prng.rangeInt(0, bloomCenters.length - 1)] : undefined;
    const center = patch ?? (bloom && {x: bloom.x, y: bloom.y, spread});
    state.nutrients.push({id: `NUT-${prng.nextUint32().toString(36)}`,
      x: center ? clampVal(center.x + prng.range(-center.spread, center.spread), 40, settings.worldWidth - 40) : prng.range(40, settings.worldWidth - 40),
      y: center ? clampVal(center.y + prng.range(-center.spread, center.spread), 40, settings.worldHeight - 40) : prng.range(40, settings.worldHeight - 40),
      vx: 0, vy: 0, energyValue: NUTRIENT_ENERGY_VALUE, radius: getNutrientRadius(NUTRIENT_ENERGY_VALUE),
      bottomTimer: 0, pulseTimer: prng.range(0, Math.PI * 2)});
    if (state.energyPool) state.energyPool.reserve -= NUTRIENT_ENERGY_VALUE;
    else state.ledger.externalInflow += NUTRIENT_ENERGY_VALUE;
  }
  return count;
}

export function getOppositeCardinalDir(dir: CardinalDir): CardinalDir {
  switch (dir) {
    case 'EAST': return 'WEST';
    case 'WEST': return 'EAST';
    case 'NORTH': return 'SOUTH';
    case 'SOUTH': return 'NORTH';
  }
}

export function isFaceWide(dir: CardinalDir, dimN: number, dimM: number): boolean {
  if (dir === 'NORTH' || dir === 'SOUTH') {
    return dimN > dimM;
  } else {
    return dimM > dimN;
  }
}

export function isValidAttachment(
  parentAttachmentPoint: CardinalDir,
  parentN: number,
  parentM: number,
  childN: number,
  childM: number,
): boolean {
  const isParentWide = isFaceWide(parentAttachmentPoint, parentN, parentM);
  const childMatingFace = getOppositeCardinalDir(parentAttachmentPoint);
  const isChildWide = isFaceWide(childMatingFace, childN, childM);
  return !(isParentWide && isChildWide);
}

export function generateCompliantChildDimensions(
  parentDir: CardinalDir,
  parentN: number,
  parentM: number,
  customPrng: XoshiroPRNG = rng,
): {dimN: number; dimM: number} {
  const parentWide = isFaceWide(parentDir, parentN, parentM);
  if (parentWide) {
    if (parentDir === 'EAST' || parentDir === 'WEST') {
      const dimN = customPrng.rangeInt(3, 7);
      const dimM = customPrng.rangeInt(1, dimN);
      return {dimN, dimM};
    } else {
      const dimM = customPrng.rangeInt(3, 7);
      const dimN = customPrng.rangeInt(1, dimM);
      return {dimN, dimM};
    }
  } else {
    const dimN = customPrng.rangeInt(2, 6);
    const dimM = customPrng.rangeInt(2, 6);
    return {dimN, dimM};
  }
}

export function areSiblings(a: Organism, b: Organism): boolean {
  if (a.id === b.id) return true;
  if (a.genome.parentIds.includes(b.id) || b.genome.parentIds.includes(a.id)) return true;
  if (a.clutchId && b.clutchId && a.clutchId === b.clutchId) return true;
  if (
    a.genome.generation === b.genome.generation &&
    a.genome.parentIds.length > 0 &&
    b.genome.parentIds.length > 0
  ) {
    for (const pA of a.genome.parentIds) {
      if (b.genome.parentIds.includes(pA)) return true;
    }
  }
  return false;
}

export function isEggKin(org: Organism, egg: Egg): boolean {
  if (egg.parentOrgId === org.id) return true;
  if (egg.clutchId && org.clutchId && egg.clutchId === org.clutchId) return true;
  if (egg.genome.parentIds && egg.genome.parentIds.includes(org.id)) return true;
  if (org.genome.parentIds && egg.genome.parentIds) {
    for (const p of org.genome.parentIds) {
      if (egg.genome.parentIds.includes(p)) return true;
    }
  }
  return false;
}

export function getCardinalAnchor(dir: CardinalDir, width: number, height: number): {x: number; y: number} {
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  switch (dir) {
    case 'EAST': return {x: halfW, y: 0};
    case 'WEST': return {x: -halfW, y: 0};
    case 'NORTH': return {x: 0, y: -halfH};
    case 'SOUTH': return {x: 0, y: halfH};
  }
}

/** Both ends of every hinge occupy their respective local faces. */
export function physicalFaces(parts: PartDef[]): Set<string> {
  const faces = new Set<string>();
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    faces.add(`${p.parentIndex}:${p.attachmentPoint}`);
    faces.add(`${i}:${getOppositeCardinalDir(p.attachmentPoint)}`);
  }
  return faces;
}

type SurfaceAnatomy = Pick<Genome, 'parts' | 'eyes' | 'mouths'>;
export function availableOrganSlots(g: SurfaceAnatomy): Array<Required<Pick<SurfaceOrgan, 'partIndex' | 'direction' | 'slot'>>> {
  const physical = physicalFaces(g.parts);
  const occupied = new Set([...g.eyes, ...g.mouths].map(o => `${o.partIndex}:${o.direction}:${o.slot ?? 0}`));
  return g.parts.flatMap((_, partIndex) => CARDINAL_DIRS.flatMap(direction =>
    physical.has(`${partIndex}:${direction}`) ? [] : ([0, 1, 2] as const)
      .filter(slot => !occupied.has(`${partIndex}:${direction}:${slot}`))
      .map(slot => ({partIndex, direction, slot}))));
}

export function surfacePlacementProblems(g: SurfaceAnatomy): string[] {
  const physical = physicalFaces(g.parts), occupied = new Set<string>(), problems: string[] = [];
  for (const organ of [...g.eyes, ...g.mouths]) {
    const face = `${organ.partIndex}:${organ.direction}`, key = `${face}:${organ.slot}`;
    if (!Number.isInteger(organ.partIndex) || organ.partIndex < 0 || organ.partIndex >= g.parts.length
      || !CARDINAL_DIRS.includes(organ.direction) || ![0, 1, 2].includes(organ.slot!)) problems.push(`Invalid organ slot ${organ.id}`);
    if (physical.has(face)) problems.push(`Physical face occupied by organ ${organ.id}`);
    if (occupied.has(key)) problems.push(`Duplicate organ slot ${organ.id}`);
    occupied.add(key);
  }
  return problems;
}

/** Deterministic repair after host pruning or a physical topology change. IDs survive. */
export function normalizeSurfaceOrgans(g: SurfaceAnatomy): void {
  const physical = physicalFaces(g.parts), occupied = new Set<string>();
  // Mouths keep their apertures before new eyes are fitted around them.
  for (const organ of [...g.mouths, ...g.eyes]) {
    const slots = g.parts.flatMap((_, partIndex) => CARDINAL_DIRS.flatMap(direction =>
      physical.has(`${partIndex}:${direction}`) ? [] : ([0, 1, 2] as const)
        .filter(slot => !occupied.has(`${partIndex}:${direction}:${slot}`))
        .map(slot => ({partIndex, direction, slot}))));
    const preferred = organ.slot ?? 0;
    slots.sort((a, b) => {
      const score = (p: typeof a) => (p.partIndex === organ.partIndex ? 0 : 100 + Math.abs(p.partIndex - organ.partIndex))
        + (p.direction === organ.direction ? 0 : 10) + (p.slot === preferred ? 0 : p.slot + 1);
      return score(a) - score(b);
    });
    const placement = slots[0];
    if (!placement) throw new Error('No free surface slot for organ');
    Object.assign(organ, placement);
    occupied.add(`${placement.partIndex}:${placement.direction}:${placement.slot}`);
  }
}

/** Shared by the renderer, retinal rays and contact feeding; never animated. */
export function getOrganAnchor(organ: SurfaceOrgan, width: number, height: number): {x: number; y: number} {
  const center = getCardinalAnchor(organ.direction, width, height);
  const offset = organ.slot === 1 ? -1 / 3 : organ.slot === 2 ? 1 / 3 : 0;
  if (organ.direction === 'NORTH' || organ.direction === 'SOUTH') center.x += width * offset;
  else center.y += height * offset;
  return center;
}

export function getChildAnchorForParentDir(dir: CardinalDir, width: number, height: number): {x: number; y: number} {
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  switch (dir) {
    case 'EAST': return {x: -halfW, y: 0};
    case 'WEST': return {x: halfW, y: 0};
    case 'NORTH': return {x: 0, y: halfH};
    case 'SOUTH': return {x: 0, y: -halfH};
  }
}

export function getCardinalBaseAngle(dir: CardinalDir): number {
  switch (dir) {
    case 'EAST': return 0;
    case 'WEST': return Math.PI;
    case 'NORTH': return -Math.PI / 2;
    case 'SOUTH': return Math.PI / 2;
  }
}

export function getCardinalOutwardNormal(dir: CardinalDir): {x: number; y: number} {
  switch (dir) {
    case 'EAST': return {x: 1, y: 0};
    case 'WEST': return {x: -1, y: 0};
    case 'NORTH': return {x: 0, y: -1};
    case 'SOUTH': return {x: 0, y: 1};
  }
}

export function calculateBodyCost(parts: PartDef[], eyes: SensoryEye[], mouths: SensoryMouth[]): number {
  let cost = 1200.0; // BASE_BODY_COST scaled for tissue mass
  for (const part of parts) {
    cost += part.dimN * part.dimM * 80.0;
  }
  cost += eyes.length * 250.0;
  cost += mouths.length * 400.0;
  cost += Math.max(0, parts.length - 1) * 200.0;
  return Math.round(cost);
}

export function calculateTotalBodyArea(parts: PartDef[]): number {
  let area = 0;
  for (const part of parts) {
    area += part.dimN * part.dimM;
  }
  return Math.max(4.0, area);
}

export function calculateMaxEnergyCapacity(parts: PartDef[], storageMultiplier = 1.0): number {
  const totalArea = calculateTotalBodyArea(parts);
  const scaledCapacity = FOUNDER_DEFAULT_CAPACITY * (totalArea / BASE_FOUNDER_AREA) * storageMultiplier;
  return Math.round(clampVal(scaledCapacity, 40000.0, 300000.0));
}

export function formatJoules(value: number): string {
  if (isNaN(value) || !isFinite(value)) return '0 J';
  const val = Math.round(value);
  if (Math.abs(val) >= 1000000) {
    return `${(val / 1000000).toFixed(2)}M J`;
  }
  if (Math.abs(val) >= 10000) {
    return `${(val / 1000).toFixed(1)}k J`;
  }
  return `${val.toLocaleString()} J`;
}

export function createPartDef(
  id: string,
  parentIndex: number,
  attachmentPoint: CardinalDir,
  dimN: number,
  dimM: number,
  maxAngle = 2.0,
  baseAngleOffset = 0,
  cpgPhaseOffset = 0,
  cpgAmp = 1.0,
  cpgFreqMult = 1.0,
): PartDef {
  const nClamped = clampVal(Math.round(dimN), 1, 10);
  const mClamped = clampVal(Math.round(dimM), 1, 10);
  return {
    id,
    parentIndex,
    attachmentPoint,
    dimN: nClamped,
    dimM: mClamped,
    width: nClamped * UNIT_SIZE,
    height: mClamped * UNIT_SIZE,
    maxAngle: clampVal(maxAngle, 0.6, 2.35),
    baseAngleOffset,
    cpgPhaseOffset,
    cpgAmp,
    cpgFreqMult,
  };
}

// Xavier/Glorot Initialization for Recurrent Neural Controller
export function createXavierRecurrentNetwork(customPrng: XoshiroPRNG = rng, inputCount = NUM_INPUTS, outputCount = LEGACY_MAX_OUTPUTS, hiddenCount = NUM_HIDDEN): {
  weightsIH: number[][];
  weightsHH: number[][];
  biasesH: number[];
  weightsHO: number[][];
  biasesO: number[];
} {
  if (!Number.isInteger(hiddenCount) || hiddenCount < 1 || hiddenCount > MAX_HIDDEN) throw new Error('Invalid hidden neuron count');
  const limitIH = Math.sqrt(6.0 / (inputCount + hiddenCount));
  const limitHH = Math.sqrt(6.0 / (hiddenCount + hiddenCount));
  const limitHO = Math.sqrt(6.0 / (hiddenCount + outputCount));

  const weightsIH: number[][] = Array.from({length: hiddenCount}, () =>
    Array.from({length: inputCount}, () => customPrng.range(-limitIH, limitIH)),
  );
  const weightsHH: number[][] = Array.from({length: hiddenCount}, () =>
    Array.from({length: hiddenCount}, () => customPrng.range(-limitHH * 0.8, limitHH * 0.8)),
  );
  const biasesH = Array.from({length: hiddenCount}, () => customPrng.range(-0.05, 0.05));
  const weightsHO: number[][] = Array.from({length: outputCount}, () =>
    Array.from({length: hiddenCount}, () => customPrng.range(-limitHO, limitHO)),
  );
  const biasesO = Array.from({length: outputCount}, () => customPrng.range(-0.05, 0.05));

  return {weightsIH, weightsHH, biasesH, weightsHO, biasesO};
}

export function getBrainLayout(g: Pick<Genome, 'eyes' | 'parts'> & Partial<Pick<Genome, 'mouths'>>, internalSenses = true, injurySense = true) {
  const inputs: string[] = [];
  const labels: string[] = [];
  g.eyes.forEach((eye, e) => {
    for (let ray = 0; ray < RAYS_PER_EYE; ray++) {
      for (const channel of ['red', 'green', 'blue', 'distance']) {
        inputs.push(`eye:${eye.id}:ray:${ray}:${channel}`);
        labels.push(`E${e + 1} R${ray + 1} ${channel}`);
      }
    }
  });
  g.parts.slice(1).forEach((p, j) => {
    for (const channel of ['angle', 'velocity']) {
      inputs.push(`joint:${p.id}:${channel}`);
      labels.push(`J${j + 1} ${channel}`);
    }
  });
  inputs.push('body:speed', 'body:energy', 'body:sin', 'body:cos');
  labels.push('Speed', 'Energy', 'CPG sin', 'CPG cos');
  for (const [m, mouth] of (g.mouths ?? []).entries()) {
    inputs.push(`mouth:${mouth.id}:contact`, `mouth:${mouth.id}:intake`);
    labels.push(`M${m + 1} food contact`, `M${m + 1} absorbed intake`);
  }
  if (internalSenses) {
    inputs.push('body:feeding', 'body:depth'); labels.push('Currently feeding', 'Depth / pressure');
    if (injurySense) {inputs.push('body:injury'); labels.push('Recently bitten (real energy loss)');}
  }
  const outputs = g.parts.slice(1).flatMap(p => OUTPUT_LABELS.map(channel => `joint:${p.id}:${channel}`));
  return {inputs, labels, outputs};
}

function legacyInputKeys(g: Genome): string[] {
  const keys: string[] = [];
  const rays = g.eyes.length === 1 ? 5 : Math.max(2, Math.floor(6 / g.eyes.length));
  for (const eye of g.eyes) {
    for (let r = 0; r < rays && keys.length < 15; r++) {
      // Preserve the old ray's angular position when the ray count expands.
      const index = Math.round(r * (RAYS_PER_EYE - 1) / Math.max(1, rays - 1));
      for (const channel of ['red', 'green', 'blue']) keys.push(`eye:${eye.id}:ray:${index}:${channel}`);
    }
  }
  while (keys.length < 15) keys.push(`unused:${keys.length}`);
  for (let j = 1; j <= 3; j++) keys.push(`joint:${g.parts[j]?.id ?? 'unused'}:angle`);
  keys.push('body:speed', 'body:energy', 'body:sin', 'body:cos');
  return keys;
}

function legacyOutputKeys(g: Genome): string[] {
  return g.parts.slice(1).flatMap(p => OUTPUT_LABELS.slice(0, LEGACY_OUTPUTS_PER_JOINT).map(channel => `joint:${p.id}:${channel}`));
}

/** Stable, unambiguous key for disabling one directed connection. */
export function brainEdgeKey(kind: 'ih' | 'hh' | 'ho', target: string, source: string): string {
  return JSON.stringify([kind, target, source]);
}

function defaultHiddenIds(count: number): string[] {
  return Array.from({length: count}, (_, i) => `hidden:${i}`);
}

/** First-order, frame-duration-aware neuron response. Tau=0 preserves the exact
 * original recurrence, with no extra floating-point arithmetic in that path.
 * Positive tau uses the old tick's hidden activation to blend the new target.
 */
export function integrateNeuronMemory(previous: number, target: number, tauSeconds: number, dtSeconds: number): number {
  if (tauSeconds === 0) return target;
  const alpha = -Math.expm1(-dtSeconds / tauSeconds);
  return previous + alpha * (target - previous);
}

/** Live maintenance cost for stored activation timescales; legacy networks pay zero. */
export function memoryUpkeep(g: Pick<Genome, 'hiddenTimeConstants'>): number {
  return MEMORY_METABOLIC_RATE * (g.hiddenTimeConstants?.reduce((sum, tau) => sum + tau, 0) ?? 0);
}

/** Count enabled directed synapses without allocating their keys. */
/** Heritable learner selects from existing, ENABLED motor synapses only.
 * Old Angle-only genomes retain their exact old order and upkeep. An
 * evolved 'all' allele fairly samples every joint's six motor channels,
 * interleaving outputs before advancing hidden neuron IDs. The 96-edge
 * ceiling and the disabled-connection mask are identical for either scope.
 */
export function plasticMotorEdges(g: Genome): Array<{edge: string; output: number; hidden: number}> {
  return compiledBrain(g).motor;
}

/** A heritable capability to associate physical optical RGB channels with
 * hidden activity. No object identity, debug ray label, wall, or target
 * coordinate enters this pathway. Only existing ENABLED sensory synapses
 * are eligible. An absent gene allocates nothing and changes no old math.
 * Each sampled hidden unit sees diverse real rays and spectral channels;
 * dormant genetic connections remain dormant.
 */
export function plasticSensoryEdges(g: Genome): Array<{edge: string; input: number; hidden: number}> {
  return compiledBrain(g).sensory;
}

/** Optional consolidation of compatible, already learned experiences.
 * The sign of the existing synapse change must agree with the new,
 * genuinely rewarded/punished eligibility. Mere recurrent activity, vision
 * or a single first update cannot consolidate a previously absent memory.
 * Contradictory feedback weakens retention faster; unreinforced memory
 * loses consolidation slowly. The rate is heritable; the strength isn't.
 * Return undefined for old organisms to preserve v0.23 save/step semantics.
 */
const retentionScratch: {forget: number; consolidation?: number} = {forget: 1};
const plasticTargets = new Float64Array(96);
const plasticEligibility = new Float64Array(96);
const plasticConsolidation = new Float64Array(96);

function nextRetention(
  g: Genome, old: {delta: number; consolidation?: number} | undefined,
  teaching: number, dt: number,
): {forget: number; consolidation?: number} {
  const baseline = g.forgettingRate ?? .1;
  const rate = g.memoryConsolidationRate ?? 0;
  if (rate <= 0) {
    retentionScratch.forget = Math.exp(-baseline * dt);
    retentionScratch.consolidation = undefined;
    return retentionScratch;
  }
  const strength = old?.consolidation ?? 0;
  const consistent = old && old.delta * teaching > 0;
  const contradictory = old && old.delta * teaching < 0;
  const gain = consistent ? rate * Math.min(1, Math.abs(teaching)) * (1 - strength) * dt : 0;
  const decay = strength * rate * (contradictory ? .5 : .008) * dt;
  retentionScratch.forget = Math.exp(-baseline * (1 - .95 * strength) * dt);
  retentionScratch.consolidation = clampVal(strength + gain - decay, 0, 1);
  return retentionScratch;
}

/** Learned retinal associations use precisely the same somatic energy
 * accounting and clamped eligibility principle as motor learning.
 * Food intake reinforces currently coactive retinal→hidden channels;
 * bites can weaken them if the lineage evolved injury aversion.
 * The acquired deltas affect NEXT tick's sensory evaluation. No
 * teaching occurs from mere sight without real reward/punishment.
 */
export function applySensoryAssociations(
  org: Organism, dt: number, ledger: SimulationState['ledger'],
): number {
  const g = org.genome;
  if (!(g.sensoryPlasticityRate && g.sensoryPlasticityRate > 0) || dt <= 0 || org.dissolving) return 0;
  const edges = plasticSensoryEdges(g);
  if (!edges.length) return 0;
  const records = org.learnedSensoryWeights = alignPlasticRecords(org.learnedSensoryWeights, edges);
  const alpha = -Math.expm1(-dt / PLASTIC_ELIGIBILITY_SECONDS);
  let reward = 0;
  for (const mouth of g.mouths) reward = Math.max(reward, org.mouthFeedback?.[mouth.id]?.intake ?? 0);
  reward = clampVal(reward, 0, 1);
  const injuryIndex = g.inputKeys!.indexOf('body:injury');
  const injury = injuryIndex >= 0 ? clampVal(org.neuralInputs[injuryIndex] ?? 0, 0, 1) : 0;
  const valence = g.sensoryPlasticityRate * reward - (g.injuryAversionRate ?? 0) * injury;
  let stable = 0, change = 0;
  for (let i = 0; i < edges.length; i++) {
    const {input, hidden} = edges[i], old = records[i];
    const pre = clampVal(org.neuralInputs[input] ?? 0, 0, 1);
    const eligibility = clampVal(old.eligibility * (1 - alpha)
      + alpha * pre * org.neuralHidden[hidden], -1, 1);
    const teaching = valence * eligibility;
    const retention = nextRetention(g, old, teaching, dt);
    const target = clampVal(old.delta * retention.forget + teaching * dt,
      -MAX_LEARNED_MOTOR_DELTA, MAX_LEARNED_MOTOR_DELTA);
    plasticTargets[i] = target; plasticEligibility[i] = eligibility;
    plasticConsolidation[i] = retention.consolidation ?? 0;
    stable += plasticConsolidation[i]; change += Math.abs(target - old.delta);
  }
  const stableUpkeep = stable * CONSOLIDATED_MEMORY_UPKEEP_J_PER_SECOND * dt;
  const upkeep = Math.min(org.energy, edges.length * PLASTIC_UPKEEP_J_PER_EDGE_SECOND * dt + stableUpkeep);
  const wanted = change * PLASTIC_REWRITE_J_PER_WEIGHT;
  const paid = Math.min(wanted, Math.max(0, org.energy - upkeep));
  const scale = wanted > 0 ? paid / wanted : 1;
  const cost = upkeep + paid;
  org.energy -= cost;
  ledger.metabolicDissipation += cost;
  for (let i = 0; i < records.length; i++) {
    const record = records[i], oldConsolidation = record.consolidation ?? 0;
    record.delta += (plasticTargets[i] - record.delta) * scale;
    record.eligibility = plasticEligibility[i];
    if ((g.memoryConsolidationRate ?? 0) > 0) record.consolidation = oldConsolidation
      + (plasticConsolidation[i] - oldConsolidation) * (plasticConsolidation[i] > oldConsolidation ? scale : 1);
    else delete record.consolidation;
  }
  return cost;
}

/** Applies signed reinforcement-modulated, time-decaying motor eligibility
 * after neural evaluation. Positive reward is only REAL previous-tick mouth
 * assimilation; optional negative teaching comes only from the actual bite
 * energy already exposed by body:injury. No target coordinates, scores,
 * hand-chosen movement directions or object-identity oracle.
 * Upkeep + actual weight rewriting is debited from the creature's reserve
 * and credited to metabolic heat before physical work is charged.
 * Learned offsets are per-organism and NEVER copied into a genome.
 */
export function applyWakingPlasticity(
  org: Organism, dt: number, ledger: SimulationState['ledger'],
): number {
  const g = org.genome;
  if (!(g.plasticityRate && g.plasticityRate > 0) || dt <= 0 || org.dissolving) return 0;
  const edges = plasticMotorEdges(g);
  if (edges.length === 0) return 0;
  const records = org.learnedMotorWeights = alignPlasticRecords(org.learnedMotorWeights, edges);
  const factor = -Math.expm1(-dt / PLASTIC_ELIGIBILITY_SECONDS);
  let reward = 0;
  for (const mouth of g.mouths) reward = Math.max(reward, org.mouthFeedback?.[mouth.id]?.intake ?? 0);
  reward = clampVal(reward, 0, 1);
  const injuryIndex = g.inputKeys!.indexOf('body:injury');
  const injury = injuryIndex >= 0 ? clampVal(org.neuralInputs[injuryIndex] ?? 0, 0, 1) : 0;
  const valence = g.plasticityRate! * reward - (g.injuryAversionRate ?? 0) * injury;
  let stable = 0, requestedChange = 0;
  for (let i = 0; i < edges.length; i++) {
    const {output, hidden} = edges[i], previous = records[i];
    const eligibility = clampVal(previous.eligibility * (1 - factor)
      + factor * org.neuralHidden[hidden] * org.neuralOutputs[output], -1, 1);
    const teaching = valence * eligibility;
    const retention = nextRetention(g, previous, teaching, dt);
    const requested = clampVal(previous.delta * retention.forget + teaching * dt,
      -MAX_LEARNED_MOTOR_DELTA, MAX_LEARNED_MOTOR_DELTA);
    plasticTargets[i] = requested; plasticEligibility[i] = eligibility;
    plasticConsolidation[i] = retention.consolidation ?? 0;
    stable += plasticConsolidation[i]; requestedChange += Math.abs(requested - previous.delta);
  }
  const upkeep = PLASTIC_UPKEEP_J_PER_EDGE_SECOND * edges.length * dt
    + stable * CONSOLIDATED_MEMORY_UPKEEP_J_PER_SECOND * dt;
  const upkeepPaid = Math.min(org.energy, upkeep);
  const availableForUpdates = Math.max(0, org.energy - upkeepPaid);
  const changePrice = requestedChange * PLASTIC_REWRITE_J_PER_WEIGHT;
  const scale = changePrice > 0 ? Math.min(1, availableForUpdates / changePrice) : 1;
  const rewritePaid = changePrice * scale;
  const total = upkeepPaid + rewritePaid;
  org.energy -= total;
  ledger.metabolicDissipation += total;
  for (let i = 0; i < records.length; i++) {
    const record = records[i], oldConsolidation = record.consolidation ?? 0;
    record.delta += (plasticTargets[i] - record.delta) * scale;
    record.eligibility = plasticEligibility[i];
    if ((g.memoryConsolidationRate ?? 0) > 0) record.consolidation = oldConsolidation
      + (plasticConsolidation[i] - oldConsolidation) * (plasticConsolidation[i] > oldConsolidation ? scale : 1);
    else delete record.consolidation;
  }
  return total;
}

export function enabledBrainEdgeCount(g: Genome): number {
  const h = g.hiddenIds?.length ?? g.biasesH.length;
  const inputs = g.inputKeys?.length ?? g.weightsIH[0]?.length ?? 0;
  const outputs = g.outputKeys?.length ?? g.weightsHO.length;
  return h * (inputs + h + outputs) - (g.disabledConnections?.length ?? 0);
}

function checkBrainBudget(g: Genome): void {
  const count = g.hiddenIds?.length ?? g.biasesH.length;
  if (!Number.isInteger(count) || count < 1 || count > MAX_HIDDEN
    || enabledBrainEdgeCount(g) < 0 || enabledBrainEdgeCount(g) > MAX_ENABLED_BRAIN_EDGES) {
    throw new Error('Invalid hidden neuron or enabled neural edge budget');
  }
}

/** Preserve connections and hidden biases by stable identity, not shifting matrix indices. */
export function remapBrain(g: Genome, previous: Genome = g): void {
  invalidateCompiledBrain(g);
  const layout = getBrainLayout(g);
  const oldInputs = previous.inputKeys ?? legacyInputKeys(previous);
  const oldOutputs = previous.outputKeys ?? legacyOutputKeys(previous);
  const oldHidden = previous.hiddenIds ?? defaultHiddenIds(previous.biasesH.length);
  const nextHidden = g.hiddenIds ?? oldHidden;
  if (nextHidden.length < 1 || nextHidden.length > MAX_HIDDEN || new Set(nextHidden).size !== nextHidden.length) {
    throw new Error('Invalid hidden neuron identities');
  }
  const inputIndex = new Map(oldInputs.map((key, i) => [key, i]));
  const outputIndex = new Map(oldOutputs.map((key, i) => [key, i]));
  const hiddenIndex = new Map(oldHidden.map((key, i) => [key, i]));
  const ih = previous.weightsIH, hh = previous.weightsHH, ho = previous.weightsHO;
  const hiddenBias = previous.biasesH, outputBias = previous.biasesO;
  const previousTimes = previous.hiddenTimeConstants ?? oldHidden.map(() => 0);
  g.weightsIH = nextHidden.map(id => layout.inputs.map(key => {
    const h = hiddenIndex.get(id), i = inputIndex.get(key);
    let weight = h === undefined || i === undefined ? 0 : ih[h]?.[i] ?? 0;
    if (previous.brainVersion === undefined && key.startsWith('joint:') && key.endsWith(':angle')) {
      const part = previous.parts.find(p => key === `joint:${p.id}:angle`);
      weight *= part?.maxAngle ?? 1;
    }
    return weight;
  }));
  g.weightsHH = nextHidden.map(target => nextHidden.map(source => {
    const h = hiddenIndex.get(target), rh = hiddenIndex.get(source);
    return h === undefined || rh === undefined ? 0 : hh[h]?.[rh] ?? 0;
  }));
  g.biasesH = nextHidden.map(id => {
    const i = hiddenIndex.get(id);
    return i === undefined ? 0 : hiddenBias[i] ?? 0;
  });
  g.hiddenTimeConstants = nextHidden.map(id => {
    const i = hiddenIndex.get(id);
    return i === undefined ? 0 : previousTimes[i] ?? 0;
  });
  g.weightsHO = layout.outputs.map(key => {
    const i = outputIndex.get(key);
    return nextHidden.map(id => {
      const h = hiddenIndex.get(id);
      return i === undefined || h === undefined ? 0 : ho[i]?.[h] ?? 0;
    });
  });
  g.biasesO = layout.outputs.map(key => {
    const i = outputIndex.get(key);
    return i === undefined ? 0 : outputBias[i] ?? 0;
  });
  const inputs = new Set(layout.inputs), outputs = new Set(layout.outputs), hidden = new Set(nextHidden);
  g.disabledConnections = (g.disabledConnections ?? previous.disabledConnections ?? []).filter(key => {
    let edge: unknown;
    try { edge = JSON.parse(key); } catch { return false; }
    if (!Array.isArray(edge) || edge.length !== 3 || !edge.every(v => typeof v === 'string')) return false;
    const [kind, target, source] = edge;
    if (brainEdgeKey(kind as 'ih' | 'hh' | 'ho', target, source) !== key) return false;
    return kind === 'ih' ? hidden.has(target) && inputs.has(source)
      : kind === 'hh' ? hidden.has(target) && hidden.has(source)
      : kind === 'ho' && outputs.has(target) && hidden.has(source);
  });
  g.hiddenIds = [...nextHidden];
  g.inputKeys = layout.inputs;
  g.outputKeys = layout.outputs;
  g.brainVersion = 7;
  checkBrainBudget(g);
}

export function ensureBrainLayout(g: Genome): void {
  if (g.brainVersion !== 7 || !g.inputKeys || !g.outputKeys || !g.hiddenIds || !g.disabledConnections || !g.hiddenTimeConstants) remapBrain(g);
  checkBrainBudget(g);
}

/** Remap an organism's live sensory, recurrent and motor states by their original IDs. */
export function remapOrganismBrain(org: Organism, previous: Genome): void {
  const oldInputs = previous.inputKeys ?? legacyInputKeys(previous);
  const oldOutputs = previous.outputKeys ?? legacyOutputKeys(previous);
  const oldHidden = previous.hiddenIds ?? defaultHiddenIds(previous.biasesH.length);
  const inputs = new Map(oldInputs.map((key, i) => [key, org.neuralInputs[i] ?? 0]));
  const outputs = new Map(oldOutputs.map((key, i) => [key, org.neuralOutputs[i] ?? 0]));
  const memory = new Map(oldHidden.map((key, i) => [key, org.neuralHidden[i] ?? 0]));
  remapBrain(org.genome, previous);
  org.neuralInputs = org.genome.inputKeys!.map(key => inputs.get(key) ?? 0);
  org.neuralHidden = org.genome.hiddenIds!.map(key => memory.get(key) ?? 0);
  org.neuralOutputs = org.genome.outputKeys!.map(key => outputs.get(key) ?? 0);
  if (org.learnedMotorWeights) {
    const allowed = new Set(plasticMotorEdges(org.genome).map(e => e.edge));
    org.learnedMotorWeights = org.learnedMotorWeights.filter(s => allowed.has(s.edge));
  }
  if (org.learnedSensoryWeights) {
    const allowed = new Set(plasticSensoryEdges(org.genome).map(e => e.edge));
    org.learnedSensoryWeights = org.learnedSensoryWeights.filter(s => allowed.has(s.edge));
  }
}

export function migrateOrganismBrain(org: Organism): void {
  const legacy = org.genome.brainVersion === undefined;
  const oldHidden = org.genome.hiddenIds ?? defaultHiddenIds(org.genome.biasesH.length);
  const memory = new Map(oldHidden.map((key, i) => [key, org.neuralHidden[i] ?? 0]));
  const outputValues = new Map((org.genome.outputKeys ?? legacyOutputKeys(org.genome)).map((key, i) => [key, org.neuralOutputs[i] ?? 0]));
  const oldKeys = org.genome.inputKeys ?? legacyInputKeys(org.genome);
  const values = new Map(oldKeys.map((key, i) => [key, org.neuralInputs[i] ?? 0]));
  ensureBrainLayout(org.genome);
  org.neuralInputs = org.genome.inputKeys!.map(key => {
    const value = values.get(key) ?? 0;
    if (legacy && key.startsWith('joint:') && key.endsWith(':angle')) {
      const part = org.genome.parts.find(p => key === `joint:${p.id}:angle`);
      return clampVal(value / Math.max(.01, part?.maxAngle ?? 1), -1, 1);
    }
    return value;
  });
  org.neuralHidden = org.genome.hiddenIds!.map(key => memory.get(key) ?? 0);
  org.neuralOutputs = org.genome.outputKeys!.map(key => outputValues.get(key) ?? 0);
  org.mouthFeedback ??= {};
  org.biteFeedbackJ ??= 0;
  for (const joint of org.joints) { joint.amplitude ??= 1; joint.engagement ??= 1; }
}

export function restSegments(parts: PartDef[], x = 0, y = 0): PartPhys[] {
  const segments: PartPhys[] = [];
  for (let i = 0; i < parts.length; i++) {
    const d = parts[i];
    if (i === 0) { segments.push({x, y, vx: 0, vy: 0, angle: 0, angVel: 0}); continue; }
    const p = segments[d.parentIndex];
    const pd = parts[d.parentIndex];
    const pa = getCardinalAnchor(d.attachmentPoint, pd.width, pd.height);
    const ca = getChildAnchorForParentDir(d.attachmentPoint, d.width, d.height);
    const angle = p.angle + d.baseAngleOffset;
    segments.push({x: p.x + Math.cos(p.angle) * pa.x - Math.sin(p.angle) * pa.y - Math.cos(angle) * ca.x + Math.sin(angle) * ca.y,
      y: p.y + Math.sin(p.angle) * pa.x + Math.cos(p.angle) * pa.y - Math.sin(angle) * ca.x - Math.cos(angle) * ca.y,
      angle, vx: 0, vy: 0, angVel: 0});
  }
  return segments;
}

export function morphologyProblems(parts: PartDef[]): string[] {
  const problems: string[] = [];
  if (parts.length < 1 || parts.length > MAX_PARTS || parts[0]?.parentIndex !== -1) return ['Invalid root or part count'];
  const ids = new Set<string>();
  const faces = new Set<string>();
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (ids.has(p.id)) problems.push(`Duplicate part ID ${p.id}`);
    ids.add(p.id);
    if (![p.dimN, p.dimM].every(n => Number.isInteger(n) && n >= 1 && n <= 10)) problems.push(`Invalid dimensions ${i}`);
    if (i === 0) continue;
    if (p.parentIndex < 0 || p.parentIndex >= i) return [...problems, `Invalid parent ${i}`];
    const parent = parts[p.parentIndex];
    const face = `${p.parentIndex}:${p.attachmentPoint}`;
    if (faces.has(face) || (p.parentIndex > 0 && getOppositeCardinalDir(parent.attachmentPoint) === p.attachmentPoint)) problems.push(`Occupied face ${i}`);
    faces.add(face);
    if (!isValidAttachment(p.attachmentPoint, parent.dimN, parent.dimM, p.dimN, p.dimM)) problems.push(`Wide attachment ${i}`);
  }
  const segments = restSegments(parts);
  const boxes = parts.map((p, i) => getPartCornerVertices(segments[i], p));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    let overlap = true;
    for (const box of [boxes[i], boxes[j]]) for (let k = 0; k < 4; k++) {
      const a = box[k], b = box[(k + 1) % 4];
      const project = (v: {x: number; y: number}) => v.x * (a.y - b.y) + v.y * (b.x - a.x);
      const aa = boxes[i].map(project), bb = boxes[j].map(project);
      if (Math.min(Math.max(...aa), Math.max(...bb)) - Math.max(Math.min(...aa), Math.min(...bb)) <= 1e-7) overlap = false;
    }
    if (overlap) problems.push(`Overlapping parts ${i},${j}`);
  }
  return problems;
}

// 3-Segment Reference Nematode Genotype for Trustworthy Benchmark
export function createReferenceNematodeGenome(customPrng = new XoshiroPRNG(9999)): Genome {
  const parts: PartDef[] = [
    createPartDef('part-0', -1, 'EAST', 5, 3, 1.2, 0, 0, 1.0, 1.0),
    createPartDef('part-1', 0, 'WEST', 6, 2, 1.2, 0, 0, 0.8, 1.0),
    createPartDef('part-2', 1, 'WEST', 7, 2, 1.2, 0, Math.PI * 0.5, 0.8, 1.0),
  ];
  const eyes: SensoryEye[] = [
    {id: 'eye-0', partIndex: 0, direction: 'EAST', fov: 2.0, range: 500},
  ];
  const mouths: SensoryMouth[] = [
    {id: 'mouth-0', partIndex: 0, direction: 'EAST', intakeWidth: 3 * UNIT_SIZE * 0.9, mouthType: 'herbivore'},
  ];

  const bodyCost = calculateBodyCost(parts, eyes, mouths);
  const storageTraitMultiplier = 1.0;
  const maxEnergyCapacity = calculateMaxEnergyCapacity(parts, storageTraitMultiplier);
  const {weightsIH, weightsHH, biasesH, weightsHO, biasesO} = createXavierRecurrentNetwork(customPrng);

  return {
    id: 'BENCH-NEMATODE',
    name: 'Benchmark Nematode',
    archetype: 'Benchmark Nematode',
    generation: 1,
    parentIds: [],
    hue: 195,
    saturation: 90,
    lightness: 55,
    parts,
    eyes,
    mouths,
    motorFrequency: 3.0,
    motorForce: 3.0,
    weightsIH,
    weightsHH,
    biasesH,
    weightsHO,
    biasesO,
    targetClutchSize: 2,
    maturityAge: 20.0,
    incubationTime: 10.0,
    eggReserveFraction: 0.35,
    reproductionThreshold: 0.60,
    reproductionCooldown: 18.0,
    maxLifespan: 360,
    metabolicEfficiency: 1.2,
    bodyCost,
    storageTraitMultiplier,
    maxEnergyCapacity,
  };
}

// Archetype Genomes with Recurrent Weights
export function createEelFlagellateGenome(generation = 1, parentIds: string[] = [], customPrng = rng): Genome {
  const parts: PartDef[] = [];
  const eyes: SensoryEye[] = [];
  const mouths: SensoryMouth[] = [];

  parts.push(createPartDef('part-0', -1, 'EAST', 5, 3, 1.2, 0, 0, 1.0, 1.0));
  mouths.push({id: 'mouth-0', partIndex: 0, direction: 'EAST', intakeWidth: 3 * UNIT_SIZE * 0.95, mouthType: 'herbivore'});
  eyes.push({id: 'eye-0', partIndex: 0, direction: 'EAST', fov: 2.0, range: 560});

  parts.push(createPartDef('part-1', 0, 'WEST', 6, 2, 1.2, 0, 0, 0.85, 1.0));
  parts.push(createPartDef('part-2', 1, 'WEST', 7, 2, 1.2, 0, Math.PI * 0.5, 0.95, 1.0));

  const bodyCost = calculateBodyCost(parts, eyes, mouths);
  const storageTraitMultiplier = 1.0;
  const maxEnergyCapacity = calculateMaxEnergyCapacity(parts, storageTraitMultiplier);
  const {weightsIH, weightsHH, biasesH, weightsHO, biasesO} = createXavierRecurrentNetwork(customPrng);

  // Optical Green Seeking & Smooth steering bias
  weightsIH[0][1] = 0.8; // Left/Right Green
  weightsIH[0][4] = 1.2;
  weightsIH[1][10] = 1.2;
  weightsIH[1][13] = 0.8;

  // Steering offset output
  weightsHO[0][0] = -0.5;
  weightsHO[0][1] = 0.5;

  return {
    id: `EEL-${customPrng.nextUint32().toString(36).substring(0, 5).toUpperCase()}`,
    name: 'Flagellate Eel',
    archetype: 'Flagellate Eel',
    generation,
    parentIds,
    hue: 185,
    saturation: 92,
    lightness: 58,
    parts,
    eyes,
    mouths,
    motorFrequency: 3.2,
    motorForce: 3.2,
    weightsIH,
    weightsHH,
    biasesH,
    weightsHO,
    biasesO,
    targetClutchSize: 1 + Math.floor(customPrng.nextFloat() * 4),
    maturityAge: customPrng.range(15.0, 24.0),
    incubationTime: 10.0,
    eggReserveFraction: 0.35,
    reproductionThreshold: 0.60,
    reproductionCooldown: 18.0,
    maxLifespan: 340,
    metabolicEfficiency: 1.18,
    bodyCost,
    storageTraitMultiplier,
    maxEnergyCapacity,
  };
}

export function createApexPredatorGenome(generation = 1, parentIds: string[] = [], customPrng = rng): Genome {
  const parts: PartDef[] = [];
  const eyes: SensoryEye[] = [];
  const mouths: SensoryMouth[] = [];

  parts.push(createPartDef('part-0', -1, 'EAST', 5, 4, 1.2, 0, 0, 1.0, 1.0));
  mouths.push({id: 'mouth-0', partIndex: 0, direction: 'EAST', intakeWidth: 4.2 * UNIT_SIZE, mouthType: 'carnivore'});
  mouths.push({id: 'mouth-1', partIndex: 0, direction: 'NORTH', intakeWidth: 3.0 * UNIT_SIZE, mouthType: 'carnivore'});

  eyes.push({id: 'eye-0', partIndex: 0, direction: 'EAST', fov: 2.3, range: 650});
  eyes.push({id: 'eye-1', partIndex: 0, direction: 'NORTH', fov: 1.6, range: 500});
  eyes.push({id: 'eye-2', partIndex: 0, direction: 'SOUTH', fov: 1.6, range: 500});

  parts.push(createPartDef('part-1', 0, 'WEST', 6, 2, 1.2, 0, 0, 0.85, 1.0));
  parts.push(createPartDef('part-2', 1, 'WEST', 7, 2, 1.2, 0, Math.PI * 0.5, 1.0, 1.05));

  const bodyCost = calculateBodyCost(parts, eyes, mouths);
  const storageTraitMultiplier = 1.05;
  const maxEnergyCapacity = calculateMaxEnergyCapacity(parts, storageTraitMultiplier);
  const {weightsIH, weightsHH, biasesH, weightsHO, biasesO} = createXavierRecurrentNetwork(customPrng);

  // Prey pursuit steering
  weightsIH[0][2] = 1.2;
  weightsIH[0][0] = 0.9;
  weightsIH[1][14] = 1.2;
  weightsIH[1][12] = 0.9;

  weightsHO[0][0] = -0.6;
  weightsHO[0][1] = 0.6;

  return {
    id: `PRED-${customPrng.nextUint32().toString(36).substring(0, 5).toUpperCase()}`,
    name: 'Apex Hunter',
    archetype: 'Apex Hunter',
    generation,
    parentIds,
    hue: 355,
    saturation: 96,
    lightness: 54,
    parts,
    eyes,
    mouths,
    motorFrequency: 3.4,
    motorForce: 3.5,
    weightsIH,
    weightsHH,
    biasesH,
    weightsHO,
    biasesO,
    targetClutchSize: 1 + Math.floor(customPrng.nextFloat() * 3),
    maturityAge: customPrng.range(18.0, 26.0),
    incubationTime: 12.0,
    eggReserveFraction: 0.40,
    reproductionThreshold: 0.65,
    reproductionCooldown: 20.0,
    maxLifespan: 380,
    metabolicEfficiency: 1.25,
    bodyCost,
    storageTraitMultiplier,
    maxEnergyCapacity,
  };
}

export function createMantaFlapperGenome(generation = 1, parentIds: string[] = [], customPrng = rng): Genome {
  const parts: PartDef[] = [];
  const eyes: SensoryEye[] = [];
  const mouths: SensoryMouth[] = [];

  parts.push(createPartDef('part-0', -1, 'EAST', 5, 4, 1.2, 0, 0, 1.0, 1.0));
  mouths.push({id: 'mouth-0', partIndex: 0, direction: 'EAST', intakeWidth: 4 * UNIT_SIZE * 0.95, mouthType: 'herbivore'});
  eyes.push({id: 'eye-0', partIndex: 0, direction: 'EAST', fov: 2.0, range: 520});
  eyes.push({id: 'eye-1', partIndex: 0, direction: 'NORTH', fov: 1.5, range: 460});
  eyes.push({id: 'eye-2', partIndex: 0, direction: 'SOUTH', fov: 1.5, range: 460});

  parts.push(createPartDef('part-1', 0, 'NORTH', 6, 2, 1.2, -Math.PI / 2, 0.0, 0.85, 1.0));
  parts.push(createPartDef('part-2', 0, 'SOUTH', 6, 2, 1.2, Math.PI / 2, Math.PI, 0.85, 1.0));
  parts.push(createPartDef('part-3', 0, 'WEST', 5, 2, 1.2, 0, Math.PI * 0.5, 0.8, 1.0));

  const bodyCost = calculateBodyCost(parts, eyes, mouths);
  const storageTraitMultiplier = 1.0;
  const maxEnergyCapacity = calculateMaxEnergyCapacity(parts, storageTraitMultiplier);
  const {weightsIH, weightsHH, biasesH, weightsHO, biasesO} = createXavierRecurrentNetwork(customPrng);

  return {
    id: `MAN-${customPrng.nextUint32().toString(36).substring(0, 5).toUpperCase()}`,
    name: 'Manta Flapper',
    archetype: 'Manta Flapper',
    generation,
    parentIds,
    hue: 215,
    saturation: 90,
    lightness: 60,
    parts,
    eyes,
    mouths,
    motorFrequency: 3.0,
    motorForce: 3.0,
    weightsIH,
    weightsHH,
    biasesH,
    weightsHO,
    biasesO,
    targetClutchSize: 1 + Math.floor(customPrng.nextFloat() * 4),
    maturityAge: customPrng.range(16.0, 24.0),
    incubationTime: 11.0,
    eggReserveFraction: 0.35,
    reproductionThreshold: 0.60,
    reproductionCooldown: 18.0,
    maxLifespan: 360,
    metabolicEfficiency: 1.18,
    bodyCost,
    storageTraitMultiplier,
    maxEnergyCapacity,
  };
}

export function createTadpoleCruiserGenome(generation = 1, parentIds: string[] = [], customPrng = rng): Genome {
  const parts: PartDef[] = [];
  const eyes: SensoryEye[] = [];
  const mouths: SensoryMouth[] = [];

  parts.push(createPartDef('part-0', -1, 'EAST', 5, 4, 1.2, 0, 0, 1.0, 1.0));
  mouths.push({id: 'mouth-0', partIndex: 0, direction: 'EAST', intakeWidth: 4 * UNIT_SIZE * 0.95, mouthType: 'herbivore'});
  eyes.push({id: 'eye-0', partIndex: 0, direction: 'EAST', fov: 2.2, range: 550});

  parts.push(createPartDef('part-1', 0, 'WEST', 6, 2, 1.2, 0, 0, 0.8, 1.0));
  parts.push(createPartDef('part-2', 1, 'WEST', 7, 2, 1.2, 0, Math.PI * 0.5, 0.9, 1.0));

  const bodyCost = calculateBodyCost(parts, eyes, mouths);
  const storageTraitMultiplier = 1.0;
  const maxEnergyCapacity = calculateMaxEnergyCapacity(parts, storageTraitMultiplier);
  const {weightsIH, weightsHH, biasesH, weightsHO, biasesO} = createXavierRecurrentNetwork(customPrng);

  return {
    id: `TAD-${customPrng.nextUint32().toString(36).substring(0, 5).toUpperCase()}`,
    name: 'Paddle Tadpole',
    archetype: 'Paddle Tadpole',
    generation,
    parentIds,
    hue: 45, // Golden amber founder pigment; independent of its mouth type.
    saturation: 90,
    lightness: 54,
    parts,
    eyes,
    mouths,
    motorFrequency: 3.2,
    motorForce: 3.0,
    weightsIH,
    weightsHH,
    biasesH,
    weightsHO,
    biasesO,
    targetClutchSize: 1 + Math.floor(customPrng.nextFloat() * 4),
    maturityAge: customPrng.range(14.0, 22.0),
    incubationTime: 9.0,
    eggReserveFraction: 0.35,
    reproductionThreshold: 0.60,
    reproductionCooldown: 16.0,
    maxLifespan: 330,
    metabolicEfficiency: 1.22,
    bodyCost,
    storageTraitMultiplier,
    maxEnergyCapacity,
  };
}

export function createHydrofoilGliderGenome(generation = 1, parentIds: string[] = [], customPrng = rng): Genome {
  const parts: PartDef[] = [];
  const eyes: SensoryEye[] = [];
  const mouths: SensoryMouth[] = [];

  parts.push(createPartDef('part-0', -1, 'EAST', 5, 4, 1.2, 0, 0, 1.0, 1.0));
  mouths.push({id: 'mouth-0', partIndex: 0, direction: 'EAST', intakeWidth: 3.5 * UNIT_SIZE, mouthType: 'omnivore'});
  eyes.push({id: 'eye-0', partIndex: 0, direction: 'EAST', fov: 2.2, range: 560});
  eyes.push({id: 'eye-1', partIndex: 0, direction: 'NORTH', fov: 1.6, range: 480});
  eyes.push({id: 'eye-2', partIndex: 0, direction: 'SOUTH', fov: 1.6, range: 480});

  parts.push(createPartDef('part-1', 0, 'WEST', 6, 2, 1.2, 0, 0, 0.8, 1.0));
  parts.push(createPartDef('part-2', 0, 'NORTH', 5, 2, 1.2, -Math.PI / 2, 0.2, 0.8, 1.0));
  parts.push(createPartDef('part-3', 0, 'SOUTH', 5, 2, 1.2, Math.PI / 2, 0.2, 0.8, 1.0));

  const bodyCost = calculateBodyCost(parts, eyes, mouths);
  const storageTraitMultiplier = 1.0;
  const maxEnergyCapacity = calculateMaxEnergyCapacity(parts, storageTraitMultiplier);
  const {weightsIH, weightsHH, biasesH, weightsHO, biasesO} = createXavierRecurrentNetwork(customPrng);

  return {
    id: `GLI-${customPrng.nextUint32().toString(36).substring(0, 5).toUpperCase()}`,
    name: 'Hydrofoil Glider',
    archetype: 'Hydrofoil Glider',
    generation,
    parentIds,
    hue: 285,
    saturation: 90,
    lightness: 60,
    parts,
    eyes,
    mouths,
    motorFrequency: 3.0,
    motorForce: 3.0,
    weightsIH,
    weightsHH,
    biasesH,
    weightsHO,
    biasesO,
    targetClutchSize: 1 + Math.floor(customPrng.nextFloat() * 4),
    maturityAge: customPrng.range(16.0, 24.0),
    incubationTime: 10.5,
    eggReserveFraction: 0.38,
    reproductionThreshold: 0.60,
    reproductionCooldown: 18.0,
    maxLifespan: 350,
    metabolicEfficiency: 1.20,
    bodyCost,
    storageTraitMultiplier,
    maxEnergyCapacity,
  };
}

export function createRandomGenome(generation = 1, parentIds: string[] = [], customPrng = rng): Genome {
  const parts: PartDef[] = [];
  const eyes: SensoryEye[] = [];
  const mouths: SensoryMouth[] = [];

  const rootN = customPrng.rangeInt(4, 6);
  const rootM = customPrng.rangeInt(3, 5);
  parts.push(createPartDef('part-0', -1, 'EAST', rootN, rootM, 1.2, 0, 0, 1.0, 1.0));

  const mouthTypesList: MouthType[] = ['herbivore', 'carnivore', 'omnivore'];
  mouths.push({
    id: 'mouth-0',
    partIndex: 0,
    direction: 'EAST',
    intakeWidth: rootM * UNIT_SIZE * 0.85,
    mouthType: mouthTypesList[customPrng.rangeInt(0, 2)],
  });

  eyes.push({
    id: 'eye-0',
    partIndex: 0,
    direction: 'EAST',
    fov: customPrng.range(1.6, 2.3),
    range: customPrng.range(480, 620),
  });

  const chainLen = customPrng.rangeInt(2, 3);
  for (let c = 1; c <= chainLen; c++) {
    const parentP = parts[c - 1];
    const pDims = generateCompliantChildDimensions('WEST', parentP.dimN, parentP.dimM, customPrng);
    parts.push(
      createPartDef(
        `part-${c}`,
        c - 1,
        'WEST',
        pDims.dimN,
        pDims.dimM,
        1.2,
        0,
        (c - 1) * Math.PI * 0.5,
        0.8,
        1.0,
      ),
    );
  }

  const bodyCost = calculateBodyCost(parts, eyes, mouths);
  const storageTraitMultiplier = customPrng.range(0.85, 1.25);
  const maxEnergyCapacity = calculateMaxEnergyCapacity(parts, storageTraitMultiplier);
  const {weightsIH, weightsHH, biasesH, weightsHO, biasesO} = createXavierRecurrentNetwork(customPrng);

  const hasCarn = mouths.some((m) => m.mouthType === 'carnivore');
  const hasOmni = mouths.some((m) => m.mouthType === 'omnivore');
  const defaultHue = customPrng.range(0, 360);

  return {
    id: `GEN-${customPrng.nextUint32().toString(36).substring(0, 5).toUpperCase()}`,
    name: hasCarn ? 'Predator Morph' : hasOmni ? 'Omnivore Morph' : 'Grazer Morph',
    archetype: hasCarn ? 'Predator Morph' : hasOmni ? 'Omnivore Morph' : 'Grazer Morph',
    generation,
    parentIds,
    hue: defaultHue,
    saturation: customPrng.range(82, 98),
    lightness: customPrng.range(52, 65),
    parts,
    eyes,
    mouths,
    motorFrequency: customPrng.range(2.8, 3.4),
    motorForce: customPrng.range(2.8, 3.4),
    weightsIH,
    weightsHH,
    biasesH,
    weightsHO,
    biasesO,
    targetClutchSize: 1 + Math.floor(customPrng.nextFloat() * 4),
    maturityAge: customPrng.range(14.0, 26.0),
    incubationTime: customPrng.range(8.0, 13.0),
    eggReserveFraction: customPrng.range(0.3, 0.45),
    reproductionThreshold: customPrng.range(0.55, 0.70),
    reproductionCooldown: customPrng.range(15.0, 22.0),
    maxLifespan: customPrng.range(280, 420),
    metabolicEfficiency: customPrng.range(1.0, 1.28),
    bodyCost,
    storageTraitMultiplier,
    maxEnergyCapacity,
  };
}

/** Repair the two old fin presets when creating new bodies, never in a live imported body. */
function alignLegacyFinDimensions(parts: PartDef[]): void {
  for (const part of parts.slice(1)) if (Math.abs(Math.abs(part.baseAngleOffset) - Math.PI / 2) < 1e-7) {
    [part.dimN, part.dimM] = [part.dimM, part.dimN];
    [part.width, part.height] = [part.height, part.width]; part.baseAngleOffset = 0;
  }
}

export function createArchetypeGenome(
  archetype: ArchetypeId,
  generation = 1,
  parentIds: string[] = [],
  customPrng = rng,
): Genome {
  let genome: Genome;
  switch (archetype) {
    case 'eel': genome = createEelFlagellateGenome(generation, parentIds, customPrng); break;
    case 'flapper': genome = createMantaFlapperGenome(generation, parentIds, customPrng); break;
    case 'tadpole': genome = createTadpoleCruiserGenome(generation, parentIds, customPrng); break;
    case 'glider': genome = createHydrofoilGliderGenome(generation, parentIds, customPrng); break;
    case 'predator': genome = createApexPredatorGenome(generation, parentIds, customPrng); break;
    case 'nematode': genome = createReferenceNematodeGenome(); break;
    case 'random':
    default:
      genome = createRandomGenome(generation, parentIds, customPrng);
  }
  // Old preset fins used a quarter-turn around the wrong face anchor, interpenetrating
  // the body. Store the same long fin axis in its dimensions and keep mating faces flush.
  if (archetype === 'flapper' || archetype === 'glider') alignLegacyFinDimensions(genome.parts);
  normalizeSurfaceOrgans(genome); genome.anatomyVersion = 1;
  return genome;
}

// Explicit genetic topology operators. They affect only the supplied genome;
// organisms retain their personal memory, and offspring begin with fresh state.
export type BrainTopologyOperation =
  'add-neuron' | 'remove-neuron' | 'enable-connection' |
  'disable-connection' | 'prune-connection' | 'reconnect' | 'wire-injury-motor' |
  'wire-retinal-turn';

type BrainEdgeLocation = {kind: 'ih' | 'hh' | 'ho'; target: number; source: number; key: string; weight: number};

/** Describe a matrix slot using immutable channel and hidden-neuron IDs. */
function brainEdgeAt(g: Genome, kind: BrainEdgeLocation['kind'], target: number, source: number): BrainEdgeLocation {
  const targetId = kind === 'ho' ? g.outputKeys![target] : g.hiddenIds![target];
  const sourceId = kind === 'ih' ? g.inputKeys![source] : g.hiddenIds![source];
  const weight = kind === 'ih' ? g.weightsIH[target][source]
    : kind === 'hh' ? g.weightsHH[target][source] : g.weightsHO[target][source];
  return {kind, target, source, key: brainEdgeKey(kind, targetId, sourceId), weight};
}

function setBrainEdgeWeight(g: Genome, edge: BrainEdgeLocation, weight: number): void {
  if (edge.kind === 'ih') g.weightsIH[edge.target][edge.source] = weight;
  else if (edge.kind === 'hh') g.weightsHH[edge.target][edge.source] = weight;
  else g.weightsHO[edge.target][edge.source] = weight;
}

/** Resolve persisted disabled keys without relying on matrix positions. */
function findBrainEdge(g: Genome, key: string): BrainEdgeLocation | null {
  let parts: unknown;
  try { parts = JSON.parse(key); } catch { return null; }
  if (!Array.isArray(parts) || parts.length !== 3) return null;
  const [kind, targetId, sourceId] = parts;
  if (kind !== 'ih' && kind !== 'hh' && kind !== 'ho') return null;
  const target = (kind === 'ho' ? g.outputKeys! : g.hiddenIds!).indexOf(targetId);
  const source = (kind === 'ih' ? g.inputKeys! : g.hiddenIds!).indexOf(sourceId);
  if (target < 0 || source < 0) return null;
  return brainEdgeAt(g, kind, target, source);
}

/** Low-perturbation, deterministic inherited topology changes, independent of weight mutation.
 * Returns false if the requested operation has no legal opportunity.
 */
export function mutateBrainTopology(g: Genome, operation: BrainTopologyOperation, customPrng: XoshiroPRNG = rng): boolean {
  ensureBrainLayout(g);
  invalidateCompiledBrain(g);
  const count = g.hiddenIds!.length, inputs = g.inputKeys!.length, outputs = g.outputKeys!.length;
  const disabled = new Set(g.disabledConnections!);
  if (operation === 'add-neuron') {
    // All fresh synapses start disabled except one weak sensory input and one weak
    // motor output. This avoids a dense silent expansion and preserves old behavior.
    const freshDisabled = inputs + outputs + 2 * count - 1;
    if (count >= MAX_HIDDEN || !inputs || !outputs
      || enabledBrainEdgeCount(g) + 2 > MAX_ENABLED_BRAIN_EDGES
      || g.disabledConnections!.length + freshDisabled > MAX_ENABLED_BRAIN_EDGES) return false;
    const previous = structuredClone(g);
    let newId: string;
    do { newId = `hidden:mut-${customPrng.nextUint32().toString(36)}`; }
    while (g.hiddenIds!.includes(newId));
    g.hiddenIds = [...g.hiddenIds!, newId];
    for (const input of g.inputKeys!) disabled.add(brainEdgeKey('ih', newId, input));
    for (const hidden of g.hiddenIds) {
      disabled.add(brainEdgeKey('hh', newId, hidden));
      disabled.add(brainEdgeKey('hh', hidden, newId));
    }
    for (const output of g.outputKeys!) disabled.add(brainEdgeKey('ho', output, newId));
    g.disabledConnections = [...disabled];
    remapBrain(g, previous);
    const inIndex = customPrng.rangeInt(0, inputs - 1), outIndex = customPrng.rangeInt(0, outputs - 1);
    g.disabledConnections = g.disabledConnections!.filter(key =>
      key !== brainEdgeKey('ih', newId, g.inputKeys![inIndex])
      && key !== brainEdgeKey('ho', g.outputKeys![outIndex], newId));
    g.weightsIH[count][inIndex] = customPrng.range(-0.04, 0.04);
    g.weightsHO[outIndex][count] = customPrng.range(-0.04, 0.04);
    return true;
  }
  if (operation === 'wire-injury-motor') {
    // A single inherited innovation may link *experienced* physical injury
    // to a motor strategy. It is NOT an automatic escape reflex: channel,
    // direction and gain are stochastic, including detrimental responses.
    // Start with a new isolated neuron so the genotype's existing behavior
    // remains identical before its first real bite. Extra brain upkeep is
    // paid by the ordinary neuron/edge maintenance model.
    const injury = g.inputKeys!.indexOf('body:injury');
    if (injury < 0 || g.parts.length < 2 ||
      count >= MAX_HIDDEN || enabledBrainEdgeCount(g) + g.parts.length > MAX_ENABLED_BRAIN_EDGES) return false;
    if (!mutateBrainTopology(g, 'add-neuron', customPrng)) return false;
    const h = g.hiddenIds!.length - 1, nodeId = g.hiddenIds![h];
    const channels = ['Angle', 'Drive', 'Torque', 'Stiff', 'Amp', 'Engage'];
    const selected = channels[customPrng.rangeInt(0, channels.length - 1)];
    const selectedOutputs = g.outputKeys!.map((key, i) => key.endsWith(':' + selected) ? i : -1).filter(i => i >= 0);
    const enabled = new Set(g.disabledConnections!);
    const sensoryGain = (customPrng.nextFloat() < 0.5 ? -1 : 1) * customPrng.range(.4, 3);
    const motorGain = (customPrng.nextFloat() < 0.5 ? -1 : 1) * customPrng.range(.4, 3);
    for (let i = 0; i < g.inputKeys!.length; i++) {
      const key = brainEdgeKey('ih', nodeId, g.inputKeys![i]);
      g.weightsIH[h][i] = i === injury ? sensoryGain : 0;
      if (i === injury) enabled.delete(key); else enabled.add(key);
    }
    for (let o = 0; o < g.outputKeys!.length; o++) {
      const key = brainEdgeKey('ho', g.outputKeys![o], nodeId);
      const use = selectedOutputs.includes(o);
      g.weightsHO[o][h] = use ? motorGain : 0;
      if (use) enabled.delete(key); else enabled.add(key);
    }
    // New hidden recurrent edges remain disabled from add-neuron.
    g.disabledConnections = [...enabled];
    checkBrainBudget(g);
    return true;
  }
  if (operation === 'wire-retinal-turn') {
    // Inherited lateral color-contrast receptive field: a randomly selected
    // eye and wavelength project left-versus-right retinal ray activity to
    // an isolated neuron and the existing joint Angle muscles. Direction,
    // gain and color are stochastic, so even valid innovations may be
    // maladaptive. There is NO object-type, location or danger input and NO
    // runtime steering force. Every new connection pays ordinary brain upkeep.
    if (!g.eyes.length || g.parts.length < 2 || count >= MAX_HIDDEN ||
      enabledBrainEdgeCount(g) + RAYS_PER_EYE + g.parts.length > MAX_ENABLED_BRAIN_EDGES) return false;
    if (!mutateBrainTopology(g, 'add-neuron', customPrng)) return false;
    const h = g.hiddenIds!.length - 1, nodeId = g.hiddenIds![h];
    const eye = g.eyes[customPrng.rangeInt(0, g.eyes.length - 1)];
    const color = (['red', 'green', 'blue'] as const)[customPrng.rangeInt(0, 2)];
    const sensoryGain = customPrng.range(1, 4) * (customPrng.nextFloat() < .5 ? -1 : 1);
    const motorGain = customPrng.range(1, 4) * (customPrng.nextFloat() < .5 ? -1 : 1);
    const enabled = new Set(g.disabledConnections!);
    for (let i = 0; i < g.inputKeys!.length; i++) {
      const key = g.inputKeys![i];
      const sensoryKey = brainEdgeKey('ih', nodeId, key);
      let gain = 0;
      for (let ray = 0; ray < RAYS_PER_EYE; ray++) {
        if (key === `eye:${eye.id}:ray:${ray}:${color}`) {
          const offset = (ray / (RAYS_PER_EYE - 1) - .5) * eye.fov;
          gain = Math.sin(offset) * sensoryGain;
          break;
        }
      }
      g.weightsIH[h][i] = gain;
      if (Math.abs(gain) > 1e-12) enabled.delete(sensoryKey);
      else enabled.add(sensoryKey);
    }
    for (let o = 0; o < g.outputKeys!.length; o++) {
      const outputKey = g.outputKeys![o];
      const edge = brainEdgeKey('ho', outputKey, nodeId);
      const turnJoint = outputKey.endsWith(':Angle');
      g.weightsHO[o][h] = turnJoint ? motorGain : 0;
      if (turnJoint) enabled.delete(edge); else enabled.add(edge);
    }
    // add-neuron already isolates all recurrent connections, including self.
    g.disabledConnections = [...enabled];
    checkBrainBudget(g);
    return true;
  }
  if (operation === 'remove-neuron') {
    if (count <= 1) return false;
    // Prefer the least influential hidden node; no automatic protection or
    // guaranteed fitness criterion. This is a local connection-magnitude proxy.
    let weakest = 0, weakestScore = Infinity;
    for (let h = 0; h < count; h++) {
      let score = 0;
      for (let o = 0; o < outputs; o++) {
        const edge = brainEdgeAt(g, 'ho', o, h);
        if (!disabled.has(edge.key)) score += Math.abs(edge.weight);
      }
      for (let target = 0; target < count; target++) {
        const edge = brainEdgeAt(g, 'hh', target, h);
        if (!disabled.has(edge.key)) score += Math.abs(edge.weight);
      }
      if (score < weakestScore) { weakest = h; weakestScore = score; }
    }
    const previous = structuredClone(g);
    g.hiddenIds = g.hiddenIds!.filter((_, h) => h !== weakest);
    remapBrain(g, previous);
    return true;
  }

  // Pick from the existing disabled set; large networks are never enumerated.
  const chooseDisabled = (): BrainEdgeLocation | null => {
    const keys = g.disabledConnections!;
    if (!keys.length) return null;
    for (let attempt = 0; attempt < 48; attempt++) {
      const edge = findBrainEdge(g, keys[customPrng.rangeInt(0, keys.length - 1)]);
      if (edge && Math.abs(edge.weight) <= 0.12) return edge;
    }
    return null;
  };
  // Draw from bounded matrix samples. Avoid immediately cutting large-magnitude
  // paths, although this does not guarantee functional preservation.
  const chooseEnabled = (): BrainEdgeLocation | null => {
    for (let attempt = 0; attempt < 96; attempt++) {
      const kind = (['ih', 'hh', 'ho'] as const)[customPrng.rangeInt(0, 2)];
      const rows = kind === 'ho' ? outputs : count;
      const cols = kind === 'ih' ? inputs : count;
      if (!rows || !cols) continue;
      const edge = brainEdgeAt(g, kind, customPrng.rangeInt(0, rows - 1), customPrng.rangeInt(0, cols - 1));
      if (!disabled.has(edge.key) && Math.abs(edge.weight) <= 0.12) return edge;
    }
    return null;
  };

  if (operation === 'enable-connection' || operation === 'reconnect') {
    const destination = chooseDisabled();
    if (!destination) return false;
    const origin = operation === 'reconnect' ? chooseEnabled() : null;
    if (operation === 'reconnect' && !origin) return false;
    if (!origin && enabledBrainEdgeCount(g) >= MAX_ENABLED_BRAIN_EDGES) return false;
    disabled.delete(destination.key);
    if (origin) disabled.add(origin.key);
    // A truly new connection gets a gentle nonzero seed. Disabling does not
    // erase weights, and a subsequently re-enabled nonzero weight is preserved.
    if (Math.abs(destination.weight) < 1e-12) setBrainEdgeWeight(g, destination, customPrng.range(-0.04, 0.04));
    g.disabledConnections = [...disabled];
    return true;
  }
  if (operation === 'disable-connection' || operation === 'prune-connection') {
    const edge = chooseEnabled();
    if (!edge) return false;
    disabled.add(edge.key);
    if (operation === 'prune-connection') setBrainEdgeWeight(g, edge, 0);
    g.disabledConnections = [...disabled];
    return true;
  }
  return false;
}

// Structural Topology Mutation with Strict No-Wide-to-Wide Validation
export function mutateGenome(parent: Genome, severity = 0.25, customPrng: XoshiroPRNG = rng, physicsRegime?: PhysicsRegime): Genome {
  const mutChance = clampVal(severity, 0, 1);
  const mutScale = mutChance * 1.2;
  if (mutChance === 0) {
    return {...structuredClone(parent),
      id: `GEN-${customPrng.nextUint32().toString(36).toUpperCase()}`,
      generation: parent.generation + 1, parentIds: [parent.id]};
  }
  // Never migrate a parent's neural layout or anatomy in place.
  parent = structuredClone(parent);
  if (parent.anatomyVersion === undefined && morphologyProblems(parent.parts).length > 0) {
    const parts = parent.parts.map(p => ({...p}));
    alignLegacyFinDimensions(parts);
    if (morphologyProblems(parts).length === 0) parent = {...parent, parts};
  }
  ensureBrainLayout(parent);
  const mutate = (value: number, delta: number, min: number, max: number) =>
    customPrng.nextFloat() < mutChance
      ? clampVal(value + customPrng.range(-delta, delta) * mutScale, min, max)
      : value;

  let parts: PartDef[] = parent.parts.map((p) => ({...p}));

  // Structural Topology Mutations: Appendage addition / pruning
  if (customPrng.nextFloat() < mutChance * 0.25 && parts.length < MAX_PARTS) {
    const attachIdx = customPrng.rangeInt(0, parts.length - 1);
    const parentP = parts[attachIdx];
    const candidateDirs: CardinalDir[] = ['WEST', 'NORTH', 'SOUTH', 'EAST'];
    const chosenDir = candidateDirs[customPrng.rangeInt(0, candidateDirs.length - 1)];
    const dims = generateCompliantChildDimensions(chosenDir, parentP.dimN, parentP.dimM, customPrng);
    if (isValidAttachment(chosenDir, parentP.dimN, parentP.dimM, dims.dimN, dims.dimM)) {
      parts.push(createPartDef(`part-${customPrng.nextUint32().toString(36)}`, attachIdx, chosenDir, dims.dimN, dims.dimM, 2.0, 0, customPrng.range(0, Math.PI * 2), 1.2, 1.0));
    }
  } else if (customPrng.nextFloat() < mutChance * 0.15 && parts.length > 2) {
    // Prune leaf part safely
    const isLeaf = (idx: number) => !parts.some((p) => p.parentIndex === idx);
    const leafIndices = parts.map((_, i) => i).filter((i) => i > 0 && isLeaf(i));
    if (leafIndices.length > 0) {
      const pruneIdx = leafIndices[leafIndices.length - 1];
      parts.splice(pruneIdx, 1);
      // Remap parent indices
      parts = parts.map((p) => ({
        ...p,
        parentIndex: p.parentIndex >= pruneIdx ? Math.max(0, p.parentIndex - 1) : p.parentIndex,
      }));
    }
  }

  // Relocate a branch only to an earlier parent; reject occupied/overlapping poses.
  if (parts.length > 1 && customPrng.nextFloat() < mutChance * .15) {
    const i = customPrng.rangeInt(1, parts.length - 1);
    const candidate = parts.map(p => ({...p}));
    candidate[i].parentIndex = customPrng.rangeInt(0, i - 1);
    candidate[i].attachmentPoint = (['NORTH', 'SOUTH', 'EAST', 'WEST'] as CardinalDir[])[customPrng.rangeInt(0, 3)];
    candidate[i].baseAngleOffset = 0;
    if (morphologyProblems(candidate).length === 0) parts = candidate;
  }
  if (morphologyProblems(parts).length) parts = parent.parts.map(p => ({...p}));

  // Segment dimension & CPG mutations
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    let newN = p.dimN;
    let newM = p.dimM;
    let dimChanged = false;

    if (customPrng.nextFloat() < mutChance) {
      newN = clampVal(newN + (customPrng.nextFloat() < 0.5 ? -1 : 1), 1, 10);
      dimChanged = true;
    }
    if (customPrng.nextFloat() < mutChance) {
      newM = clampVal(newM + (customPrng.nextFloat() < 0.5 ? -1 : 1), 1, 10);
      dimChanged = true;
    }

    if (dimChanged) {
      let valid = true;
      if (i > 0) {
        const parentIdx = Math.max(0, Math.min(i - 1, p.parentIndex));
        const parentP = parts[parentIdx];
        if (!isValidAttachment(p.attachmentPoint, parentP.dimN, parentP.dimM, newN, newM)) {
          valid = false;
        }
      }
      if (valid) {
        const candidate = parts.map((part, index) => index === i ? {...part, dimN: newN, dimM: newM, width: newN * UNIT_SIZE, height: newM * UNIT_SIZE} : part);
        valid = morphologyProblems(candidate).length === 0;
      }
      if (valid) {
        p.dimN = newN;
        p.dimM = newM;
        p.width = newN * UNIT_SIZE;
        p.height = newM * UNIT_SIZE;
      }
    }

    p.maxAngle = mutate(p.maxAngle, .2, .6, 2.35);
    if (customPrng.nextFloat() < mutChance) p.cpgPhaseOffset = (p.cpgPhaseOffset + customPrng.range(-.4, .4) * mutScale + Math.PI * 2) % (Math.PI * 2);
    p.cpgAmp = mutate(p.cpgAmp, .2, .1, 2.6);
    p.cpgFreqMult = mutate(p.cpgFreqMult, .2, .5, 2.5);
  }

  // Reject a prune that cannot carry all surviving organs; never silently erase a sensor.
  const capacity = (4 * parts.length - 2 * (parts.length - 1)) * ORGAN_SLOTS_PER_FACE;
  if (parent.eyes.length + parent.mouths.length > capacity) parts = parent.parts.map(p => ({...p}));
  const remapHost = (oldIndex: number) => {
    let index = oldIndex;
    while (index >= 0) {
      const mapped = parts.findIndex(p => p.id === parent.parts[index]?.id);
      if (mapped >= 0) return mapped;
      index = parent.parts[index]?.parentIndex ?? -1;
    }
    return 0;
  };
  // Sensory Eyes mutations
  let eyes: SensoryEye[] = parent.eyes.map((eye) => ({
    ...eye,
    partIndex: remapHost(eye.partIndex),
    fov: mutate(eye.fov, .2, .8, 2.4),
    range: mutate(eye.range, 30, 280, 680),
  }));

  const inheritedMouths = parent.mouths.map(m => ({...m, partIndex: remapHost(m.partIndex)}));
  normalizeSurfaceOrgans({parts, eyes, mouths: inheritedMouths});
  if (customPrng.nextFloat() < mutChance * 0.25 && eyes.length + parent.mouths.length < MAX_SURFACE_ORGANS) {
    const free = availableOrganSlots({parts, eyes, mouths: inheritedMouths});
    const placement = free.length ? free[customPrng.rangeInt(0, free.length - 1)] : null;
    if (placement) eyes.push({
      id: `eye-${customPrng.nextUint32().toString(36)}`,
      ...placement,
      fov: customPrng.range(1.5, 2.3),
      range: customPrng.range(450, 620),
    });
  } else if (customPrng.nextFloat() < mutChance * 0.15 && eyes.length > 1) {
    eyes.pop();
  }

  // Sensory Mouths mutations
  const mouthTypesList: MouthType[] = ['herbivore', 'carnivore', 'omnivore'];
  let mouths: SensoryMouth[] = inheritedMouths.map((m) => {
    let mutatedType: MouthType = m.mouthType || 'herbivore';
    if (customPrng.nextFloat() < mutChance * 0.18) {
      const candidates = mouthTypesList.filter((t) => t !== mutatedType);
      mutatedType = candidates[customPrng.rangeInt(0, candidates.length - 1)];
    }
    return {
      ...m,
      mouthType: mutatedType,
      intakeWidth: mutate(m.intakeWidth, 2, 3, 38),
    };
  });

  if (customPrng.nextFloat() < mutChance * 0.20 && eyes.length + mouths.length < MAX_SURFACE_ORGANS) {
    const free = availableOrganSlots({parts, eyes, mouths});
    const placement = free.length ? free[customPrng.rangeInt(0, free.length - 1)] : null;
    const chosenType = mouthTypesList[customPrng.rangeInt(0, mouthTypesList.length - 1)];
    if (placement) mouths.push({
      id: `mouth-${customPrng.nextUint32().toString(36)}`,
      ...placement,
      intakeWidth: customPrng.range(14, 28),
      mouthType: chosenType,
    });
  } else if (customPrng.nextFloat() < mutChance * 0.12 && mouths.length > 1) {
    mouths.pop();
  }

  normalizeSurfaceOrgans({parts, eyes, mouths});

  // Existing enabled weights and dormant disabled weights are distinct.
  // Mutate only enabled edges; disabling one never silently rewrites it.
  const inactive = new Set(parent.disabledConnections);
  const weightsIH = parent.weightsIH.map((row, h) =>
    row.map((w, i) =>
      inactive.has(brainEdgeKey('ih', parent.hiddenIds![h], parent.inputKeys![i])) ? w
        : customPrng.nextFloat() < mutChance ? clampVal(w + customPrng.range(-0.3, 0.3) * mutScale, -3.5, 3.5) : w,
    ),
  );
  const weightsHH = parent.weightsHH.map((row, h) =>
    row.map((w, rh) =>
      inactive.has(brainEdgeKey('hh', parent.hiddenIds![h], parent.hiddenIds![rh])) ? w
        : customPrng.nextFloat() < mutChance ? clampVal(w + customPrng.range(-0.25, 0.25) * mutScale, -3.0, 3.0) : w,
    ),
  );
  const biasesH = parent.biasesH.map((b) =>
    customPrng.nextFloat() < mutChance ? clampVal(b + customPrng.range(-0.15, 0.15) * mutScale, -1.5, 1.5) : b,
  );
  const weightsHO = parent.weightsHO.map((row, o) =>
    row.map((w, h) =>
      inactive.has(brainEdgeKey('ho', parent.outputKeys![o], parent.hiddenIds![h])) ? w
        : customPrng.nextFloat() < mutChance ? clampVal(w + customPrng.range(-0.3, 0.3) * mutScale, -3.5, 3.5) : w,
    ),
  );
  const biasesO = parent.biasesO.map((b) =>
    customPrng.nextFloat() < mutChance ? clampVal(b + customPrng.range(-0.15, 0.15) * mutScale, -1.5, 1.5) : b,
  );

  // Storage trait multiplier mutation
  const storageTraitMultiplier = clampVal(
    (parent.storageTraitMultiplier || 1.0) + (customPrng.nextFloat() < mutChance ? customPrng.range(-0.1, 0.1) * mutScale : 0),
    0.8,
    2.0,
  );
  const bodyCost = calculateBodyCost(parts, eyes, mouths);
  const maxEnergyCapacity = calculateMaxEnergyCapacity(parts, storageTraitMultiplier);

  const pigmentChance = mutChance * (parent.colorMutationRate ?? 1);
  const mutatePigment = (value: number) => customPrng.nextFloat() < pigmentChance
    ? clampVal(value + customPrng.range(-4, 4) * mutScale, 0, 100) : value;
  const newHue = customPrng.nextFloat() < pigmentChance
    ? sanitizeCreatureHue(parent.hue + customPrng.range(-20, 20) * mutScale) : parent.hue;
  const saturation = mutatePigment(parent.saturation);
  const lightness = mutatePigment(parent.lightness);
  // Variability itself can evolve. A newly changed value affects subsequent offspring.
  const colorMutationRate = mutate(parent.colorMutationRate ?? 1, .1, 0, 1);

  // Heritable Target Clutch Size (mutates ±1, range 1..6)
  let mutatedTargetClutchSize = parent.targetClutchSize || 2;
  if (customPrng.nextFloat() < mutChance) {
    const clutchDelta = customPrng.nextFloat() < 0.5 ? -1 : 1;
    mutatedTargetClutchSize = clampVal(mutatedTargetClutchSize + clutchDelta, 1, 6);
  }

  // Heritable Maturity Age (mutates ±1.0..3.0s, range 10.0..45.0s)
  let mutatedMaturityAge = parent.maturityAge || 20.0;
  if (customPrng.nextFloat() < mutChance) {
    const ageDelta = customPrng.range(-3.0, 3.0) * mutScale;
    mutatedMaturityAge = clampVal(mutatedMaturityAge + ageDelta, 10.0, 45.0);
  }

  const child: Genome = {
    anatomyVersion: 1,
    id: `GEN-${customPrng.nextUint32().toString(36).substring(0, 5).toUpperCase()}`,
    name: parent.name,
    archetype: parent.archetype,
    generation: parent.generation + 1,
    parentIds: [parent.id],
    hue: newHue,
    saturation, lightness, colorMutationRate,
    parts,
    eyes,
    mouths,
    motorFrequency: mutate(parent.motorFrequency, .3, .1, 5.2),
    motorForce: mutate(parent.motorForce, .5, 0, 19.5),
    weightsIH,
    weightsHH,
    biasesH,
    weightsHO,
    biasesO,
    hiddenIds: [...parent.hiddenIds!],
    plasticityRate: parent.plasticityRate,
    forgettingRate: parent.forgettingRate,
    plasticMotorScope: parent.plasticMotorScope,
    injuryAversionRate: parent.injuryAversionRate,
    sensoryPlasticityRate: parent.sensoryPlasticityRate,
    memoryConsolidationRate: parent.memoryConsolidationRate,
    disabledConnections: [...(parent.disabledConnections ?? [])],
    targetClutchSize: mutatedTargetClutchSize,
    maturityAge: mutatedMaturityAge,
    incubationTime: mutate(parent.incubationTime, 1, 5.0, 20.0),
    eggReserveFraction: mutate(parent.eggReserveFraction, 0.05, 0.2, 0.55),
    reproductionThreshold: (() => {
      const historical = mutate(parent.reproductionThreshold, 0.04, 0.50, 0.80);
      return usesPaidActuation(physicsRegime) ? parent.reproductionThreshold : historical;
    })(),
    reproductionCooldown: mutate(parent.reproductionCooldown, 1, 12.0, 25.0),
    maxLifespan: mutate(parent.maxLifespan, 20, 220, 550),
    metabolicEfficiency: mutate(parent.metabolicEfficiency, 0.05, 0.85, 1.35),
    bodyCost,
    storageTraitMultiplier,
    maxEnergyCapacity,
  };
  const parentWithMutatedWeights = {...parent, weightsIH, weightsHH, biasesH, weightsHO, biasesO};
  try {
    remapBrain(child, parentWithMutatedWeights);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('edge budget')) throw error;
    // Extra sensory organs can push a large valid inherited brain past the edge
    // budget. Reject only that child's anatomy expansion, not the parent,
    // neural inheritance, or the entire reproduction event.
    child.parts = structuredClone(parent.parts);
    child.eyes = structuredClone(parent.eyes);
    child.mouths = structuredClone(parent.mouths);
    child.bodyCost = calculateBodyCost(child.parts, child.eyes, child.mouths);
    child.maxEnergyCapacity = calculateMaxEnergyCapacity(child.parts, child.storageTraitMultiplier);
    remapBrain(child, parentWithMutatedWeights);
  }
  // Rare topology event, independent of regular weight/anatomy changes. The
  // same PRNG controls both event choice and its internal deterministic details.
  if (customPrng.nextFloat() < mutChance * 0.16) {
    const operations: BrainTopologyOperation[] = [
      'add-neuron', 'remove-neuron', 'enable-connection',
      'disable-connection', 'prune-connection', 'reconnect', 'wire-injury-motor', 'wire-retinal-turn',
    ];
    mutateBrainTopology(child, operations[customPrng.rangeInt(0, operations.length - 1)], customPrng);
  }
  // An inherited, independently mutable low-pass timescale for each neuron.
  // Ordinary founder/controller math is untouched until one of these rare
  // events occurs in an offspring. No lifetime weight learning is introduced.
  if (customPrng.nextFloat() < mutChance * 0.22) {
    const index = customPrng.rangeInt(0, child.hiddenTimeConstants!.length - 1);
    const previousTau = child.hiddenTimeConstants![index];
    const change = customPrng.range(-0.30, 0.45) * mutScale;
    child.hiddenTimeConstants![index] = clampVal(
      previousTau === 0 ? Math.max(0, change) : previousTau + change,
      0, MAX_BRAIN_MEMORY_SECONDS,
    );
  }
  // Independent heritable motor-policy changes. New alleles affect only
  // offspring; historical founders and imported genomes use exact old math.
  // Each physical joint can explore a freely blended rhythmic/direct regime
  // or evolve a smooth waveform by modifying one Fourier coefficient.
  for (const part of child.parts.slice(1)) {
    if (customPrng.nextFloat() < mutChance * 0.32) {
      const oldMix = part.oscillatorMix ?? 1;
      part.oscillatorMix = clampVal(oldMix + customPrng.range(-0.70, 0.35) * mutScale, 0, 1);
    }
    if (customPrng.nextFloat() < mutChance * 0.24) {
      const harmonics = [...(part.waveHarmonics ?? [0, 0, 0, 0])];
      const index = customPrng.rangeInt(0, 3);
      harmonics[index] = clampVal(harmonics[index] + customPrng.range(-0.6, 0.6) * mutScale, -1, 1);
      part.waveHarmonics = harmonics;
    }
  }
  // Independently inherited spectral gains arise in offspring without adding
  // neural channels or changing existing founder/save genotypes. A receptor can
  // disappear exactly (0), reappear, or change continuously; no diet oracle.
  for (const eye of child.eyes) {
    if (customPrng.nextFloat() < mutChance * 0.55) {
      const gains = [...(eye.spectralSensitivity ?? [1, 1, 1])] as [number, number, number];
      const channel = customPrng.rangeInt(0, 2);
      if (customPrng.nextFloat() < 0.15) {
        gains[channel] = gains[channel] === 0 ? customPrng.range(0.1, 0.5) : 0;
      } else {
        gains[channel] = clampVal(gains[channel] + customPrng.range(-0.85, 0.35) * mutScale, 0, 1);
      }
      eye.spectralSensitivity = gains;
    }
  }
  // Rare inherited capacity for somatic learning. Appended to all old
  // mutation draws to avoid perturbing established founder/offspring streams.
  // The acquired motor offsets themselves exist only on living organisms.
  if (customPrng.nextFloat() < mutChance * 0.12) {
    const base = child.plasticityRate ?? 0;
    child.plasticityRate = clampVal(base + customPrng.range(-0.15, 0.25) * mutScale,
      0, 0.8);
    if (child.plasticityRate > 0 && child.forgettingRate === undefined) child.forgettingRate = 0.1;
  }
  if ((child.plasticityRate ?? 0) > 0 && customPrng.nextFloat() < mutChance * 0.1) {
    child.forgettingRate = clampVal((child.forgettingRate ?? 0.1)
      + customPrng.range(-0.05, 0.05) * mutScale, 0, 1);
  }
  // Further heritable *capabilities*: joint-wide learning and learned
  // aversion. These draws occur after all preexisting mutation choices
  // and never alter founders or live genomes through a runtime shortcut.
  if ((child.plasticityRate ?? 0) > 0) {
    if (customPrng.nextFloat() < mutChance * 0.10)
      child.plasticMotorScope = (child.plasticMotorScope ?? 'angle') === 'all' ? 'angle' : 'all';
    if (customPrng.nextFloat() < mutChance * 0.12) {
      child.injuryAversionRate = clampVal((child.injuryAversionRate ?? 0)
        + customPrng.range(-0.15, 0.30) * mutScale, 0, 1);
    }
  }
  // Additional sensory association capacity evolves independently of
  // inherited circuit weights and of the two older motor learning genes.
  if (customPrng.nextFloat() < mutChance * 0.12) {
    child.sensoryPlasticityRate = clampVal((child.sensoryPlasticityRate ?? 0)
      + customPrng.range(-0.15, 0.25) * mutScale, 0, .8);
  }
  // Only learning-capable descendants can evolve slower long-term
  // retention. No founder/save acquires this trait retroactively.
  if (((child.plasticityRate ?? 0) > 0 || (child.sensoryPlasticityRate ?? 0) > 0)
    && customPrng.nextFloat() < mutChance * .12) {
    child.memoryConsolidationRate = clampVal((child.memoryConsolidationRate ?? 0)
      + customPrng.range(-.3, .65) * mutScale, 0, 2);
  }
  return child;
}

export function spawnOrganism(
  genome: Genome,
  x: number,
  y: number,
  heading = 0,
  clutchId?: string,
  startingReserve?: number,
  customPrng: XoshiroPRNG = rng,
): Organism {
  ensureBrainLayout(genome);
  const segments: PartPhys[] = [];
  const joints: JointState[] = [];
  const partCount = genome.parts.length;

  segments.push({
    x,
    y,
    vx: 0,
    vy: 0,
    angle: isNaN(heading) ? 0 : heading,
    angVel: 0,
  });

  for (let i = 1; i < partCount; i++) {
    const pDef = genome.parts[i];
    const parentIdx = Math.max(0, Math.min(i - 1, pDef.parentIndex));
    const parentPhys = segments[parentIdx];
    const parentDef = genome.parts[parentIdx];

    const parentCos = Math.cos(parentPhys.angle);
    const parentSin = Math.sin(parentPhys.angle);
    const parentAnchorLocal = getCardinalAnchor(pDef.attachmentPoint, parentDef.width, parentDef.height);

    const anchorWorldX = parentPhys.x + parentCos * parentAnchorLocal.x - parentSin * parentAnchorLocal.y;
    const anchorWorldY = parentPhys.y + parentSin * parentAnchorLocal.x + parentCos * parentAnchorLocal.y;

    const childAngle = parentPhys.angle + (pDef.baseAngleOffset || 0);
    const childCos = Math.cos(childAngle);
    const childSin = Math.sin(childAngle);

    const childAnchorLocal = getChildAnchorForParentDir(pDef.attachmentPoint, pDef.width, pDef.height);
    const childComX = anchorWorldX - (childCos * childAnchorLocal.x - childSin * childAnchorLocal.y);
    const childComY = anchorWorldY - (childSin * childAnchorLocal.x + childCos * childAnchorLocal.y);

    segments.push({
      x: isNaN(childComX) ? x : childComX,
      y: isNaN(childComY) ? y : childComY,
      vx: 0,
      vy: 0,
      angle: isNaN(childAngle) ? 0 : childAngle,
      angVel: 0,
    });

    joints.push({
      phase: pDef.cpgPhaseOffset || 0,
      targetAngle: 0,
      currentRelAngle: 0,
      currentRelAngVel: 0,
      appliedTorque: 0,
      stiffness: 1.0, amplitude: 1, engagement: 1,
    });
  }

  // Set default starting reserve: 10,000 J for founder, or funded reserve for hatchlings
  const initialReserve = startingReserve !== undefined
    ? Math.max(0.0, startingReserve)
    : (genome.generation === 1 ? FOUNDER_DEFAULT_RESERVE : Math.max(1000.0, genome.maxEnergyCapacity * 0.15));

  return {
    id: `ORG-${customPrng.nextUint32().toString(36)}-${customPrng.nextUint32().toString(36)}`,
    clutchId,
    genome,
    segments,
    joints,
    energy: initialReserve,
    structuralBiomass: genome.bodyCost,
    basalEnergyRate: 0,
    sensoryEnergyRate: 0,
    motorEnergyRate: 0,
    totalEnergyRate: 0,
    age: 0,
    maxLifespan: genome.maxLifespan || 340,
    foodEaten: 0,
    preyEaten: 0,
    eggsPredated: 0,
    offspringCount: 0,
    clutchesLaid: 0,
    isGravid: false,
    lastReproductionAge: 0,
    lastReproductionTime: 0,
    distanceTraveled: 0,
    speed: 0,
    neuralInputs: new Array(genome.inputKeys!.length).fill(0),
    neuralHidden: new Array(genome.hiddenIds!.length).fill(0),
    neuralOutputs: new Array(genome.outputKeys!.length).fill(0),
    rayHits: [],
    glowPulse: 0,
    dissolving: false,
    dissolveAlpha: 1.0,
    isFeedingHighlight: 0,
    traceHistory: [],
    recentFeedings: [], mouthFeedback: {}, biteFeedbackJ: 0,
  };
}

export function calculateOrganismCOM(org: Organism): {x: number; y: number; totalMass: number; vxCOM: number; vyCOM: number} {
  let totalMass = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedVx = 0;
  let weightedVy = 0;

  for (let i = 0; i < org.segments.length; i++) {
    const pDef = org.genome.parts[i];
    const m = Math.max(0.35, pDef.dimN * pDef.dimM * BASE_PART_DENSITY);
    totalMass += m;
    weightedX += org.segments[i].x * m;
    weightedY += org.segments[i].y * m;
    weightedVx += org.segments[i].vx * m;
    weightedVy += org.segments[i].vy * m;
  }

  return {
    x: totalMass > 0 ? weightedX / totalMass : org.segments[0].x,
    y: totalMass > 0 ? weightedY / totalMass : org.segments[0].y,
    totalMass,
    vxCOM: totalMass > 0 ? weightedVx / totalMass : 0,
    vyCOM: totalMass > 0 ? weightedVy / totalMass : 0,
  };
}

// Geometric Intersections
export function lineIntersection(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number,
): {hit: boolean; t: number; u: number; x: number; y: number} {
  const denom = (p1x - p2x) * (p3y - p4y) - (p1y - p2y) * (p3x - p4x);
  if (Math.abs(denom) < 1e-6) return {hit: false, t: 0, u: 0, x: 0, y: 0};

  const t = ((p1x - p3x) * (p3y - p4y) - (p1y - p3y) * (p3x - p4x)) / denom;
  const u = -((p1x - p2x) * (p1y - p3y) - (p1y - p2y) * (p1x - p3x)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {hit: true, t, u, x: p1x + t * (p2x - p1x), y: p1y + t * (p2y - p1y)};
  }
  return {hit: false, t: 0, u: 0, x: 0, y: 0};
}

export function rayCircleIntersection(
  rayOriginX: number, rayOriginY: number,
  rayDirX: number, rayDirY: number, rayMaxLen: number,
  circleX: number, circleY: number, radius: number,
): {hit: boolean; dist: number; pointX: number; pointY: number} {
  const ocX = rayOriginX - circleX;
  const ocY = rayOriginY - circleY;
  const b = ocX * rayDirX + ocY * rayDirY;
  const c = ocX * ocX + ocY * ocY - radius * radius;
  const discriminant = b * b - c;

  if (discriminant < 0) return {hit: false, dist: 0, pointX: 0, pointY: 0};

  const sqrtDisc = Math.sqrt(discriminant);
  let t = -b - sqrtDisc;
  if (t < 0) t = -b + sqrtDisc;

  if (t >= 0 && t <= rayMaxLen) {
    return {
      hit: true,
      dist: t,
      pointX: rayOriginX + rayDirX * t,
      pointY: rayOriginY + rayDirY * t,
    };
  }
  return {hit: false, dist: 0, pointX: 0, pointY: 0};
}

export function getPartCornerVertices(phys: PartPhys, def: PartDef): Array<{x: number; y: number}> {
  const halfW = def.width * 0.5;
  const halfH = def.height * 0.5;
  const cosA = Math.cos(phys.angle);
  const sinA = Math.sin(phys.angle);

  return [
    {x: phys.x + cosA * halfW - sinA * halfH, y: phys.y + sinA * halfW + cosA * halfH},
    {x: phys.x - cosA * halfW - sinA * halfH, y: phys.y - sinA * halfW + cosA * halfH},
    {x: phys.x - cosA * halfW + sinA * halfH, y: phys.y - sinA * halfW - cosA * halfH},
    {x: phys.x + cosA * halfW + sinA * halfH, y: phys.y + sinA * halfW - cosA * halfH},
  ];
}

/**
 * Physical mouth aperture versus a prey body rectangle. Boundary edges alone
 * are insufficient when the entire mouth aperture is *inside* prey tissue:
 * no edge is crossed and the aperture may be farther than mouthRadius from
 * every edge. A buried mouth is genuine physical overlap, not an oracle bite.
 * The containment check uses the prey's actual rotated rectangle.
 */
export function mouthApertureContactsPart(
  cx: number, cy: number,
  x1: number, y1: number, x2: number, y2: number,
  mouthRadius: number, part: PartPhys, def: PartDef,
): boolean {
  const dx = cx - part.x, dy = cy - part.y;
  const cos = Math.cos(part.angle), sin = Math.sin(part.angle);
  const localX = cos * dx + sin * dy;
  const localY = -sin * dx + cos * dy;
  if (Math.abs(localX) <= def.width * .5 && Math.abs(localY) <= def.height * .5) return true;

  const corners = getPartCornerVertices(part, def);
  for (let edge = 0; edge < 4; edge++) {
    const a = corners[edge], b = corners[(edge + 1) % 4];
    if (lineIntersection(x1, y1, x2, y2, a.x, a.y, b.x, b.y).hit ||
        distPointToSegment(cx, cy, a.x, a.y, b.x, b.y) <= mouthRadius) return true;
  }
  return false;
}

export function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = clampVal(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

// Convert HSL to RGB (0..1)
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (h % 360) / 360;
  s = s / 100;
  l = l / 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r, g, b];
}

/** Repair contact-induced hinge error without adding velocity or motor energy. */
const scratchProjection = Array.from({length: MAX_PARTS - 1}, () => ({
  aim: 0, bim: 0, aii: 0, bii: 0, paX: 0, paY: 0, pbX: 0, pbY: 0,
}));
function projectBodyJoints(org: Organism, iterations: number): void {
  const parts = org.genome.parts;
  // Local geometry/masses stay constant while projection changes poses.
  for (let index = 1; index < parts.length; index++) {
    const def = parts[index], pd = parts[def.parentIndex], entry = scratchProjection[index - 1];
    const am = Math.max(.35, pd.dimN * pd.dimM * BASE_PART_DENSITY);
    const bm = Math.max(.35, def.dimN * def.dimM * BASE_PART_DENSITY);
    entry.aim = 1 / am; entry.bim = 1 / bm;
    entry.aii = 12 / (am * (pd.width ** 2 + pd.height ** 2));
    entry.bii = 12 / (bm * (def.width ** 2 + def.height ** 2));
    const pa = getCardinalAnchor(def.attachmentPoint, pd.width, pd.height);
    const pb = getChildAnchorForParentDir(def.attachmentPoint, def.width, def.height);
    entry.paX = pa.x; entry.paY = pa.y; entry.pbX = pb.x; entry.pbY = pb.y;
  }
  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let index = 1; index < parts.length; index++) {
      const def = parts[index], pd = parts[def.parentIndex];
      const a = org.segments[def.parentIndex], b = org.segments[index];
      const {aim, bim, aii, bii, paX, paY, pbX, pbY} = scratchProjection[index - 1];
      const ax = Math.cos(a.angle) * paX - Math.sin(a.angle) * paY;
      const ay = Math.sin(a.angle) * paX + Math.cos(a.angle) * paY;
      const bx = Math.cos(b.angle) * pbX - Math.sin(b.angle) * pbY;
      const by = Math.sin(b.angle) * pbX + Math.cos(b.angle) * pbY;
      const ex = b.x + bx - a.x - ax, ey = b.y + by - a.y - ay;
      const k11 = aim + bim + ay * ay * aii + by * by * bii;
      const k22 = aim + bim + ax * ax * aii + bx * bx * bii;
      const k12 = -ax * ay * aii - bx * by * bii;
      const det = k11 * k22 - k12 * k12;
      const ix = (-k22 * ex + k12 * ey) * .8 / det;
      const iy = (k12 * ex - k11 * ey) * .8 / det;
      b.x += ix * bim; b.y += iy * bim; b.angle += (bx * iy - by * ix) * bii;
      a.x -= ix * aim; a.y -= iy * aim; a.angle -= (ax * iy - ay * ix) * aii;
      let relative = b.angle - a.angle - def.baseAngleOffset;
      relative = Math.atan2(Math.sin(relative), Math.cos(relative));
      const excess = relative - clampVal(relative, -def.maxAngle, def.maxAngle);
      const angular = -.5 * excess / (aii + bii);
      b.angle += angular * bii; a.angle -= angular * aii;
    }
  }
}

/** Smooth, bounded genetic waveform. A sine is the neutral allele. Adding
 * harmonics gives continuous non-sinusoidal strokes without discontinuous
 * sawtooth impulses. Coefficients are bounded genetically and on import.
 */
export function evaluateMotorWave(phase: number, harmonics?: readonly number[]): number {
  if (!harmonics || harmonics.every(c => c === 0)) return Math.sin(phase);
  let value = Math.sin(phase), bound = 1;
  for (let i = 0; i < harmonics.length; i++) {
    value += harmonics[i] * Math.sin((i + 2) * phase);
    bound += Math.abs(harmonics[i]);
  }
  return value / bound;
}

/** The neural Angle channel drives deliberate posture, even when a genome
 * disables its oscillator entirely. Amp and Drive remain independently
 * controlled by each joint's brain. Absent new alleles runs the precise
 * historical six-channel motor formula for all old worlds and founders.
 */
export function calculateJointMotorTarget(def: PartDef, phase: number, amplitude: number, angleCommand: number): number {
  if (def.oscillatorMix === undefined && def.waveHarmonics === undefined) {
    const wave = Math.sin(phase) * def.cpgAmp * amplitude;
    return clampVal((wave + angleCommand * 0.45) * def.maxAngle, -def.maxAngle, def.maxAngle);
  }
  const mix = def.oscillatorMix ?? 1;
  const oscillation = evaluateMotorWave(phase, def.waveHarmonics) * def.cpgAmp * amplitude * mix;
  // As the brain turns down Amp, its direct Angle command obtains full joint
  // travel instead of merely offsetting a mandatory oscillation.
  const activeRhythm = mix * clampVal(amplitude, 0, 1);
  const directRange = 0.45 + 0.55 * (1 - activeRhythm);
  return clampVal((oscillation + angleCommand * directRange) * def.maxAngle, -def.maxAngle, def.maxAngle);
}

function advanceOrganismPhysics(org: Organism, settings: SimulationSettings, dt_sub: number, observe?: MechanicalObserver, trial?: FoundationTrial): number {
  const g = org.genome, numJoints = org.joints.length;
  const corrected = usesPaidActuation(settings.physicsRegime);
  const surfaceModel = settings.physicsRegime === 'surface-work-v1';
  const passiveSolver = settings.physicsRegime === 'passive-work-v3';
  const simultaneousPaid = settings.physicsRegime === 'paid-work-v2' || passiveSolver;
  const trialMuscles = passiveSolver && (trial === 'anatomical-muscles' || trial === 'combined');
  const trialDrag = passiveSolver && (trial === 'coherent-spin' || trial === 'combined');
  const mu = settings.waterViscosity ?? .22, gravity = settings.gravity ?? 0;
  const {worldWidth, worldHeight} = settings;
  const partCount = org.segments.length;
  for (let i = 0; i < partCount; i++) {
    const pDef = g.parts[i];
    const mass = Math.max(0.35, pDef.dimN * pDef.dimM * BASE_PART_DENSITY);
    const inertia = (1 / 12) * mass * (pDef.width * pDef.width + pDef.height * pDef.height);
    scratchMasses[i] = mass;
    scratchInvMasses[i] = 1 / mass;
    scratchInertias[i] = inertia;
    scratchInvInertias[i] = 1 / inertia;
  }

  let frameMechanicalWork = 0;
  scratchFx.fill(0);
  scratchFy.fill(0);
  scratchTorque.fill(0);

  // Motor torque computation across joints
  for (let j = 0; j < numJoints; j++) {
    const joint = org.joints[j];
    const childIdx = j + 1;
    const childDef = g.parts[childIdx];
    const parentIdx = Math.max(0, Math.min(childIdx - 1, childDef.parentIndex));

    const parentPhys = org.segments[parentIdx];
    const childPhys = org.segments[childIdx];

    const outBase = j * OUTPUTS_PER_JOINT;
    const angleCommand = org.neuralOutputs[outBase] || 0;
    const motorFreqDrive = 1.0 + (org.neuralOutputs[outBase + 1] || 0) * 0.35;
    const peakTorqueMod = clampVal(1.0 + (org.neuralOutputs[outBase + 2] || 0) * 0.4, 0.5, 1.6);
    const stiffnessDampingMod = clampVal(1.0 + (org.neuralOutputs[outBase + 3] || 0) * 0.4, 0.4, 1.8);
    joint.stiffness = stiffnessDampingMod;
    // Zero on new channels preserves the inherited gait. Negative commands can
    // reach exactly zero; positive amplitude commands permit stronger strokes.
    const amplitudeTarget = clampVal(1 + (org.neuralOutputs[outBase + 4] || 0) * 1.5, 0, 1.75);
    const engagementTarget = clampVal(1 + (org.neuralOutputs[outBase + 5] || 0) * 1.5, 0, 1);
    const response = 1 - Math.exp(-dt_sub / MOTOR_RESPONSE_SECONDS);
    joint.amplitude = (joint.amplitude ?? 1) + (amplitudeTarget - (joint.amplitude ?? 1)) * response;
    joint.engagement = (joint.engagement ?? 1) + (engagementTarget - (joint.engagement ?? 1)) * response;
    if (amplitudeTarget === 0 && joint.amplitude < .001) joint.amplitude = 0;
    if (engagementTarget === 0 && joint.engagement < .001) joint.engagement = 0;

    const jointFreq = g.motorFrequency * childDef.cpgFreqMult * motorFreqDrive;
    joint.phase = (joint.phase + 2 * Math.PI * jointFreq * dt_sub) % (2 * Math.PI);

    const targetAngle = calculateJointMotorTarget(childDef, joint.phase, joint.amplitude, angleCommand);
    joint.targetAngle = targetAngle;

    let currentRelAngle = childPhys.angle - parentPhys.angle - (childDef.baseAngleOffset || 0);
    while (currentRelAngle > Math.PI) currentRelAngle -= Math.PI * 2;
    while (currentRelAngle < -Math.PI) currentRelAngle += Math.PI * 2;
    joint.currentRelAngle = currentRelAngle;

    const relAngVel = childPhys.angVel - parentPhys.angVel;
    joint.currentRelAngVel = relAngVel;

    const avgInertia = (scratchInertias[parentIdx] + scratchInertias[childIdx]) * 0.5;
    const muscle = surfaceModel ? muscleParameters(g.parts[parentIdx], childDef,
      scratchInertias[parentIdx], scratchInertias[childIdx], g.motorForce, stiffnessDampingMod, peakTorqueMod) : null;
    const trialMuscle = trialMuscles ? anatomicalMuscleParameters(g.parts[parentIdx], childDef,
      scratchInertias[parentIdx], scratchInertias[childIdx], g.motorForce, stiffnessDampingMod, peakTorqueMod) : null;
    const kp = muscle?.kp ?? trialMuscle?.kp ?? g.motorForce * avgInertia * 480.0 * stiffnessDampingMod;
    const kd = muscle?.kd ?? trialMuscle?.kd ?? Math.sqrt(kp * avgInertia) * 1.4 * stiffnessDampingMod;

    let motorTorque = kp * (targetAngle - currentRelAngle) - kd * relAngVel;
    const maxTorque = muscle?.maxTorque ?? trialMuscle?.maxTorque ?? avgInertia * 2200.0 * peakTorqueMod;
    motorTorque = clampVal(motorTorque, -maxTorque, maxTorque) * joint.engagement;
    if (corrected && !Number.isFinite(motorTorque)) throw new Error('Non-finite muscle torque');
    if (isNaN(motorTorque)) motorTorque = 0;
    if (surfaceModel) {
      const beforeMotor = observe ? partKineticEnergy(parentPhys, g.parts[parentIdx], BASE_PART_DENSITY)
        + partKineticEnergy(childPhys, childDef, BASE_PART_DENSITY) : 0;
      const paid = paidMotorImpulse(motorTorque, dt_sub, relAngVel,
        scratchInvInertias[parentIdx] + scratchInvInertias[childIdx], org.energy);
      childPhys.angVel += paid.impulse * scratchInvInertias[childIdx];
      parentPhys.angVel -= paid.impulse * scratchInvInertias[parentIdx];
      if (observe) observe('sequential-motor', beforeMotor,
        partKineticEnergy(parentPhys, g.parts[parentIdx], BASE_PART_DENSITY)
        + partKineticEnergy(childPhys, childDef, BASE_PART_DENSITY));
      org.energy = Math.max(0, org.energy - paid.costJ);
      frameMechanicalWork += paid.costJ;
      org.motorDiagnostics!.positiveWorkJ += paid.positiveJ;
      org.motorDiagnostics!.negativeWorkJ += paid.negativeJ;
      org.motorDiagnostics!.energyLimitedImpulses += Number(paid.limited);
      joint.appliedTorque = paid.impulse / dt_sub;
    } else {
      joint.appliedTorque = motorTorque;
      const deltaTheta = Math.abs(relAngVel * dt_sub);
      const stepJointWork = Math.abs(motorTorque) * deltaTheta * FORCE_COST_MULTIPLIER;
      if (!simultaneousPaid && !isNaN(stepJointWork) && isFinite(stepJointWork)) frameMechanicalWork += stepJointWork;
      scratchTorque[childIdx] += motorTorque;
      scratchTorque[parentIdx] -= motorTorque;
    }
  }

  if (simultaneousPaid) scratchMotorTorque.set(scratchTorque);

  // Integrated Hydrodynamic Drag
  for (let i = 0; i < partCount; i++) {
    const seg = org.segments[i];
    const def = g.parts[i];
    const cosA = Math.cos(seg.angle);
    const sinA = Math.sin(seg.angle);

    const u = seg.vx * cosA + seg.vy * sinA;
    const v = -seg.vx * sinA + seg.vy * cosA;

    const resistance = surfaceModel ? surfaceResistance(def.width, def.height, mu) : null;
    const trialResistance = trialDrag ? anisotropicFaceResistance(def.width, def.height, mu) : null;
    const fLocalX = -(resistance?.x ?? trialResistance?.x ?? LONGITUDINAL_DRAG * mu * def.height) * u; // Normal forces on the end faces; legacy retains its axial calibration.
    const fLocalY = surfaceModel ? -resistance!.y * v : -(trialResistance?.y ?? 2.0 * mu * def.width) * v;  // Normal anisotropic fluid drag

    const fDragWorldX = fLocalX * cosA - fLocalY * sinA;
    const fDragWorldY = fLocalX * sinA + fLocalY * cosA;
    const fDragTorque = surfaceModel ? -resistance!.angular * seg.angVel
      : trialDrag ? -trialResistance!.angular * seg.angVel
      : -(mu * seg.angVel * (def.width * def.width * def.width + def.height * def.height * def.height)) / 6.0;

    scratchFx[i] += fDragWorldX;
    scratchFy[i] += fDragWorldY + gravity * scratchMasses[i];
    scratchTorque[i] += fDragTorque;

    const corners = getPartCornerVertices(seg, def);
    const kWallRepel = 24.0 * scratchMasses[i];
    const kWallDamping = 4.0 * scratchMasses[i];

    for (const pt of corners) {
      const rx = pt.x - seg.x;
      const ry = pt.y - seg.y;
      const vPtX = seg.vx - seg.angVel * ry;
      const vPtY = seg.vy + seg.angVel * rx;

      if (pt.x < 0) {
        const pen = -pt.x;
        const fx = pen * kWallRepel - vPtX * kWallDamping;
        scratchFx[i] += fx;
        scratchTorque[i] += rx * 0 - ry * fx;
      } else if (pt.x > worldWidth) {
        const pen = pt.x - worldWidth;
        const fx = -pen * kWallRepel - vPtX * kWallDamping;
        scratchFx[i] += fx;
        scratchTorque[i] += rx * 0 - ry * fx;
      }

      if (pt.y < 0) {
        const pen = -pt.y;
        const fy = pen * kWallRepel - vPtY * kWallDamping;
        scratchFy[i] += fy;
        scratchTorque[i] += rx * fy - ry * 0;
      } else if (pt.y > worldHeight) {
        const pen = pt.y - worldHeight;
        const fy = -pen * kWallRepel - vPtY * kWallDamping;
        scratchFy[i] += fy;
        scratchTorque[i] += rx * fy - ry * 0;
      }
    }
  }

  if (simultaneousPaid) {
    for (let j = 0; j < numJoints; j++) {
      const child = j + 1, parent = g.parts[child].parentIndex;
      scratchMotorImpulses[j] = org.joints[j].appliedTorque * dt_sub;
      scratchMotorSpeeds[j] = org.segments[child].angVel - org.segments[parent].angVel;
      scratchMotorChanges[j] = dt_sub * (scratchMotorTorque[child] * scratchInvInertias[child]
        - scratchMotorTorque[parent] * scratchInvInertias[parent]);
      scratchMotorExternalChanges[j] = dt_sub * (
        (scratchTorque[child] - scratchMotorTorque[child]) * scratchInvInertias[child]
        - (scratchTorque[parent] - scratchMotorTorque[parent]) * scratchInvInertias[parent]);
    }
    const paid = paidMotorBatch(scratchMotorImpulses, scratchMotorSpeeds,
      scratchMotorExternalChanges, scratchMotorChanges, numJoints, org.energy);
    // Preserve the proven force/integration arithmetic exactly when funded.
    if (paid.scale < 1) {
      for (let i = 0; i < partCount; i++) scratchTorque[i] += (paid.scale - 1) * scratchMotorTorque[i];
      for (let j = 0; j < numJoints; j++) {
        if (org.joints[j].appliedTorque !== 0) org.motorDiagnostics!.energyLimitedImpulses++;
        org.joints[j].appliedTorque *= paid.scale;
      }
    }
    org.energy = Math.max(0, org.energy - paid.costJ);
    frameMechanicalWork += paid.costJ;
    org.motorDiagnostics!.positiveWorkJ += paid.positiveJ;
    org.motorDiagnostics!.negativeWorkJ += paid.negativeJ;
  }

  for (let i = 0; i < partCount; i++) {
    const seg = org.segments[i];
    const beforeForces = observe ? partKineticEnergy(seg, g.parts[i], BASE_PART_DENSITY) : 0;
    seg.vx += scratchFx[i] * scratchInvMasses[i] * dt_sub;
    seg.vy += scratchFy[i] * scratchInvMasses[i] * dt_sub;
    seg.angVel += scratchTorque[i] * scratchInvInertias[i] * dt_sub;

    const beforeGuards = observe ? partKineticEnergy(seg, g.parts[i], BASE_PART_DENSITY) : 0;
    observe?.('forces-and-motors', beforeForces, beforeGuards);
    const spd = Math.hypot(seg.vx, seg.vy);
    if (corrected && (spd > 400 || Math.abs(seg.angVel) > 20)) org.motorDiagnostics!.numericalGuardEvents++;
    if (spd > 400.0) {
      seg.vx = (seg.vx / spd) * 400.0;
      seg.vy = (seg.vy / spd) * 400.0;
    }
    seg.angVel = clampVal(seg.angVel, -20.0, 20.0);
    if (observe) observe('speed-guards', beforeGuards, partKineticEnergy(seg, g.parts[i], BASE_PART_DENSITY));
  }

  // A complete joint solve is one provisional impulse batch. Preserve its
  // established response, but never let the accepted batch increase kinetic energy.
  let beforeConstraints = 0;
  if (passiveSolver) for (let i = 0; i < partCount; i++) {
    const p = org.segments[i], k = i * 3;
    scratchConstraintStart[k] = p.vx; scratchConstraintStart[k + 1] = p.vy; scratchConstraintStart[k + 2] = p.angVel;
    if (observe) beforeConstraints += partKineticEnergy(p, g.parts[i], BASE_PART_DENSITY);
  }

  // Prepare geometry once; positions/angles do not change during the velocity solve.
  for (let j = 0; j < numJoints; j++) {
    const childIdx = j + 1, childDef = g.parts[childIdx];
    const parentIdx = Math.max(0, Math.min(childIdx - 1, childDef.parentIndex));
    const parentPhys = org.segments[parentIdx], childPhys = org.segments[childIdx];
    const parentDef = g.parts[parentIdx], c = scratchConstraints[j];
    c.parentIdx = parentIdx; c.childIdx = childIdx;
    const parentAnchorLocal = getCardinalAnchor(childDef.attachmentPoint, parentDef.width, parentDef.height);
    const childAnchorLocal = getChildAnchorForParentDir(childDef.attachmentPoint, childDef.width, childDef.height);
    const cosP = Math.cos(parentPhys.angle), sinP = Math.sin(parentPhys.angle);
    const cosC = Math.cos(childPhys.angle), sinC = Math.sin(childPhys.angle);
    const rPx = c.rPx = cosP * parentAnchorLocal.x - sinP * parentAnchorLocal.y;
    const rPy = c.rPy = sinP * parentAnchorLocal.x + cosP * parentAnchorLocal.y;
    const rCx = c.rCx = cosC * childAnchorLocal.x - sinC * childAnchorLocal.y;
    const rCy = c.rCy = sinC * childAnchorLocal.x + cosC * childAnchorLocal.y;
    const anchorPx = parentPhys.x + rPx, anchorPy = parentPhys.y + rPy;
    const anchorCx = childPhys.x + rCx, anchorCy = childPhys.y + rCy;
    const posErrX = anchorCx - anchorPx, posErrY = anchorCy - anchorPy;
    const beta = 0.35;
    c.biasX = (beta / dt_sub) * posErrX; c.biasY = (beta / dt_sub) * posErrY;
    const wP = c.wP = scratchInvMasses[parentIdx], wC = c.wC = scratchInvMasses[childIdx];
    const iP = c.iP = scratchInvInertias[parentIdx], iC = c.iC = scratchInvInertias[childIdx];
    const k11 = c.k11 = wP + wC + rPy * rPy * iP + rCy * rCy * iC;
    const k22 = c.k22 = wP + wC + rPx * rPx * iP + rCx * rCx * iC;
    const k12 = c.k12 = -rPx * rPy * iP - rCx * rCy * iC;
    c.det = k11 * k22 - k12 * k12;
    let relAngle = childPhys.angle - parentPhys.angle - (childDef.baseAngleOffset || 0);
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;
    c.limited = Math.abs(relAngle) > childDef.maxAngle;
    if (c.limited) {
      const limitErr = Math.sign(relAngle) * (Math.abs(relAngle) - childDef.maxAngle);
      c.angularBias = (0.2 / dt_sub) * limitErr;
    }
  }

  let repairPose = false;
  // Historical regimes retain every original impulse and arithmetic order.
  for (let iter = 0; iter < 10; iter++) {
    for (let j = 0; j < numJoints; j++) {
      const {parentIdx, childIdx, rPx, rPy, rCx, rCy, biasX, biasY,
        wP, wC, iP, iC, k11, k22, k12, det, limited, angularBias} = scratchConstraints[j];
      const parentPhys = org.segments[parentIdx], childPhys = org.segments[childIdx];
      const vAnchorPx = parentPhys.vx - parentPhys.angVel * rPy;
      const vAnchorPy = parentPhys.vy + parentPhys.angVel * rPx;
      const vAnchorCx = childPhys.vx - childPhys.angVel * rCy;
      const vAnchorCy = childPhys.vy + childPhys.angVel * rCx;
      const vRelX = vAnchorCx - vAnchorPx, vRelY = vAnchorCy - vAnchorPy;
      const pairEnergy = observe && !passiveSolver ? () => partKineticEnergy(parentPhys, g.parts[parentIdx], BASE_PART_DENSITY)
        + partKineticEnergy(childPhys, g.parts[childIdx], BASE_PART_DENSITY) : undefined;
      if (det > 1e-7) {
        const beforeAnchor = pairEnergy?.() ?? 0;
        const rhsX = -(vRelX + biasX), rhsY = -(vRelY + biasY);
        const impulseX = (k22 * rhsX - k12 * rhsY) / det;
        const impulseY = (-k12 * rhsX + k11 * rhsY) / det;
        childPhys.vx += impulseX * wC; childPhys.vy += impulseY * wC;
        childPhys.angVel += (rCx * impulseY - rCy * impulseX) * iC;
        parentPhys.vx -= impulseX * wP; parentPhys.vy -= impulseY * wP;
        parentPhys.angVel -= (rPx * impulseY - rPy * impulseX) * iP;
        if (observe && !passiveSolver) observe('anchor-constraint', beforeAnchor, pairEnergy!());
      }
      if (limited) {
        const beforeLimit = pairEnergy?.() ?? 0;
        const relAngVel = childPhys.angVel - parentPhys.angVel;
        const angImpulse = -(relAngVel + angularBias) / (iP + iC);
        childPhys.angVel += angImpulse * iC; parentPhys.angVel -= angImpulse * iP;
        if (observe && !passiveSolver) observe('angular-limit', beforeLimit, pairEnergy!());
      }
    }
  }

  if (passiveSolver) {
    let linear = 0, quadratic = 0;
    for (let i = 0; i < partCount; i++) {
      const p = org.segments[i], k = i * 3;
      const dx = p.vx - scratchConstraintStart[k], dy = p.vy - scratchConstraintStart[k + 1];
      const dw = p.angVel - scratchConstraintStart[k + 2];
      linear += scratchMasses[i] * (scratchConstraintStart[k] * dx + scratchConstraintStart[k + 1] * dy)
        + scratchInertias[i] * scratchConstraintStart[k + 2] * dw;
      quadratic += .5 * (scratchMasses[i] * (dx * dx + dy * dy) + scratchInertias[i] * dw * dw);
    }
    const scale = passiveConstraintScale(linear, quadratic);
    if (scale < 1) {
      org.motorDiagnostics!.constraintLimitedBatches!++;
      // A partial impulse still supplies the established positional response.
      // Repair pose separately only when no non-energizing impulse is possible.
      repairPose = scale <= 64 * Number.EPSILON;
      for (let i = 0; i < partCount; i++) {
        const p = org.segments[i], k = i * 3;
        p.vx = scratchConstraintStart[k] + scale * (p.vx - scratchConstraintStart[k]);
        p.vy = scratchConstraintStart[k + 1] + scale * (p.vy - scratchConstraintStart[k + 1]);
        p.angVel = scratchConstraintStart[k + 2] + scale * (p.angVel - scratchConstraintStart[k + 2]);
      }
    }
    if (observe) observe('constraint-batch', beforeConstraints,
      org.segments.reduce((sum, p, i) => sum + partKineticEnergy(p, g.parts[i], BASE_PART_DENSITY), 0));
  }

  if (passiveSolver && repairPose) {
    const beforeProjection = observe ? org.segments.reduce((sum, p, i) => sum + partKineticEnergy(p, g.parts[i], BASE_PART_DENSITY), 0) : 0;
    projectBodyJoints(org, 12);
    if (observe) observe('position-projection', beforeProjection, org.segments.reduce((sum, p, i) => sum + partKineticEnergy(p, g.parts[i], BASE_PART_DENSITY), 0));
  }

  for (let i = 0; i < partCount; i++) {
    const seg = org.segments[i];
    seg.x += seg.vx * dt_sub;
    seg.y += seg.vy * dt_sub;
    seg.angle += seg.angVel * dt_sub;
  }
  return frameMechanicalWork;
}

interface HatchBounds {left: number; right: number; top: number; bottom: number}
function bodyBounds(parts: PartDef[], segments: PartPhys[]): HatchBounds {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (let i = 0; i < parts.length; i++) for (const p of getPartCornerVertices(segments[i], parts[i])) {
    left = Math.min(left, p.x); right = Math.max(right, p.x);
    top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
  }
  return {left, right, top, bottom};
}

/** Bodies remain fixed during the egg pass. Share these exact bounds until a
 * successful hatch appends its new body's bounds; rebuild on every kernel tick. */
function hatchObstacles(organisms: Organism[]): HatchBounds[] {
  return organisms.filter(o => !o.dissolving).flatMap(o =>
    o.segments.map((p, i) => bodyBounds([o.genome.parts[i]], [p])));
}

/** Conservative empty envelope also prevents spawning arms around an existing body. */
/** Authoritative dry-run of the same eight-orientation clearance test used for hatching.
 * Does not consume PRNG or move the egg or adults.
 */
function hatchPlacement(egg: Egg, settings: SimulationSettings, organisms: Organism[], sharedObstacles?: HatchBounds[]) {
  const pose = restSegments(egg.genome.parts);
  const obstacles = sharedObstacles ?? hatchObstacles(organisms);
  let containedOrientation = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const heading = (egg.hatchHeading ?? 0) + attempt * Math.PI / 4, c = Math.cos(heading), s = Math.sin(heading);
    const segments = pose.map(p => ({...p, x: egg.x + c * p.x - s * p.y, y: egg.y + s * p.x + c * p.y, angle: p.angle + heading}));
    const b = bodyBounds(egg.genome.parts, segments), margin = 2;
    if (b.left < margin || b.top < margin || b.right > settings.worldWidth - margin || b.bottom > settings.worldHeight - margin) continue;
    containedOrientation = true;
    if (obstacles.some(a => a.left < b.right + margin && a.right > b.left - margin
      && a.top < b.bottom + margin && a.bottom > b.top - margin)) continue;
    return {heading, reason: 'clear' as const};
  }
  return {heading: null, reason: containedOrientation ? 'occupied' as const : 'tank-boundary' as const};
}

export function findClearHatchHeading(egg: Egg, settings: SimulationSettings, organisms: Organism[]): number | null {
  return hatchPlacement(egg, settings, organisms).heading;
}

export type EggHatchStatus = 'incubating' | 'nonviable' | 'population-cap' |
  'orientation-pending' | 'space-blocked' | 'tank-boundary' | 'clear' | 'world-debt' | 'funding' | 'expired';

/** Kernel-derived inspection, not a second, approximate hatching algorithm. */
export function evaluateEggHatchStatus(egg: Egg, settings: SimulationSettings, organisms: Organism[], pool?: EnergyPool): {
  status: EggHatchStatus; message: string; clearHeading: number | null;
} {
  if (pool && (egg.ageSeconds ?? 0) >= EGG_LIFETIME_MULTIPLIER * egg.totalIncubationTime)
    return {status: 'expired', message: 'Expired; will become carrion', clearHeading: null};
  if (egg.incubationProgress < 1) return {status: 'incubating',
    message: 'Incubating — not ready yet', clearHeading: null};
  if (pool && pool.reserve < 0) return {status: 'world-debt',
    message: 'Ready, waiting for world energy debt to clear', clearHeading: null};
  if (pool && (egg.fundedReserve + egg.fundedStructural < egg.genome.bodyCost
    || egg.fundedReserve + egg.fundedStructural + 1e-7 < eggEnergyRequirement(egg)))
    return {status: 'funding', message: 'Waiting for incubation energy; may recover before expiry', clearHeading: null};
  if (!pool && egg.fundedReserve + egg.fundedStructural < egg.genome.bodyCost) return {
    status: 'nonviable', message: 'Insufficient funded body energy; will become remains', clearHeading: null};
  if (!pool && organisms.filter(o => !o.dissolving).length >= (settings.maxOrganisms ?? 50)) return {
    status: 'population-cap', message: 'Ready, blocked by living population cap', clearHeading: null};
  if (egg.hatchHeading === undefined) return {
    status: 'orientation-pending', message: 'Ready; orientation will be chosen on the next tick', clearHeading: null};
  const placement = hatchPlacement(egg, settings, organisms);
  if (placement.heading !== null) return {status: 'clear',
    message: 'Ready; full-body hatch space is clear', clearHeading: placement.heading};
  if (placement.reason === 'tank-boundary') return {
    status: 'tank-boundary', message: 'Ready, blocked by tank boundary', clearHeading: null};
  return {status: 'space-blocked',
    message: 'Ready, blocked by nearby creature bodies', clearHeading: null};
}

// ============================================================================
// 3. AUTHORITATIVE MODULAR SIMULATION KERNEL (`stepSimulation`)
// ============================================================================
/** Evaluate the same ordered sums using dense or compiled enabled-row loops.
 * Learned offsets remain separate additions; current genome weights are read
 * on every tick. No lower precision, reassociation or sensing-rate changes. */
function evaluateOrganismBrain(org: Organism, dt: number): void {
  const g = org.genome;
  const hiddenCount = g.hiddenIds!.length;
  const plan = compiledBrain(g);
  const learnedMotor = org.learnedMotorWeights?.length ? compiledDeltas(org, plan) : null;
  const learnedRetina = org.learnedSensoryWeights?.length
    ? (learnedMotor ?? compiledDeltas(org, plan)) : null;
  const inputCount = org.neuralInputs.length;
  for (let h = 0; h < hiddenCount; h++) scratchPrevHidden[h] = org.neuralHidden[h] || 0;
  
  for (let h = 0; h < hiddenCount; h++) {
    let sum = g.biasesH[h] || 0;
    const ihRow = g.weightsIH[h], hhRow = g.weightsHH[h];
    const ihOffset = h * inputCount;
    const enabledInputs = plan.enabledIH[h];
    if (enabledInputs) {
      for (let k = 0; k < enabledInputs.length; k++) {
        const inp = enabledInputs[k];
        sum += (org.neuralInputs[inp] || 0) * (ihRow?.[inp] || 0);
        if (learnedRetina) {
          const delta = learnedRetina.sensory[ihOffset + inp];
          if (delta !== 0) sum += (org.neuralInputs[inp] || 0) * delta;
        }
      }
    } else {
      for (let inp = 0; inp < org.neuralInputs.length; inp++) {
        sum += (org.neuralInputs[inp] || 0) * (ihRow?.[inp] || 0);
        if (learnedRetina) {
          const delta = learnedRetina.sensory[ihOffset + inp];
          if (delta !== 0) sum += (org.neuralInputs[inp] || 0) * delta;
        }
      }
    }
    const enabledRecurrent = plan.enabledHH[h];
    if (enabledRecurrent) {
      for (let k = 0; k < enabledRecurrent.length; k++) {
        const rh = enabledRecurrent[k];
        sum += scratchPrevHidden[rh] * (hhRow?.[rh] || 0);
      }
    } else for (let rh = 0; rh < hiddenCount; rh++) sum += scratchPrevHidden[rh] * (hhRow?.[rh] || 0);
    const next = isNaN(sum) ? 0 : Math.tanh(sum);
    org.neuralHidden[h] = integrateNeuronMemory(scratchPrevHidden[h], next, g.hiddenTimeConstants![h], dt);
  }
  
  const numJoints = org.segments.length - 1;
  for (let o = 0; o < numJoints * OUTPUTS_PER_JOINT; o++) {
    let sum = g.biasesO[o] || 0;
    const hoRow = g.weightsHO[o];
    const enabledOutputs = plan.enabledHO[o];
    if (enabledOutputs) {
      for (let k = 0; k < enabledOutputs.length; k++) {
        const h = enabledOutputs[k];
        sum += org.neuralHidden[h] * (hoRow?.[h] || 0);
      }
    } else for (let h = 0; h < hiddenCount; h++) sum += org.neuralHidden[h] * (hoRow?.[h] || 0);
    // Acquired synapse offsets alter the neural motor command, not genome
    // weights, and cannot activate a disabled connection.
    if (learnedMotor && (g.plasticMotorScope === 'all' || g.outputKeys![o].endsWith(':Angle'))) {
      if (enabledOutputs) {
        for (let k = 0; k < enabledOutputs.length; k++) {
          const h = enabledOutputs[k], slot = o * hiddenCount + h;
          sum += org.neuralHidden[h] * learnedMotor.motor[slot];
        }
      } else for (let h = 0; h < hiddenCount; h++) {
        const slot = o * hiddenCount + h;
        sum += org.neuralHidden[h] * learnedMotor.motor[slot];
      }
    }
    org.neuralOutputs[o] = isNaN(sum) ? 0 : Math.tanh(sum);
  }
  
}

/** At the particle safety limit, aggregate remains rather than losing energy.
 * Allow one carrion slot above the normal food limit if all slots hold plants. */
function closedCarrion(state: SimulationState, x: number, y: number, energy: number): void {
  if (energy <= 0) return;
  const existing = state.nutrients.length >= FOOD_SAFETY_LIMIT
    ? state.nutrients.find(n => n.kind === 'carrion') : undefined;
  if (existing) {
    existing.energyValue += energy;
    existing.radius = getNutrientRadius(existing.energyValue);
    existing.decayTimeRemaining = CARRION_DECAY_SECONDS;
    return;
  }
  state.nutrients.push({id: `REM-${state.prng.nextUint32().toString(36)}`,
    kind: 'carrion', decayTimeRemaining: CARRION_DECAY_SECONDS,
    x, y, vx: 0, vy: 0, energyValue: energy, radius: getNutrientRadius(energy),
    bottomTimer: 0, pulseTimer: state.prng.range(0, Math.PI * 2)});
}

export function stepSimulation(
  state: SimulationState,
  settings: SimulationSettings,
  dt: number,
  onEvent?: (type: 'birth' | 'death' | 'eat' | 'clash' | 'egg_loss') => void,
  observeMechanics?: MechanicalObserver,
  foundationTrial?: FoundationTrial,
): void {
  const mu = settings.waterViscosity ?? 0.22;
  const worldWidth = settings.worldWidth;
  const worldHeight = settings.worldHeight;
  const targetNutrientsVal = settings.targetNutrients ?? 800;
  const inflowRateVal = settings.inflowRate ?? 15;
  const isKinshipProtected = settings.kinshipProtection ?? true;
  const mutationSeverity = settings.mutationSeverity ?? 0.25;
  const gravity = settings.gravity ?? 0;

  state.simTime += dt;
  const organisms = state.organisms;
  const eggs = state.eggs;
  const nutrients = state.nutrients;
  const bubbles = state.bubbles;
  const caustics = state.caustics;
  const ledger = state.ledger;
  const prng = state.prng;
  let returnedEnergy = 0;

  // Carrion does not suppress environmental plant-food replenishment.
  const plantCount = nutrients.filter(n => n.kind !== 'carrion').length;
  // 1. Environmental Nutrient Inflow
  if ((state.energyPool ? nutrientSpawnSlots(state, settings) <= 0 : plantCount >= targetNutrientsVal) || inflowRateVal <= 0) {
    state.nutrientAccumulator = 0;
  } else {
    state.nutrientAccumulator += inflowRateVal * dt;
    if (state.nutrientAccumulator >= 1.0) {
      const spawnCount = addNutrients(state, settings, Math.floor(state.nutrientAccumulator));
      state.nutrientAccumulator -= spawnCount;
    }
  }

  // Mineralization waits for a plant-food slot; stored carrion energy is never deleted.
  let decaySlots = Math.max(0, targetNutrientsVal - nutrients.filter(n => n.kind !== 'carrion').length);
  // 2. Nutrients Motion
  const fluidDampingExp = Math.exp(-mu * 12.0 * dt);
  for (let i = 0; i < nutrients.length; i++) {
    const nut = nutrients[i];
    if (nut.kind === 'carrion') {
      nut.decayTimeRemaining = Math.max(0, (nut.decayTimeRemaining ?? CARRION_DECAY_SECONDS) - dt);
      if (state.energyPool && nut.decayTimeRemaining === 0) {
        state.energyPool.reserve += nut.energyValue;
        nutrients.splice(i--, 1);
        continue;
      }
      if (nut.decayTimeRemaining === 0 && decaySlots > 0) {
        decaySlots--;
        nut.kind = 'nutrient';
        delete nut.decayTimeRemaining;
      }
    }
    nut.vy += gravity * dt;
    nut.vx *= fluidDampingExp;
    nut.vy *= fluidDampingExp;
    nut.x += nut.vx * dt;
    nut.y += nut.vy * dt;
    nut.pulseTimer = (nut.pulseTimer || 0) + dt * (nut.isSuper ? 4.0 : 2.5);

    if (nut.x < 35) { nut.x = 35; nut.vx = 0; }
    if (nut.x > worldWidth - 35) { nut.x = worldWidth - 35; nut.vx = 0; }
    if (nut.y < 35) { nut.y = 35; nut.vy = 0; }
    if (nut.y > worldHeight - 35) { nut.y = worldHeight - 35; nut.vy = 0; }
  }

  // 3. Caustics
  for (const c of caustics) {
    c.angle += c.speed * dt;
    c.x += Math.cos(c.angle) * 12 * dt;
    c.y += Math.sin(c.angle) * 12 * dt;
    if (c.x < 0) c.x = worldWidth;
    if (c.x > worldWidth) c.x = 0;
    if (c.y < 0) c.y = worldHeight;
    if (c.y > worldHeight) c.y = 0;
  }

  let sharedHatchObstacles: HatchBounds[] | undefined;
  fundIncubatingEggs(state, dt);
  // 4. Incubating Multi-Egg Clutches (Full energy accounting: non-viable damaged eggs decompose without duplicate hatching)
  for (let i = eggs.length - 1; i >= 0; i--) {
    const egg = eggs[i];
    if (state.energyPool) {
      egg.ageSeconds = (egg.ageSeconds ?? 0) + dt;
      if (egg.ageSeconds >= EGG_LIFETIME_MULTIPLIER * egg.totalIncubationTime) {
        closedCarrion(state, egg.x, egg.y, egg.fundedStructural + egg.fundedReserve);
        eggs.splice(i, 1);
        onEvent?.('egg_loss');
        continue;
      }
    }
    egg.incubationProgress = Math.min(1.0, egg.incubationProgress + dt / egg.totalIncubationTime);
    egg.pulseTimer += dt * 4.5;
    egg.vy += gravity * dt;
    egg.vx *= fluidDampingExp;
    egg.vy *= fluidDampingExp;

    egg.x += egg.vx * dt;
    egg.y += egg.vy * dt;

    if (egg.x < 35) { egg.x = 35; egg.vx = 0; }
    if (egg.x > worldWidth - 35) { egg.x = worldWidth - 35; egg.vx = 0; }
    if (egg.y < 35) { egg.y = 35; egg.vy = 0; }
    if (egg.y > worldHeight - 35) { egg.y = worldHeight - 35; egg.vy = 0; }

    const remainingEggEnergy = egg.fundedStructural + egg.fundedReserve;

    // Check viability at completion
    if (egg.incubationProgress >= 1.0) {
      const requiredBodyCost = egg.genome.bodyCost;
      if (state.energyPool && (state.energyPool.reserve < 0 || remainingEggEnergy < requiredBodyCost
        || remainingEggEnergy + 1e-7 < eggEnergyRequirement(egg))) {
        egg.readyToHatch = true;
        continue;
      }

      if (remainingEggEnergy < requiredBodyCost) {
        // Nonviable eggs leave edible remains, with no unfunded energy.
        if (remainingEggEnergy > 5.0 && nutrients.length < 2200) {
          nutrients.push({
            id: `REM-${prng.nextUint32().toString(36)}`,
            kind: 'carrion', decayTimeRemaining: CARRION_DECAY_SECONDS,
            x: egg.x,
            y: egg.y,
            vx: 0,
            vy: 0,
            energyValue: remainingEggEnergy,
            radius: getNutrientRadius(remainingEggEnergy),
            bottomTimer: 0,
            pulseTimer: prng.range(0, Math.PI * 2),
          });
        } else {
          ledger.recordedLosses += remainingEggEnergy;
        }
        eggs.splice(i, 1);
        if (onEvent) onEvent('egg_loss');
        continue;
      }

      // Successful Hatching: Exactly fundedStructural becomes structural biomass, remaining becomes usable reserve
      egg.readyToHatch = true;
      if (state.energyPool || organisms.filter(o => !o.dissolving).length < (settings.maxOrganisms ?? 50)) {
        egg.hatchHeading ??= prng.range(0, Math.PI * 2);
        sharedHatchObstacles ??= hatchObstacles(organisms);
        const heading = hatchPlacement(egg, settings, organisms, sharedHatchObstacles).heading;
        if (heading === null) continue; // Remain funded, edible and ready until a full body fits.
        const startingUsableReserve = remainingEggEnergy - requiredBodyCost;
        const baby = spawnOrganism(
          egg.genome,
          egg.x,
          egg.y,
          heading,
          egg.clutchId,
          startingUsableReserve,
          prng,
        );
        baby.structuralBiomass = requiredBodyCost;
        organisms.push(baby);
        for (let p = 0; p < baby.segments.length; p++)
          sharedHatchObstacles.push(bodyBounds([baby.genome.parts[p]], [baby.segments[p]]));
        state.totalBirths += 1;

        state.lineage.set(baby.id, {
          id: baby.id,
          parentIds: [egg.parentOrgId],
          generation: baby.genome.generation,
          birthTime: state.simTime,
          offspringCount: 0,
          archetype: baby.genome.archetype || 'Offspring',
          hue: baby.genome.hue,
          diet: getDietClassification(baby.genome.mouths).label,
          genome: baby.genome,
        });

        markLineageChanged(state.lineage, baby.id);
        eggs.splice(i, 1);
        if (onEvent) onEvent('birth');
      }
    }
  }

  // Nutrient vision broadphase is per-step scratch, never part of snapshots.
  // Corpse dissolution can append carrion while iterating living organisms,
  // so rebuild on any length change before their next eye cast.
  // The entire sensing pass precedes movement. Index all physical objects in
  // legacy priority order: food, eggs, then organism/part order. Pigment remains
  // dynamic because earlier animals may have paid for learning this tick.
  const bodySight = organisms.flatMap(other => other.dissolving ? [] : other.segments.map((seg, part) => {
    const def = other.genome.parts[part], corners = getPartCornerVertices(seg, def);
    const bounds = {left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
      top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y))};
    return {kind: 'body' as const, other, part, seg, def, corners, bounds};
  }));
  const eggSight = eggs.map(egg => ({kind: 'egg' as const, egg,
    bounds: {left: egg.x - 16, right: egg.x + 16, top: egg.y - 16, bottom: egg.y + 16}}));
  type SightEntry = {kind: 'food'; food: Nutrient; bounds: SpatialBounds}
    | (typeof eggSight)[number] | (typeof bodySight)[number];
  let sightGrid: OrderedSpatialIndex | undefined, sightFoodCount = -1;
  let sightEntries: SightEntry[] = [];
  // 5. Organisms Simulation
  for (let orgIdx = organisms.length - 1; orgIdx >= 0; orgIdx--) {
    const org = organisms[orgIdx];
    const g = org.genome;

    if (org.dissolving) {
      org.dissolveAlpha -= dt * 1.5;
      if (org.dissolveAlpha <= 0) {
        const deadPos = org.segments[0];
        const totalRemainingEnergy = Math.max(0, org.structuralBiomass) + Math.max(0, org.energy);
        if (state.energyPool) {
          closedCarrion(state, clampVal(deadPos.x, 40, worldWidth - 40),
            clampVal(deadPos.y, 40, worldHeight - 40), totalRemainingEnergy);
        } else if (totalRemainingEnergy > 0 && nutrients.length < 2200) {
          nutrients.push({
            id: `REM-${prng.nextUint32().toString(36)}`,
            kind: 'carrion', decayTimeRemaining: CARRION_DECAY_SECONDS,
            x: clampVal(deadPos.x, 40, worldWidth - 40),
            y: clampVal(deadPos.y, 40, worldHeight - 40), vx: 0, vy: 0,
            energyValue: totalRemainingEnergy, radius: getNutrientRadius(totalRemainingEnergy),
            bottomTimer: 0, pulseTimer: prng.range(0, Math.PI * 2),
          });
        } else ledger.recordedLosses += totalRemainingEnergy;

        const cause: DeathCause = org.deathCause || (org.age >= org.maxLifespan ? 'Old Age' : org.energy <= 0 ? 'Starvation' : 'Predation');
        const rec = state.lineage.get(org.id);
        if (rec) {
          rec.deathTime = state.simTime;
          rec.deathCause = cause;
          rec.deathAge = org.age;
          rec.deathEnergy = Math.max(0, org.energy);
          markLineageChanged(state.lineage, org.id);
        }

        if (!state.recentDeaths) state.recentDeaths = [];
        state.recentDeaths.unshift({
          id: org.id,
          name: org.genome.name || org.id,
          generation: org.genome.generation,
          cause,
          age: org.age,
          energyAtDeath: Math.max(0, org.energy),
          offspringCount: org.offspringCount,
          timestamp: state.simTime,
        });
        if (state.recentDeaths.length > 30) state.recentDeaths.pop();

        organisms.splice(orgIdx, 1);
        state.totalDeaths += 1;
        if (onEvent) onEvent('death');
      }
      continue;
    }

    org.age += dt;
    org.glowPulse += dt * 3.5;
    if (org.isFeedingHighlight > 0) {
      org.isFeedingHighlight = Math.max(0, org.isFeedingHighlight - dt);
    }

    // Trace breadcrumbs
    if (!org.traceHistory) org.traceHistory = [];
    if (org.traceHistory.length === 0 || Math.hypot(org.segments[0].x - org.traceHistory[org.traceHistory.length - 1].x, org.segments[0].y - org.traceHistory[org.traceHistory.length - 1].y) > 12) {
      org.traceHistory.push({x: org.segments[0].x, y: org.segments[0].y, time: state.simTime});
      if (org.traceHistory.length > 30) org.traceHistory.shift();
    }

    // A. MULTI-EYE OPTICAL RGB RAYCAST WITH WATER ATTENUATION
    if (!sightGrid || sightFoodCount !== nutrients.length) {
      const foodSight: SightEntry[] = nutrients.map(food => ({kind: 'food', food,
        bounds: {left: food.x - food.radius, right: food.x + food.radius,
          top: food.y - food.radius, bottom: food.y + food.radius}}));
      sightEntries = [...foodSight, ...eggSight, ...bodySight];
      sightGrid = new OrderedSpatialIndex(sightEntries.map(entry => entry.bounds));
      sightFoodCount = nutrients.length;
    }
    org.rayHits = [];
    org.neuralInputs.fill(0);
    let rayInputIdx = 0;
    const totalEyes = g.eyes.length;

    for (let eIdx = 0; eIdx < totalEyes; eIdx++) {
      const eye = g.eyes[eIdx];
      const eyePartIdx = Math.min(eye.partIndex, org.segments.length - 1);
      const eyePhys = org.segments[eyePartIdx];
      const eyeDef = g.parts[eyePartIdx];

      const eyeAnchorLocal = getOrganAnchor(eye, eyeDef.width, eyeDef.height);
      const cosA = Math.cos(eyePhys.angle);
      const sinA = Math.sin(eyePhys.angle);
      const eyeWorldX = eyePhys.x + cosA * eyeAnchorLocal.x - sinA * eyeAnchorLocal.y;
      const eyeWorldY = eyePhys.y + sinA * eyeAnchorLocal.x + cosA * eyeAnchorLocal.y;

      const baseHeading = eyePhys.angle + getCardinalBaseAngle(eye.direction);
      const fov = eye.fov;
      const maxRange = eye.range;
      const raysToCast = RAYS_PER_EYE;

      for (let r = 0; r < raysToCast; r++) {
        const rayOffset = raysToCast > 1 ? (r / (raysToCast - 1) - 0.5) * fov : 0;
        const rayAngle = baseHeading + rayOffset;
        const rayDirX = Math.cos(rayAngle);
        const rayDirY = Math.sin(rayAngle);

        let closestDist = maxRange;
        let hitHit = false;
        let hitX = eyeWorldX + rayDirX * maxRange;
        let hitY = eyeWorldY + rayDirY * maxRange;
        let hitR = WATER_AMBIENT_RGB[0];
        let hitG = WATER_AMBIENT_RGB[1];
        let hitB = WATER_AMBIENT_RGB[2];
        let hitType: RayHit['objectType'] = 'none';

        // Walls, grid, bubbles, rays, glows and other display effects are invisible.
        const candidates = sightGrid.query(eyeWorldX, eyeWorldY,
          eyeWorldX + rayDirX * maxRange, eyeWorldY + rayDirY * maxRange);
        for (const candidate of candidates) {
          const entry = sightEntries[candidate];
          if (entry.kind === 'food') {
            const nut = entry.food;
            if (Math.abs(nut.x - eyeWorldX) > closestDist + nut.radius || Math.abs(nut.y - eyeWorldY) > closestDist + nut.radius) continue;
            const res = rayCircleIntersection(eyeWorldX, eyeWorldY, rayDirX, rayDirY, closestDist, nut.x, nut.y, nut.radius);
            if (res.hit && res.dist < closestDist) {
              closestDist = res.dist; hitHit = true; hitX = res.pointX; hitY = res.pointY;
              [hitR, hitG, hitB] = getFoodRGB(nut); hitType = nut.kind === 'carrion' ? 'carrion' : 'nutrient';
            }
          } else if (entry.kind === 'egg') {
            const egg = entry.egg;
            if (Math.abs(egg.x - eyeWorldX) > closestDist + 24 || Math.abs(egg.y - eyeWorldY) > closestDist + 24) continue;
            const res = rayCircleIntersection(eyeWorldX, eyeWorldY, rayDirX, rayDirY, closestDist, egg.x, egg.y, 16.0);
            if (res.hit && res.dist < closestDist) {
              closestDist = res.dist; hitHit = true; hitX = res.pointX; hitY = res.pointY;
              [hitR, hitG, hitB] = EGG_RGB; hitType = 'egg';
            }
          } else {
            const {other, part, seg: otherSeg, corners} = entry;
            if (other.id === org.id || other.dissolving) continue;
            // Preserve the legacy exact-test prefilter as well as edge/tie order.
            if (Math.abs(otherSeg.x - eyeWorldX) > closestDist + 50 || Math.abs(otherSeg.y - eyeWorldY) > closestDist + 50) continue;
            for (let c = 0; c < 4; c++) {
              const c1 = corners[c], c2 = corners[(c + 1) % 4];
              const inter = lineIntersection(eyeWorldX, eyeWorldY,
                eyeWorldX + rayDirX * closestDist, eyeWorldY + rayDirY * closestDist,
                c1.x, c1.y, c2.x, c2.y);
              if (inter.hit) {
                const dist = Math.hypot(inter.x - eyeWorldX, inter.y - eyeWorldY);
                if (dist < closestDist) {
                  closestDist = dist; hitHit = true; hitX = inter.x; hitY = inter.y;
                  [hitR, hitG, hitB] = hslToRgb(...getBodyPigment(other, part)); hitType = 'creature';
                }
              }
            }
          }
        }

        // Beer-Lambert attenuation toward black; only physical object surfaces contribute RGB.
        const alpha = 1.0 / (maxRange * 0.55);
        const expTerm = Math.exp(-alpha * closestDist);
        const finalR = (1 - expTerm) * WATER_AMBIENT_RGB[0] + expTerm * hitR;
        const finalG = (1 - expTerm) * WATER_AMBIENT_RGB[1] + expTerm * hitG;
        const finalB = (1 - expTerm) * WATER_AMBIENT_RGB[2] + expTerm * hitB;

        // Receptors filter received light, not geometry. A fully invisible
        // surface still occludes what is physically behind it; crucially the
        // distance input cannot reveal a surface with no spectral response.
        // A legacy eye omitting the allele receives exactly the old values.
        const gains = eye.spectralSensitivity;
        const sensedR = gains ? finalR * gains[0] : finalR;
        const sensedG = gains ? finalG * gains[1] : finalG;
        const sensedB = gains ? finalB * gains[2] : finalB;
        const opticallyDetected = sensedR > 1e-12 || sensedG > 1e-12 || sensedB > 1e-12;
        org.neuralInputs[rayInputIdx++] = sensedR;
        org.neuralInputs[rayInputIdx++] = sensedG;
        org.neuralInputs[rayInputIdx++] = sensedB;
        org.neuralInputs[rayInputIdx++] = opticallyDetected
          ? clampVal(closestDist / maxRange, 0, 1) : 1;

        org.rayHits.push({
          eyeId: eye.id, rayIndex: r,
          hit: hitHit,
          dist: closestDist,
          pointX: hitX,
          pointY: hitY,
          r: sensedR,
          g: sensedG,
          b: sensedB,
          objectType: hitType,
        });
      }
    }

    // All joints have normalized angle and angular-velocity feedback.
    for (let j = 0; j < org.joints.length; j++) {
      org.neuralInputs[rayInputIdx++] = clampVal(org.joints[j].currentRelAngle / Math.max(.01, g.parts[j + 1].maxAngle), -1, 1);
      org.neuralInputs[rayInputIdx++] = clampVal(org.joints[j].currentRelAngVel / 20, -1, 1);
    }
    org.neuralInputs[rayInputIdx++] = clampVal(org.speed / 60, 0, 1);
    org.neuralInputs[rayInputIdx++] = clampVal(org.energy / Math.max(1, g.maxEnergyCapacity), 0, 1);
    const masterPhase = org.joints[0]?.phase ?? 0;
    org.neuralInputs[rayInputIdx++] = Math.sin(masterPhase);
    org.neuralInputs[rayInputIdx++] = Math.cos(masterPhase);

    // Actual oral feedback from the previous completed tick, never future target data.
    for (const mouth of g.mouths) {
      const feedback = org.mouthFeedback?.[mouth.id];
      org.neuralInputs[rayInputIdx++] = feedback?.contact ?? 0;
      org.neuralInputs[rayInputIdx++] = feedback?.intake ?? 0;
    }

    org.neuralInputs[rayInputIdx++] = g.mouths.some(m => (org.mouthFeedback?.[m.id]?.intake ?? 0) > 0) ? 1 : 0;
    org.neuralInputs[rayInputIdx++] = clampVal(calculateOrganismCOM(org).y / Math.max(1, worldHeight), 0, 1);
    // The only injury cue is actual energy removed by a *physical mouth bite*,
    // never nearby color, predator identity, proximity, or ordinary metabolism.
    // Read once per neural tick, then clear before this tick's feeding pass.
    org.neuralInputs[rayInputIdx++] = clampVal((org.biteFeedbackJ ?? 0) / 60, 0, 1);
    org.biteFeedbackJ = 0;

    // B. RECURRENT NEURAL EVALUATION. The original dense 24-node loop retains its
    // arithmetic order; explicit disabled keys opt individual edges out.
    evaluateOrganismBrain(org, dt);
    // Reward is from legitimate physical contact on the PREVIOUS tick.
    // Mutations in a living animal's learned offsets change subsequent
    // motor commands only, with their own debited metabolic cost.
    if ((g.plasticityRate ?? 0) > 0) {
      const motorLearningCost = applyWakingPlasticity(org, dt, ledger);
      org.plasticityEnergyRate = motorLearningCost / dt;
      returnedEnergy += motorLearningCost;
    }
    if ((g.sensoryPlasticityRate ?? 0) > 0) {
      const sensoryCostJ = applySensoryAssociations(org, dt, ledger);
      returnedEnergy += sensoryCostJ;
      const sensoryCost = sensoryCostJ / dt;
      // The displayed rate is THIS tick's debit, not a running sum when
      // sensory learning evolves without the older motor-learning allele.
      org.plasticityEnergyRate = ((g.plasticityRate ?? 0) > 0
        ? (org.plasticityEnergyRate ?? 0) : 0) + sensoryCost;
    }

  }

  // All bodies advance on the same substep clock. Resolve solid body/self-contact
  // before feeding, so mouths bite at the physical contact surface.
  const active = organisms.filter(org => !org.dissolving);
  const corrected = usesPaidActuation(settings.physicsRegime);
  if (corrected) for (const org of active) org.motorDiagnostics = {
    positiveWorkJ: 0, negativeWorkJ: 0, energyLimitedImpulses: 0, numericalGuardEvents: 0,
    ...(settings.physicsRegime === 'passive-work-v3' ? {constraintLimitedBatches: 0} : {})};
  const work = new Map(active.map(org => [org, 0]));
  const substeps = Math.max(NUM_SUBSTEPS, Math.ceil(dt * 240));
  for (let sub = 0; sub < substeps; sub++) {
    for (const org of active) work.set(org, work.get(org)! + advanceOrganismPhysics(org, settings, dt / substeps, observeMechanics, foundationTrial));
    resolveBodyContacts(active, BASE_PART_DENSITY, projectBodyJoints, observeMechanics);
  }
  for (let index = active.length - 1; index >= 0; index--) {
    const org = active[index], g = org.genome;
    let frameMechanicalWork = work.get(org)!;

    // Historical saves retain their old billing cap; corrected impulses are prepaid.
    if (!corrected) frameMechanicalWork = Math.min(MAX_FRAME_MOTOR_WORK, frameMechanicalWork);

    // Mass-Weighted COM Speed & Odometry
    const comData = calculateOrganismCOM(org);
    org.speed = Math.hypot(comData.vxCOM, comData.vyCOM);
    org.distanceTraveled += org.speed * dt;

    // Area-Normalized Basal & Sensory Metabolism
    const sizeRatio = calculateTotalBodyArea(g.parts) / BASE_FOUNDER_AREA;
    const basalRate = BASAL_METABOLIC_RATE * sizeRatio * g.metabolicEfficiency;
    // Reference-normalized synapse upkeep: every original 24-node dense
    // controller costs exactly what it did in v0.8, for any anatomy. Added
    // enabled synapses cost energy; disabled/pruned edges save it.
    const referenceEdges = NUM_HIDDEN * (g.inputKeys!.length + NUM_HIDDEN + g.outputKeys!.length);
    const sensoryRate = Math.max(0,
      SENSORY_NEURAL_METABOLIC_RATE * (eyeSensoryUpkeep(g.eyes) + g.hiddenIds!.length + g.mouths.length * 2)
      + NEURAL_EDGE_METABOLIC_RATE * (enabledBrainEdgeCount(g) - referenceEdges)
      + memoryUpkeep(g));
    const motorRate = frameMechanicalWork / dt;

    const basalMetabolism = basalRate * dt;
    const sensoryMetabolism = sensoryRate * dt;
    const totalBasalDissipation = basalMetabolism + sensoryMetabolism;

    org.basalEnergyRate = basalRate;
    org.sensoryEnergyRate = sensoryRate;
    org.motorEnergyRate = motorRate;
    org.totalEnergyRate = basalRate + sensoryRate + motorRate + (org.plasticityEnergyRate ?? 0);

    // Deduct expenditure and ensure reserves strictly stop at 0.0 (no negative reserves)
    const requiredExpenditure = totalBasalDissipation + (corrected ? 0 : frameMechanicalWork);
    const paidFraction = requiredExpenditure > 0
      ? Math.min(1, org.energy / requiredExpenditure) : 0;
    org.energy = Math.max(0.0, org.energy - requiredExpenditure);
    ledger.metabolicDissipation += totalBasalDissipation * paidFraction;
    ledger.mechanicalWorkHeat += frameMechanicalWork * (corrected ? 1 : paidFraction);
    returnedEnergy += totalBasalDissipation * paidFraction + frameMechanicalWork * (corrected ? 1 : paidFraction);

  }
  // Feeding has its own post-movement index; sight bounds must never be reused.
  const preyGrid = new OrderedSpatialIndex(organisms.map(other => bodyBounds(other.genome.parts, other.segments)));
  let oralFoodGrid: NutrientSightGrid | undefined;
  let oralEggGrid: OrderedSpatialIndex | undefined, oralEggCount = -1;
  // Charge every active body's expenditure before any bites are exchanged.
  for (let index = active.length - 1; index >= 0; index--) {
    const org = active[index], g = org.genome;
    if (org.dissolving) continue;
    // D. CONTACT FEEDING. One chemical-intake budget per mouth and simulated tick.
    const oralFeedback: NonNullable<Organism['mouthFeedback']> = Object.create(null);
    for (const mouth of g.mouths) {
      const feedback = oralFeedback[mouth.id] = {contact: 0, intake: 0};
      const host = Math.min(mouth.partIndex, org.segments.length - 1);
      const phys = org.segments[host], def = g.parts[host];
      const anchor = getOrganAnchor(mouth, def.width, def.height);
      const cos = Math.cos(phys.angle), sin = Math.sin(phys.angle);
      const cx = phys.x + cos * anchor.x - sin * anchor.y;
      const cy = phys.y + sin * anchor.x + cos * anchor.y;
      const {radius: mouthRadius, halfSpan: halfAperture} = mouthDimensions(mouth);
      const normal = getCardinalOutwardNormal(mouth.direction);
      const tx = cos * -normal.y - sin * normal.x;
      const ty = sin * -normal.y + cos * normal.x;
      const x1 = cx - tx * halfAperture, y1 = cy - ty * halfAperture;
      const x2 = cx + tx * halfAperture, y2 = cy + ty * halfAperture;
      const eatsMeat = mouth.mouthType !== 'herbivore';
      const eatsPlants = mouth.mouthType !== 'carnivore';
      const allowance = (mouth.mouthType === 'omnivore' ? OMNIVORE_EAT_RATE : CONTINUOUS_EAT_RATE) * dt;
      let remainingIntake = allowance;
      const canEat = () => remainingIntake > 0 && org.energy < g.maxEnergyCapacity;
      const consume = (available: number, category: FoodCategory, tissueEfficiency = 1): number => {
        const efficiency = MOUTH_ASSIMILATION * tissueEfficiency;
        const transfer = Math.min(Math.max(0, available), remainingIntake,
          Math.max(0, g.maxEnergyCapacity - org.energy) / efficiency);
        if (transfer <= 0) return 0;
        const absorbed = transfer * efficiency;
        feedback.intake = clampVal(feedback.intake + absorbed / Math.max(1e-9, allowance), 0, 1);
        remainingIntake = Math.max(0, remainingIntake - transfer);
        org.energy += absorbed;
        ledger.metabolicDissipation += transfer - absorbed;
        returnedEnergy += transfer - absorbed;
        org.isFeedingHighlight = .2;
        recordFeedingEvent(org, state.simTime, mouth.id, mouth.mouthType, category, absorbed);
        return transfer;
      };

      const left = Math.min(x1, x2) - mouthRadius, right = Math.max(x1, x2) + mouthRadius;
      const top = Math.min(y1, y2) - mouthRadius, bottom = Math.max(y1, y2) + mouthRadius;
      if (eatsMeat) {
        for (const i of preyGrid.queryBounds(left, top, right, bottom).reverse()) {
          if (!(canEat() || !feedback.contact)) break;
          const prey = organisms[i];
          if (prey.id === org.id || prey.dissolving || (isKinshipProtected && areSiblings(org, prey))) continue;
          let contact = false;
          for (let part = 0; part < prey.segments.length && !contact; part++) {
            const pos = prey.segments[part], def = prey.genome.parts[part];
            // Conservative rectangle half-diagonal + mouth aperture bounds;
            // unlike a fixed 70px cutoff, this also handles large mutated parts.
            const reach = Math.hypot(def.width, def.height) * .5 + halfAperture + mouthRadius;
            if (Math.abs(pos.x - cx) > reach || Math.abs(pos.y - cy) > reach) continue;
            contact = settings.mouthContactModel === 'capsule-v1'
              ? capsuleContactsPart(x1, y1, x2, y2, mouthRadius, pos, def)
              : mouthApertureContactsPart(cx, cy, x1, y1, x2, y2, mouthRadius, pos, def);
          }
          if (!contact) continue;
          feedback.contact = 1;
          const reserveBite = prey.energy > 0;
          const transfer = consume(reserveBite ? prey.energy : prey.structuralBiomass, 'Prey', reserveBite ? 1 : .85);
          if (transfer <= 0) continue;
          if (reserveBite) prey.energy = Math.max(0, prey.energy - transfer);
          else prey.structuralBiomass = Math.max(0, prey.structuralBiomass - transfer);
          // Deliver a next-tick proprioceptive injury cue to the victim only.
          // Transfer is capped by real available reserve/tissue and the mouth's
          // budget; no phantom damage or energy source is introduced.
          prey.biteFeedbackJ = (prey.biteFeedbackJ ?? 0) + transfer;
          // The bite that exhausts a living victim is lethal predation, not later starvation.
          // Its remaining tissue is conserved in the edible remains below.
          if (prey.energy <= 0) {
            prey.deathCause = 'Predation'; prey.dissolving = true; prey.dissolveAlpha = 1;
            org.preyEaten++; org.foodEaten++;
            if (onEvent) onEvent('clash');
          }
        }
        // Reproduction can append eggs between mouths; predation can remove them.
        if (!oralEggGrid || oralEggCount !== eggs.length) {
          oralEggGrid = new OrderedSpatialIndex(eggs.map(egg => ({
            left: egg.x - 16, right: egg.x + 16, top: egg.y - 16, bottom: egg.y + 16})));
          oralEggCount = eggs.length;
        }
        for (const i of oralEggGrid.queryBounds(left, top, right, bottom).reverse()) {
          if (!(canEat() || !feedback.contact)) break;
          const egg = eggs[i];
          if (isKinshipProtected && isEggKin(org, egg)) continue;
          if (distPointToSegment(egg.x, egg.y, x1, y1, x2, y2) > 16 + mouthRadius) continue;
          feedback.contact = 1;
          const transfer = consume(egg.fundedReserve + egg.fundedStructural, 'Egg');
          if (transfer <= 0) continue;
          const reserve = Math.min(egg.fundedReserve, transfer);
          egg.fundedReserve -= reserve;
          egg.fundedStructural = Math.max(0, egg.fundedStructural - (transfer - reserve));
          if (egg.fundedReserve + egg.fundedStructural <= 2) {
            ledger.recordedLosses += egg.fundedReserve + egg.fundedStructural;
            returnedEnergy += egg.fundedReserve + egg.fundedStructural;
            org.eggsPredated = (org.eggsPredated || 0) + 1;
            org.preyEaten++; org.foodEaten++;
            eggs.splice(i, 1); oralEggGrid = undefined;
            if (onEvent) onEvent('clash');
          }
        }
      }
      if (!oralFoodGrid || oralFoodGrid.nutrientCount !== nutrients.length)
        oralFoodGrid = new NutrientSightGrid(nutrients);
      for (const i of oralFoodGrid.queryBounds(left, top, right, bottom).reverse()) {
        if (!(canEat() || !feedback.contact)) break;
        const food = nutrients[i], carrion = food.kind === 'carrion';
        if (carrion ? !eatsMeat : !eatsPlants) continue;
        const reach = food.radius + halfAperture + mouthRadius;
        if (Math.abs(food.x - cx) > reach || Math.abs(food.y - cy) > reach) continue;
        if (distPointToSegment(food.x, food.y, x1, y1, x2, y2) > food.radius + mouthRadius) continue;
        feedback.contact = 1;
        const transfer = consume(food.energyValue, carrion ? 'Carrion' : 'Nutrient', carrion ? .85 : 1);
        if (transfer <= 0) continue;
        food.energyValue = Math.max(0, food.energyValue - transfer);
        food.radius = getNutrientRadius(food.energyValue);
        if (food.energyValue <= 1) {
          ledger.recordedLosses += food.energyValue;
          returnedEnergy += food.energyValue;
          org.foodEaten++;
          nutrients.splice(i, 1);
          if (onEvent) onEvent('eat');
        }
      }
    }

    org.mouthFeedback = oralFeedback;

    // E. REPRODUCTION (Continuous Attempt with Scaled Clutch Size & Heritable DNA Traits)
    const maturityAge = g.maturityAge || MATURITY_AGE;
    const cooldown = g.reproductionCooldown || 18.0;
    const parentSurvivalReserve = Math.max(MIN_PARENT_SURVIVAL_RESERVE_BASE, g.maxEnergyCapacity * MIN_PARENT_SURVIVAL_FRACTION);
    const eggCost = g.bodyCost + getEggReserveFunding(g);
    const availableBudget = org.energy - parentSurvivalReserve;
    const isOffCooldown = state.simTime >= (org.lastReproductionTime || 0) + cooldown;
    const isMature = org.age >= maturityAge;
    const desiredCount = g.targetClutchSize || 2;
    const affordableCount = Math.max(0, Math.floor(availableBudget / eggCost));
    const actualClutchSize = Math.min(desiredCount, affordableCount);

    org.isGravid = isMature && isOffCooldown && actualClutchSize >= 1;

    if (
      org.isGravid &&
      occupiedPopulation(state) < (settings.maxOrganisms ?? 50) &&
      eggs.length < 75
    ) {
      const clutchCount = Math.min(actualClutchSize, 75 - eggs.length,
        state.energyPool ? (settings.maxOrganisms ?? 50) - occupiedPopulation(state) : Infinity);

      if (clutchCount >= 1) {
        const rearSeg = org.segments[org.segments.length - 1];
        const clutchId = `CLUTCH-${prng.nextUint32().toString(36).substring(0, 5)}`;
        let laidAny = false;

        for (let k = 0; k < clutchCount; k++) {
          if (eggs.length >= 75) break;
          const babyGenome = mutateGenome(g, mutationSeverity, prng, settings.physicsRegime);
          babyGenome.parentIds = [org.id];
          const offspringBodyCost = babyGenome.bodyCost;
          const allocatedReserve = getEggReserveFunding(g);
          const totalEggEnergy = offspringBodyCost + allocatedReserve;

          if (org.energy >= totalEggEnergy + parentSurvivalReserve) {
            org.energy -= totalEggEnergy;
            org.offspringCount += 1;
            laidAny = true;

            const rec = state.lineage.get(org.id);
            if (rec) {
              rec.offspringCount += 1;
              markLineageChanged(state.lineage, org.id);
            }

            const angleSpread = (k - (clutchCount - 1) / 2) * 0.35;
            const layAngle = rearSeg.angle + Math.PI + angleSpread;

            const laidEgg: Egg = {
              id: `EGG-${prng.nextUint32().toString(36).substring(0, 5)}`,
              clutchId,
              parentOrgId: org.id,
              x: rearSeg.x + Math.cos(layAngle) * 25,
              y: rearSeg.y + Math.sin(layAngle) * 25,
              vx: Math.cos(layAngle) * prng.range(0.6, 1.2),
              vy: Math.sin(layAngle) * prng.range(0.6, 1.2),
              genome: babyGenome,
              fundedStructural: offspringBodyCost,
              fundedReserve: allocatedReserve,
              incubationProgress: 0,
              totalIncubationTime: babyGenome.incubationTime || prng.range(8.5, 14.0),
              pulseTimer: k * 0.4,
              colorHue: babyGenome.hue,
              readyToHatch: false,
            };
            if (state.energyPool) initializeClosedEgg(laidEgg);
            eggs.push(laidEgg);
          }
        }

        if (laidAny) {
          org.lastReproductionAge = org.age;
          org.lastReproductionTime = state.simTime;
          org.clutchesLaid += 1;
          if (onEvent) onEvent('birth');
        }
      }
    }

    org.isGravid = evaluateReproductionAffordability(
      org, state.simTime, organisms.filter(o => !o.dissolving).length, eggs.length, settings.maxOrganisms ?? 50,
      75, Boolean(state.energyPool),
    ).eligible;

    // F. Starvation & Senescence (Precise Cause Attribution)
    if (!org.dissolving) {
      if (org.age >= org.maxLifespan) {
        org.deathCause = 'Old Age';
        org.dissolving = true;
        org.dissolveAlpha = 1.0;
      } else if (org.energy <= 0) {
        org.deathCause = 'Starvation';
        org.dissolving = true;
        org.dissolveAlpha = 1.0;
      }
    }
  }

  // 6. Bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.life += dt;
    b.x += b.vx * dt * 60;
    b.y += b.vy * dt * 60;
    b.vy -= 0.05 * dt * 60;
    b.alpha = (1 - b.life / b.maxLife) * 0.6;
    if (b.life >= b.maxLife) bubbles.splice(i, 1);
  }
  if (bubbles.length > 60) {
    bubbles.splice(0, bubbles.length - 60);
  }
  if (state.energyPool) state.energyPool.reserve += returnedEnergy;
}

