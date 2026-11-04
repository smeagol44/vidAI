import type {Organism, SimulationSettings, SimulationState} from './simulation';

/** Physical topology is world state; display names and pending invitations are not. */
export type SelfTubes = {version: 1; connected: boolean; accepted: number[]};
export const TUBE_DEPTH = 300, TUBE_ARRIVAL = 200;
export type TubeRun = {top: number; bottom: number};
export type TubeGeometry = {width: number; height: number; runs: TubeRun[]};
const cache = new WeakMap<SelfTubes, TubeGeometry>();
export function validateSelfTubes(value: unknown): SelfTubes {
  const t = value as SelfTubes;
  if (!t || t.version !== 1 || typeof t.connected !== 'boolean' || !Array.isArray(t.accepted)
    || t.accepted.length > 10000 || t.accepted.some((n, i) => !Number.isSafeInteger(n) || n < 0 || (i > 0 && n <= t.accepted[i - 1]))
    || Object.keys(t).some(k => !['version', 'connected', 'accepted'].includes(k))) throw new Error('Invalid self-tube topology');
  return {version: 1, connected: t.connected, accepted: [...t.accepted]};
}
export function tubeGeometry(settings: Pick<SimulationSettings, 'worldWidth' | 'worldHeight'>, topology?: SelfTubes): TubeGeometry | undefined {
  if (!topology?.connected) return;
  const {worldWidth: width, worldHeight: height} = settings, previous = cache.get(topology);
  if (previous?.width === width && previous.height === height) return previous.runs.length ? previous : undefined;
  const count = Math.max(1, Math.floor(height / 300)), size = height / count, runs: TubeRun[] = [];
  let last = -2;
  for (const index of topology.accepted) {
    if (index >= count) break;
    if (index === last + 1) runs[runs.length - 1].top = height - (index + 1) * size;
    else runs.push({top: height - (index + 1) * size, bottom: height - index * size});
    last = index;
  }
  const result = {width, height, runs}; cache.set(topology, result); return runs.length ? result : undefined;
}
export function inTubeWater(g: TubeGeometry, x: number, y: number): boolean {
  if (y < 0 || y > g.height) return false;
  return x >= 0 && x <= g.width || g.runs.some(r => y >= r.top && y <= r.bottom);
}
export function tubeContainsBox(g: TubeGeometry, box: {left: number; right: number; top: number; bottom: number}, margin = 0): boolean {
  if (box.top < margin || box.bottom > g.height - margin || box.left < -300 + margin || box.right > g.width + 300 - margin) return false;
  return (box.left >= margin || g.runs.some(r => box.top >= r.top + margin && box.bottom <= r.bottom - margin))
    && (box.right <= g.width - margin || g.runs.some(r => box.top >= r.top + margin && box.bottom <= r.bottom - margin));
}
/** Outside union points receive the same spring/normal damping as the old walls.
 * Floors/ceilings continue through the handoff plane; there is no distal wall. */
