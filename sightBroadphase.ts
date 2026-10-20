import type {Nutrient} from './simulation';

/**
 * Ephemeral, deterministic broadphase for food vision. Every nutrient belongs
 * to exactly one fixed-size cell based on its CENTER; a ray queries all cells
 * in its segment AABB expanded by the largest nutrient radius.
 *
 * This is conservative: no potentially intersecting circle can be lost.
 * Returned indices are sorted back into their original array order, preserving
 * the production raycast's strict < closestDist tie-breaking and retinal math.
 * Do not persist this index or use it as a behavioral/sensor input.
 */
export class NutrientSightGrid {
  static readonly CELL_SIZE = 128;
  readonly nutrientCount: number;
  private readonly cells = new Map<string, number[]>();
  private readonly maxRadius: number;

  constructor(nutrients: readonly Nutrient[]) {
    this.nutrientCount = nutrients.length;
    let maxRadius = 0;
    const scale = NutrientSightGrid.CELL_SIZE;
    for (let i = 0; i < nutrients.length; i++) {
      const food = nutrients[i];
      maxRadius = Math.max(maxRadius, food.radius);
      const key = `${Math.floor(food.x / scale)},${Math.floor(food.y / scale)}`;
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = [];
        this.cells.set(key, bucket);
      }
      bucket.push(i);
    }
    this.maxRadius = maxRadius;
  }

  /** Candidate indices in the exact order used by the original all-food scan. */
  query(originX: number, originY: number, endX: number, endY: number): number[] {
    const scale = NutrientSightGrid.CELL_SIZE;
    // Tiny extra margin avoids floating-point boundary loss.
    const radius = this.maxRadius + 1e-7;
    const left = Math.floor((Math.min(originX, endX) - radius) / scale);
    const right = Math.floor((Math.max(originX, endX) + radius) / scale);
    const top = Math.floor((Math.min(originY, endY) - radius) / scale);
    const bottom = Math.floor((Math.max(originY, endY) + radius) / scale);
    const candidates: number[] = [];
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const bucket = this.cells.get(`${x},${y}`);
      if (bucket) candidates.push(...bucket);
    }
    candidates.sort((a, b) => a - b);
    return candidates;
  }
}
