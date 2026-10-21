import {mouthDimensions} from './mouthGeometry';
import * as sim from './simulation';
import {EcologyIntakeObserver} from './ecologyAudit';
import type {FoodCategory, Organism, SimulationState} from './simulation';

type Diet = 'herbivore' | 'omnivore' | 'carnivore';
export interface FoodAcquisitionRecord {
  organismId: string;
  founderId: string;
  diet: Diet;
  ticks: number;
  /** At least one eye ray intersects a physically edible object. */
  edibleRayHitTicks: number;
  /** Physically edible ray hits that reach an enabled RGB receptor. */
  edibleVisibleTicks: number;
  /** Ray hits on biologically inedible object categories. */
  wrongFoodRayTicks: number;
  /** Any actual oral contact returned by production mouth collision detection. */
  mouthContactTicks: number;
  /** Positive funded energy transfer from any physical mouth. */
  feedingTicks: number;
  /** Free edible nutrient/carrion surface within 24px of a real mouth aperture. */
  nearbyFoodTicks: number;
  /** Mouth aperture truly touching an edible food circle, geometry-only. */
  overlappingFoodTicks: number;
  nearestFreeFoodGapStartPx: number | null;
  nearestFreeFoodGapEndPx: number | null;
  bestFreeFoodGapPx: number | null;
  pathLengthPx: number;
  netDisplacementPx: number;
  initialReserveJ: number;
  finalReserveJ: number;
  absorbedJ: Record<FoodCategory, number>;
  fundedEggsLaid: number;
  energyShortfallForOneEggJ: number | null;
  maturityRemainingSeconds: number | null;
}

interface Accumulated {
  organismId: string;
  founderId: string;
  diet: Diet;
  startX: number; startY: number;
  startPath: number;
  initialReserveJ: number;
  ticks: number;
  edibleRayHitTicks: number;
  edibleVisibleTicks: number;
  wrongFoodRayTicks: number;
  mouthContactTicks: number;
  feedingTicks: number;
  nearbyFoodTicks: number;
  overlappingFoodTicks: number;
  nearestFreeFoodGapStartPx: number | null;
  nearestFreeFoodGapEndPx: number | null;
  bestFreeFoodGapPx: number | null;
}

/**
 * Computes a surface gap from the actual mouth aperture segment to its
 * biologically edible *free* food circle. This is an observation of the
 * same geometry as feeding, not a new sensory/neural signal.
 *
 * Predators also eat moving prey and eggs, which are separately counted
 * through real eyes, mouth contact and receipt counters; a missing free-food
 * gap for them is not interpreted as lack of reachable prey.
 */
export function nearestEdibleFreeFoodGap(org: Organism, state: SimulationState): number | null {
  let nearest = Infinity;
  for (const mouth of org.genome.mouths) {
    const host = Math.min(mouth.partIndex, org.segments.length - 1);
    const phys = org.segments[host], def = org.genome.parts[host];
    if (!phys || !def) continue;
    const anchor = sim.getOrganAnchor(mouth, def.width, def.height);
    const cos = Math.cos(phys.angle), sin = Math.sin(phys.angle);
    const cx = phys.x + cos * anchor.x - sin * anchor.y;
    const cy = phys.y + sin * anchor.x + cos * anchor.y;
    const normal = sim.getCardinalOutwardNormal(mouth.direction);
    const tx = cos * -normal.y - sin * normal.x;
    const ty = sin * -normal.y + cos * normal.x;
    const {radius, halfSpan: half} = mouthDimensions(mouth);
    const x1 = cx - tx * half, y1 = cy - ty * half;
    const x2 = cx + tx * half, y2 = cy + ty * half;
    for (const food of state.nutrients) {
      const carrion = food.kind === 'carrion';
      if (carrion ? mouth.mouthType === 'herbivore' : mouth.mouthType === 'carnivore') continue;
      const gap = sim.distPointToSegment(food.x, food.y, x1, y1, x2, y2) - food.radius - radius;
      if (gap < nearest) nearest = gap;
    }
  }
  return Number.isFinite(nearest) ? nearest : null;
}

/** Read-only, opt-in ecosystem diagnostics. Never part of stepSimulation. */
export class FoodAcquisitionObserver {
  private readonly records = new Map<string, Accumulated>();
  private readonly intake = new EcologyIntakeObserver();
  private previousTime = -Infinity;

