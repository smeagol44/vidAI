import type {PartDef, PartPhys, SensoryMouth} from './simulation';

/** Shared display/kernel dimensions. No changes to inherited intake width. */
export function mouthDimensions(mouth: Pick<SensoryMouth, 'mouthType' | 'intakeWidth'>) {
  const radius = mouth.mouthType === 'carnivore' ? 4.5 : mouth.mouthType === 'omnivore' ? 4 : 3.5;
  return {radius, halfSpan: Math.max(radius, mouth.intakeWidth * .5)};
}

function pointSegmentDistanceSquared(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}

/** Exact segment capsule against the actual rotated rectangle, including
 * endpoint grazing, containment, zero-length spans and parallel edges. */
export function capsuleContactsPart(x1: number, y1: number, x2: number, y2: number,
  radius: number, part: PartPhys, def: Pick<PartDef, 'width' | 'height'>): boolean {
  const c = Math.cos(part.angle), s = Math.sin(part.angle);
  const ax = c * (x1 - part.x) + s * (y1 - part.y);
  const ay = -s * (x1 - part.x) + c * (y1 - part.y);
  const bx = c * (x2 - part.x) + s * (y2 - part.y);
  const by = -s * (x2 - part.x) + c * (y2 - part.y);
  const w = def.width / 2, h = def.height / 2, r2 = radius * radius;
  const endpointDistance = (x: number, y: number) => Math.max(0, Math.abs(x) - w) ** 2 + Math.max(0, Math.abs(y) - h) ** 2;
  if (Math.min(endpointDistance(ax, ay), endpointDistance(bx, by)) <= r2) return true;
  // Segment/box slab intersection handles a crossing whose endpoints are far away.
  let low = 0, high = 1;
  for (const [origin, delta, extent] of [[ax, bx - ax, w], [ay, by - ay, h]]) {
    if (delta === 0) {if (Math.abs(origin) > extent) {high = -1; break;}}
    else {
      const a = (-extent - origin) / delta, b = (extent - origin) / delta;
      low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
      if (low > high) break;
    }
  }
  if (low <= high) return true;
  // If disjoint, the closest pair includes a segment endpoint or a box corner.
  return pointSegmentDistanceSquared(-w, -h, ax, ay, bx, by) <= r2
    || pointSegmentDistanceSquared(w, -h, ax, ay, bx, by) <= r2
    || pointSegmentDistanceSquared(w, h, ax, ay, bx, by) <= r2
    || pointSegmentDistanceSquared(-w, h, ax, ay, bx, by) <= r2;
}
