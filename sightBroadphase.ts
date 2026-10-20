import type {Nutrient} from './simulation';
import {OrderedSpatialIndex} from './spatialIndex';

/** Food occupies its full physical bounds. Ray queries follow only intersected
 * cell slabs; candidate order matches the original food array exactly. */
export class NutrientSightGrid extends OrderedSpatialIndex {
  static readonly CELL_SIZE = 128;
  readonly nutrientCount: number;
  constructor(nutrients: readonly Nutrient[]) {
    super(nutrients.map(n => ({left: n.x - n.radius, right: n.x + n.radius,
      top: n.y - n.radius, bottom: n.y + n.radius})));
    this.nutrientCount = nutrients.length;
  }
}