  constructor(state: SimulationState) {
    for (const org of state.organisms) {
      const center = sim.calculateOrganismCOM(org);
      const gap = nearestEdibleFreeFoodGap(org, state);
      this.records.set(org.id, {
        organismId: org.id, founderId: org.genome.id,
        diet: sim.getDietClassification(org.genome.mouths).category.toLowerCase() as Diet,
        startX: center.x, startY: center.y, startPath: org.distanceTraveled,
        initialReserveJ: org.energy, ticks: 0, edibleRayHitTicks: 0,
        edibleVisibleTicks: 0, wrongFoodRayTicks: 0,
        mouthContactTicks: 0, feedingTicks: 0,
        nearbyFoodTicks: 0, overlappingFoodTicks: 0,
        nearestFreeFoodGapStartPx: gap,
        nearestFreeFoodGapEndPx: gap, bestFreeFoodGapPx: gap,
      });
    }
  }

  sample(state: SimulationState): void {
    if (state.simTime <= this.previousTime) throw new Error('FoodAcquisitionObserver must be sampled once per forward tick');
    this.previousTime = state.simTime;
    this.intake.sample(state);
    for (const org of state.organisms) {
      const rec = this.records.get(org.id);
      if (!rec || org.dissolving) continue;
      rec.ticks++;
      const canEat = (kind: string) => {
        if (kind === 'nutrient') return rec.diet !== 'carnivore';
        if (kind === 'carrion' || kind === 'creature' || kind === 'egg') return rec.diet !== 'herbivore';
        return false;
      };
      const rays = org.rayHits;
      if (rays.some(ray => ray.hit && canEat(ray.objectType))) rec.edibleRayHitTicks++;
      if (rays.some(ray => ray.hit && canEat(ray.objectType) &&
        ray.r + ray.g + ray.b > 1e-12)) rec.edibleVisibleTicks++;
      if (rays.some(ray => ray.hit && (ray.objectType === 'nutrient'
        || ray.objectType === 'carrion' || ray.objectType === 'creature'
        || ray.objectType === 'egg') && !canEat(ray.objectType))) rec.wrongFoodRayTicks++;
      const oral = Object.values(org.mouthFeedback ?? {});
      if (oral.some(m => m.contact > 0)) rec.mouthContactTicks++;
      if (oral.some(m => m.intake > 0)) rec.feedingTicks++;

      const gap = nearestEdibleFreeFoodGap(org, state);
      rec.nearestFreeFoodGapEndPx = gap;
      if (gap !== null) {
        rec.bestFreeFoodGapPx = rec.bestFreeFoodGapPx === null
          ? gap : Math.min(rec.bestFreeFoodGapPx, gap);
        if (gap <= 24) rec.nearbyFoodTicks++;
        if (gap <= 0) rec.overlappingFoodTicks++;
      }
    }
  }

  results(state: SimulationState): FoodAcquisitionRecord[] {
    const tally = this.intake.perOrganismTotals();
    return [...this.records.values()].map(rec => {
      const org = state.organisms.find(o => o.id === rec.organismId);
      const center = org ? sim.calculateOrganismCOM(org) : null;
      const recLineage = state.lineage.get(rec.organismId);
      const required = org && !org.dissolving
        ? sim.evaluateReproductionAffordability(org, state.simTime,
          state.organisms.filter(o => !o.dissolving).length, state.eggs.length)
        : null;
      return {
        organismId: rec.organismId, founderId: rec.founderId, diet: rec.diet,
        ticks: rec.ticks,
        edibleRayHitTicks: rec.edibleRayHitTicks,
        edibleVisibleTicks: rec.edibleVisibleTicks,
        wrongFoodRayTicks: rec.wrongFoodRayTicks,
        mouthContactTicks: rec.mouthContactTicks, feedingTicks: rec.feedingTicks,
        nearbyFoodTicks: rec.nearbyFoodTicks, overlappingFoodTicks: rec.overlappingFoodTicks,
        nearestFreeFoodGapStartPx: rec.nearestFreeFoodGapStartPx,
        nearestFreeFoodGapEndPx: rec.nearestFreeFoodGapEndPx,
        bestFreeFoodGapPx: rec.bestFreeFoodGapPx,
        pathLengthPx: org ? org.distanceTraveled - rec.startPath : 0,
        netDisplacementPx: center ? Math.hypot(center.x - rec.startX, center.y - rec.startY) : 0,
        initialReserveJ: rec.initialReserveJ,
        finalReserveJ: org?.energy ?? 0,
        absorbedJ: tally[rec.organismId] ??
          {Nutrient: 0, Carrion: 0, Prey: 0, Egg: 0},
        fundedEggsLaid: recLineage?.offspringCount ?? 0,
        energyShortfallForOneEggJ: required ? Math.max(0, required.requiredForOneEgg - org!.energy) : null,
        maturityRemainingSeconds: org && !org.dissolving
          ? Math.max(0, org.genome.maturityAge - org.age) : null,
      };
    });
  }
}
