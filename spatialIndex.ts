/** Transient broadphase only: candidates are unique and sorted by source-array
 * order. All exact geometry, visibility and energy decisions stay in the kernel.
 * Objects occupy every cell touched by their AABB, including oversized circles. */
export interface SpatialBounds {left: number; right: number; top: number; bottom: number}
const CELL = 128, EPSILON = 1e-7;
export class OrderedSpatialIndex {
  private readonly rows = new Map<number, Map<number, number[]>>();
  private readonly visited: Uint32Array;
  private stamp = 0;
  constructor(bounds: readonly SpatialBounds[]) {
    this.visited = new Uint32Array(bounds.length);
    for (let i = 0; i < bounds.length; i++) {
      const b = bounds[i];
      for (let y = Math.floor((b.top - EPSILON) / CELL); y <= Math.floor((b.bottom + EPSILON) / CELL); y++) {
        let row = this.rows.get(y);
        if (!row) {row = new Map(); this.rows.set(y, row);}
        for (let x = Math.floor((b.left - EPSILON) / CELL); x <= Math.floor((b.right + EPSILON) / CELL); x++) {
          let bucket = row.get(x);
          if (!bucket) {bucket = []; row.set(x, bucket);}
          bucket.push(i);
        }
      }
    }
  }
  private begin(): number {
    this.stamp = (this.stamp + 1) >>> 0;
    if (!this.stamp) {this.visited.fill(0); this.stamp = 1;}
    return this.stamp;
  }
  private collect(row: Map<number, number[]>, left: number, right: number, stamp: number, result: number[]): void {
    for (let x = left; x <= right; x++) {
      const bucket = row.get(x);
      if (!bucket) continue;
      for (const i of bucket) if (this.visited[i] !== stamp) {
        this.visited[i] = stamp; result.push(i);
      }
    }
  }
  /** Traverse only the ray's corridor through each horizontal cell slab.
   * Inclusive epsilon guards horizontal/grid-boundary/corner tangencies.
   * No accumulated DDA step error, and zero-length/vertical rays are valid. */
  query(x0: number, y0: number, x1: number, y1: number): number[] {
    const result: number[] = [], stamp = this.begin(), dx = x1 - x0, dy = y1 - y0;
    const top = Math.floor((Math.min(y0, y1) - EPSILON) / CELL);
    const bottom = Math.floor((Math.max(y0, y1) + EPSILON) / CELL);
    for (let y = top; y <= bottom; y++) {
      const row = this.rows.get(y);
      if (!row) continue;
      let start = 0, end = 1;
      if (dy !== 0) {
        const a = (y * CELL - EPSILON - y0) / dy;
        const b = ((y + 1) * CELL + EPSILON - y0) / dy;
        start = Math.max(0, Math.min(a, b)); end = Math.min(1, Math.max(a, b));
        if (start > end) continue;
      }
      const a = x0 + dx * start, b = x0 + dx * end;
      this.collect(row, Math.floor((Math.min(a, b) - EPSILON) / CELL),
        Math.floor((Math.max(a, b) + EPSILON) / CELL), stamp, result);
    }
    return result.sort((a,b) => a-b);
  }
  queryBounds(left: number, top: number, right: number, bottom: number): number[] {
    const result: number[] = [], stamp = this.begin();
    for (let y = Math.floor((top - EPSILON) / CELL); y <= Math.floor((bottom + EPSILON) / CELL); y++) {
      const row = this.rows.get(y);
      if (row) this.collect(row, Math.floor((left - EPSILON) / CELL),
        Math.floor((right + EPSILON) / CELL), stamp, result);
    }
    return result.sort((a,b) => a-b);
  }
}
