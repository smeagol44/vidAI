/** Offline-only locomotion development. Never imported by the live kernel/UI.
 * Uses ordinary inherited motor alleles and the real fixed-step simulation.
 */
import {XoshiroPRNG, stepSimulation, calculateOrganismCOM, clampVal,
  getCardinalAnchor, getChildAnchorForParentDir, MAX_FRAME_MOTOR_WORK,
  type Genome, type SimulationSettings} from './simulation';
import {DEFAULT_SETTINGS, totalAccountedEnergy, validateGenome} from './persistence';
import {createInitialWorld, addExternalOrganism} from './world';

export interface SwimTrial {
  valid: boolean; rejection: string | null; seconds: number;
  dx: number; dy: number; distance: number; pathLength: number; straightness: number;
  lateSpeed: number; forward: number; spentJ: number; motorJ: number;
  lateMotorJ: number; efficiency: number; score: number;
  maxAnchorError: number; capTicks: number; energyError: number;
}
export interface SwimConditions {seconds?: number; heading?: number; viscosity?: number; seed?: number}
const DT = 1 / 60;
const settings: SimulationSettings = {...DEFAULT_SETTINGS, worldWidth: 12000, worldHeight: 12000,
  targetNutrients: 0, inflowRate: 0, mutationSeverity: 0, gravity: 0};

/** Score real progress after settling, sustained into the last third. The
 * observer's coordinates never reach a neural input or learning reward. */
export function scoreSwimTrial(t: Pick<SwimTrial, 'valid'|'distance'|'pathLength'|'lateSpeed'|'spentJ'|'lateMotorJ'>,
  measuredSeconds: number): number {
  if (![t.distance, t.pathLength, t.lateSpeed, t.spentJ, t.lateMotorJ, measuredSeconds].every(Number.isFinite)
    || t.spentJ < 0 || !t.valid || t.distance < .1 || t.lateMotorJ < 1e-6 || measuredSeconds <= 0) return 0;
  const straightness = Math.min(1, t.distance / Math.max(t.pathLength, 1e-9));
  const sustainedSpeed = Math.min(t.distance / measuredSeconds, t.lateSpeed);
  // A bounded cost penalty cannot make an idle/cheap organism win by division.
  return Math.max(0, sustainedSpeed) * straightness / (1 + t.spentJ / 1000);
}

export function evaluateSwimmer(genome: Genome, conditions: SwimConditions = {}): SwimTrial {
  const seconds = conditions.seconds ?? 6;
  if (!Number.isFinite(seconds) || seconds < 3 || seconds > 30)
    throw new Error('Swimming trials must last 3–30 simulated seconds');
  const heading = conditions.heading ?? 0, viscosity = conditions.viscosity ?? DEFAULT_SETTINGS.waterViscosity;
  if (!Number.isFinite(heading) || !Number.isFinite(viscosity) || viscosity < 0 || viscosity > 1)
    throw new Error('Invalid swimming conditions');
  const config = {...settings, waterViscosity: viscosity};
  const state = createInitialWorld(config, conditions.seed ?? 711, 'balanced', 'standard', 0);
  state.caustics = [];
  const org = addExternalOrganism(state, genome, config, 6000, 6000, heading)!;
  const initialEnergy = org.energy, ticks = Math.round(seconds / DT), settleTick = 60;
  const lateTick = Math.floor(ticks * 2 / 3);
  let before = calculateOrganismCOM(org), start = before, lateStart = before;
  let pathLength = 0, capTicks = 0, maxAnchorError = 0, lateMotorStart = 0;
  let invalid: string | null = null;
  for (let tick = 1; tick <= ticks; tick++) {
    stepSimulation(state, config, DT);
    const com = calculateOrganismCOM(org);
    if (!org.segments.every(p => Object.values(p).every(Number.isFinite))) {invalid = 'non-finite pose'; break;}
    if (!Number.isFinite(org.energy)) {invalid = 'non-finite reserves'; break;}
    if (org.dissolving || !state.organisms.includes(org) || org.energy <= 0) {invalid = 'reserve exhausted'; break;}
    if (state.eggs.length || state.nutrients.length) {invalid = 'reproduction or food in isolated trial'; break;}
    if (org.segments.some(p => p.x < 100 || p.y < 100 || p.x > 11900 || p.y > 11900)) {invalid = 'boundary influence'; break;}
    if (org.motorEnergyRate >= MAX_FRAME_MOTOR_WORK / DT - 1e-6 ||
      org.segments.some(p => Math.hypot(p.vx, p.vy) >= 399 || Math.abs(p.angVel) >= 19.99)) capTicks++;
    if (tick > settleTick) pathLength += Math.hypot(com.x - before.x, com.y - before.y);
    if (tick === settleTick) start = com;
    if (tick === lateTick) {lateStart = com; lateMotorStart = state.ledger.mechanicalWorkHeat;}
    // Observe every final tick, including the settling period.
    for (let i = 1; i < org.segments.length; i++) {
      const def = org.genome.parts[i], a = org.segments[def.parentIndex], b = org.segments[i];
      const pa = org.genome.parts[def.parentIndex];
      const u = getCardinalAnchor(def.attachmentPoint, pa.width, pa.height);
      const v = getChildAnchorForParentDir(def.attachmentPoint, def.width, def.height);
      const ex = a.x + Math.cos(a.angle) * u.x - Math.sin(a.angle) * u.y - b.x - Math.cos(b.angle) * v.x + Math.sin(b.angle) * v.y;
      const ey = a.y + Math.sin(a.angle) * u.x + Math.cos(a.angle) * u.y - b.y - Math.sin(b.angle) * v.x - Math.cos(b.angle) * v.y;
      maxAnchorError = Math.max(maxAnchorError, Math.hypot(ex, ey));
    }
    before = com;
  }
  const dxWorld = before.x - start.x, dyWorld = before.y - start.y;
  const dx = dxWorld * Math.cos(heading) + dyWorld * Math.sin(heading);
  const dy = -dxWorld * Math.sin(heading) + dyWorld * Math.cos(heading);
  const distance = Math.hypot(dx, dy), measuredSeconds = (ticks - settleTick) * DT;
  // Late progress projected along the overall route penalizes returning/circling.
  const lateSpeed = distance > 1e-9 ? ((before.x - lateStart.x) * dxWorld + (before.y - lateStart.y) * dyWorld)
    / distance / ((ticks - lateTick) * DT) : 0;
  const energyError = Math.abs(totalAccountedEnergy(state) - state.ledger.externalInflow);
  if (!invalid && (energyError > 1e-5 || maxAnchorError > .5 || capTicks))
    invalid = energyError > 1e-5 ? 'energy accounting' : maxAnchorError > .5 ? 'hinge drift' : 'solver or work cap';
  const spentJ = initialEnergy - org.energy, motorJ = state.ledger.mechanicalWorkHeat;
  const result: SwimTrial = {valid: invalid === null, rejection: invalid, seconds: ticks * DT,
    dx, dy, distance, pathLength, straightness: Math.min(1, distance / Math.max(pathLength, 1e-9)),
    lateSpeed, forward: dx, spentJ, motorJ, lateMotorJ: motorJ - lateMotorStart,
    efficiency: distance / Math.max(spentJ, 1e-9), score: 0, maxAnchorError, capTicks, energyError};
  result.score = scoreSwimTrial(result, measuredSeconds);
  return result;
}

