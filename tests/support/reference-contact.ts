// Frozen v0.32 contact geometry oracle; preserve its allocating arithmetic.
import type {PartPhys, PartDef} from '../../simulation';
import type {RectangleContact} from '../../contacts';
/** SAT on both rectangles' face normals. The overlap centroid supplies a contact point. */
export function referenceContact(a: PartPhys, ad: PartDef, b: PartPhys, bd: PartDef): RectangleContact | null {
  const ac = Math.cos(a.angle), as = Math.sin(a.angle), bc = Math.cos(b.angle), bs = Math.sin(b.angle);
  const axes = [[ac, as], [-as, ac], [bc, bs], [-bs, bc]];
  let depth = Infinity, nx = 0, ny = 0;
  for (const [x, y] of axes) {
    const ra = Math.abs(x * ac + y * as) * ad.width / 2 + Math.abs(-x * as + y * ac) * ad.height / 2;
    const rb = Math.abs(x * bc + y * bs) * bd.width / 2 + Math.abs(-x * bs + y * bc) * bd.height / 2;
    const offset = (b.x - a.x) * x + (b.y - a.y) * y;
    const overlap = ra + rb - Math.abs(offset);
    if (overlap <= 0) return null;
    if (overlap < depth) { depth = overlap; nx = offset < 0 ? -x : x; ny = offset < 0 ? -y : y; }
  }
  let polygon = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({
    x: a.x + ac * x * ad.width / 2 - as * y * ad.height / 2,
    y: a.y + as * x * ad.width / 2 + ac * y * ad.height / 2}));
  // Clip A's polygon against B's four half-planes.
  for (const [x, y, limit] of [[bc, bs, bd.width / 2], [-bc, -bs, bd.width / 2],
    [-bs, bc, bd.height / 2], [bs, -bc, bd.height / 2]]) {
    const clipped: typeof polygon = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const dp = (p.x - b.x) * x + (p.y - b.y) * y - limit;
      const dq = (q.x - b.x) * x + (q.y - b.y) * y - limit;
      if (dp <= 0) clipped.push(p);
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        const t = dp / (dp - dq); clipped.push({x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t});
      }
    }
    polygon = clipped;
  }
  const count = polygon.length;
  return {nx, ny, depth,
    x: count ? polygon.reduce((sum, p) => sum + p.x, 0) / count : (a.x + b.x) / 2,
    y: count ? polygon.reduce((sum, p) => sum + p.y, 0) / count : (a.y + b.y) / 2};
}