export function tubeWallContact(g: TubeGeometry, x: number, y: number): {dx: number; dy: number; nx: number; ny: number} | undefined {
  if (inTubeWater(g, x, y)) return;
  let best = Infinity, dx = 0, dy = 0;
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const length = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length));
    const px = ax + t * (bx - ax) - x, py = ay + t * (by - ay) - y, d = px * px + py * py;
    if (d < best) {best = d; dx = px; dy = py;}
  };
  line(0, 0, g.width, 0); line(0, g.height, g.width, g.height);
  const sorted = [...g.runs].sort((a, b) => a.top - b.top);
  let previous = 0;
  for (const r of sorted) {
    if (r.top > previous) {line(0, previous, 0, r.top); line(g.width, previous, g.width, r.top);}
    for (const wall of [0, g.width]) {
      const end = wall === 0 ? Math.min(-300, x - 1) : Math.max(g.width + 300, x + 1);
      line(wall, r.top, end, r.top); line(wall, r.bottom, end, r.bottom);
    }
    previous = r.bottom;
  }
  if (previous < g.height) {line(0, previous, 0, g.height); line(g.width, previous, g.width, g.height);}
  const distance = Math.sqrt(best);
  return distance > 0 ? {dx, dy, nx: dx / distance, ny: dy / distance} : undefined;
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export function waterRects(g: TubeGeometry, margin = 35) {
  return [{left: margin, right: g.width - margin, top: margin, bottom: g.height - margin},
    ...g.runs.flatMap(r => [{left: -300, right: margin, top: r.top + margin, bottom: r.bottom - margin},
      {left: g.width - margin, right: g.width + 300, top: r.top + margin, bottom: r.bottom - margin}])];
}
export function projectWaterPoint(g: TubeGeometry, x: number, y: number, margin = 35) {
  let best = Infinity, result = {x, y};
  for (const r of waterRects(g, margin)) {
    const px = clamp(x, r.left, r.right), py = clamp(y, r.top, r.bottom), d = (px - x) ** 2 + (py - y) ** 2;
    if (d < best) {best = d; result = {x: px, y: py};}
  }
  return result;
}
export function sampleTubeWater(g: TubeGeometry, random: () => number) {
  const rects = waterRects(g, 40), areas = rects.map(r => (r.right - r.left) * (r.bottom - r.top));
  let choice = random() * areas.reduce((a, b) => a + b, 0), index = 0;
  while (index < areas.length - 1 && choice >= areas[index]) choice -= areas[index++];
  const r = rects[index]; return {x: r.left + random() * (r.right - r.left), y: r.top + random() * (r.bottom - r.top)};
}
export function tubeFade(g: TubeGeometry | undefined, x: number, y: number): number {
  if (!g || !inTubeWater(g, x, y)) return 1;
  const d = x < 0 ? -x : x > g.width ? x - g.width : 0;
  return Math.max(0, 1 - d / 300) ** 3;
}
export function translateLiveOrganism(org: Organism, dx: number, dy = 0): void {
  for (const p of org.segments) {p.x += dx; p.y += dy;}
  for (const p of org.traceHistory ?? []) {p.x += dx; p.y += dy;}
  for (const p of org.rayHits) {p.pointX += dx; p.pointY += dy;}
}
/** One full record, one replacement, no spawn API, ID allocation or birth event. */
export function transferSelfOrganisms(state: SimulationState, settings: SimulationSettings, previous: Map<string, number>): number {
  const g = tubeGeometry(settings, state.selfTubes); if (!g) return 0;
  let moved = 0;
  for (let i = 0; i < state.organisms.length; i++) {
    const source = state.organisms[i], root = source.segments[0], before = previous.get(source.id);
    if (source.dissolving || before === undefined || !g.runs.some(r => root.y > r.top && root.y < r.bottom)) continue;
    // Soft roof/floor contacts can briefly move the reference outside the open
    // y interval at the crossing tick. Finish a delayed outward handoff once it
    // is back in channel water; arrival at 200 still enforces the 100-unit rearm.
    const left = root.x <= -300 && root.x < before;
    const right = root.x >= g.width + 300 && root.x > before;
    if (!left && !right) continue;
    const record = structuredClone(source); record.genome = source.genome;
    translateLiveOrganism(record, (left ? g.width + TUBE_ARRIVAL : -TUBE_ARRIVAL) - root.x);
    state.organisms[i] = record; moved++;
  }
  return moved;
}
export function moveTubeParticle(p: {x: number; y: number; vx: number; vy: number}, g: TubeGeometry): void {
  if (g.runs.some(r => p.y > r.top && p.y < r.bottom)) {
    if (p.x <= -300) p.x = g.width + 200;
    else if (p.x >= g.width + 300) p.x = -200;
  }
  const next = projectWaterPoint(g, p.x, p.y);
  if (next.x !== p.x) p.vx = 0; if (next.y !== p.y) p.vy = 0;
  p.x = next.x; p.y = next.y;
}
/** Explicit geometry edits return contents intact, rather than sealing them outside. */
export function setSelfTubes(state: SimulationState, settings: SimulationSettings, value: unknown): void {
  const topology = validateSelfTubes(value), g = tubeGeometry(settings, topology);
  for (const org of state.organisms) {
    const root = org.segments[0];
    if (root.x >= 0 && root.x <= settings.worldWidth || g && inTubeWater(g, root.x, root.y)) continue;
    let left = Infinity, right = -Infinity;
    for (let i = 0; i < org.segments.length; i++) {
      const p = org.segments[i], def = org.genome.parts[i];
      const half = (Math.abs(Math.cos(p.angle)) * def.width + Math.abs(Math.sin(p.angle)) * def.height) / 2;
      left = Math.min(left, p.x - half); right = Math.max(right, p.x + half);
    }
    translateLiveOrganism(org, left < 5 ? 5 - left : right > settings.worldWidth - 5 ? settings.worldWidth - 5 - right : 0);
  }
  for (const p of [...state.eggs, ...state.nutrients]) {
    if (!g || !inTubeWater(g, p.x, p.y)) p.x = clamp(p.x, 35, settings.worldWidth - 35);
  }
  state.selfTubes = topology;
}