/** Specialize existing mutable motor genes only. Preserve anatomy, organs,
 * sensory/learning traits, neural weights and lifecycle economics exactly. */
export function mutateSwimmer(parent: Genome, random: XoshiroPRNG): Genome {
  if (parent.parts.length < 2) throw new Error('A swimmer needs at least one articulated joint');
  const g = structuredClone(parent);
  const choose = random.rangeInt(0, 4);
  if (choose === 0) g.motorFrequency = clampVal(g.motorFrequency * Math.exp(random.range(-.22, .22)), .1, 5.2);
  else if (choose === 1) g.motorForce = clampVal(g.motorForce * Math.exp(random.range(-.2, .12)), .1, 5);
  else {
    const part = g.parts[random.rangeInt(1, g.parts.length - 1)];
    if (choose === 2) part.cpgPhaseOffset = (part.cpgPhaseOffset + random.range(-.75, .75) + 2 * Math.PI) % (2 * Math.PI);
    else if (choose === 3) part.cpgAmp = clampVal(part.cpgAmp * Math.exp(random.range(-.25, .25)), .1, 2.6);
    else {
      const harmonics = part.waveHarmonics ?? [0, 0, 0, 0];
      const index = random.rangeInt(0, 3);
      harmonics[index] = clampVal(harmonics[index] + random.range(-.2, .2), -1, 1);
      part.waveHarmonics = harmonics;
    }
  }
  return g;
}

export interface SearchOptions {seed?: number; generations?: number; offspring?: number; seconds?: number}
export interface SearchResult {baseline: SwimTrial; best: SwimTrial; genome: Genome; evaluations: number; rejected: number}
/** Small (1+lambda) asexual search. The unchanged parent remains eligible; no
 * score influences the live simulator's survival/reproduction rules. */
export function searchSwimmer(parent: Genome, options: SearchOptions = {}): SearchResult {
  const generations = options.generations ?? 3, offspring = options.offspring ?? 8;
  if (!Number.isInteger(generations) || generations < 1 || generations > 8 ||
    !Number.isInteger(offspring) || offspring < 1 || offspring > 16) throw new Error('Search budget exceeds 1–8 generations / 1–16 offspring');
  const random = new XoshiroPRNG(options.seed ?? 711);
  const conditions = {seconds: options.seconds ?? 6, seed: 711};
  const baseline = evaluateSwimmer(parent, conditions);
  let genome = structuredClone(parent), best = baseline, rejected = 0;
  for (let generation = 0; generation < generations; generation++) {
    const ancestor = genome;
    for (let child = 0; child < offspring; child++) {
      const candidate = mutateSwimmer(ancestor, random);
      validateGenome(candidate);
      const measured = evaluateSwimmer(candidate, conditions);
      if (!measured.valid) rejected++;
      if (measured.score > best.score) {best = measured; genome = candidate;}
    }
  }
  return {baseline, best, genome, evaluations: 1 + generations * offspring, rejected};
}

/** Acceptance uses conditions never used by training and explicit raw metrics.
 * Fast-but-wasteful, reversed, startup-only and single-condition wins fail. */
export function acceptSwimmer(baselines: SwimTrial[], candidates: SwimTrial[]): boolean {
  return baselines.length > 0 && baselines.length === candidates.length && candidates.every((trial, i) => {
    const original = baselines[i];
    const alignment = (trial.dx * original.dx + trial.dy * original.dy) / Math.max(trial.distance * original.distance, 1e-9);
    return original.valid && trial.valid && trial.distance >= original.distance * 1.05
      && trial.lateSpeed >= original.lateSpeed && trial.efficiency >= original.efficiency * 1.02
      && trial.spentJ <= original.spentJ * 1.05 && alignment >= .85;
  });
}
