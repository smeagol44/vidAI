import type {Organism, PartDef, PartPhys} from './simulation';

interface Body {
  org: Organism; index: number; p: PartPhys; def: PartDef;
  im: number; ii: number; c: number; s: number;
  left: number; right: number; top: number; bottom: number;
}
export interface RectangleContact {nx: number; ny: number; depth: number; x: number; y: number}

/** SAT on both rectangles' face normals. The overlap centroid supplies a contact point. */
export function rectangleContact(a: PartPhys, ad: PartDef, b: PartPhys, bd: PartDef): RectangleContact | null {
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

/** Inelastic, frictionless impulse. Equal/opposite linear and angular impulses; no motor work. */
export function contactImpulse(a: PartPhys, aim: number, aii: number,
  b: PartPhys, bim: number, bii: number, contact: RectangleContact): void {
  const {nx, ny, x, y} = contact;
  const ax = x - a.x, ay = y - a.y, bx = x - b.x, by = y - b.y;
  const speed = (b.vx - b.angVel * by - a.vx + a.angVel * ay) * nx
    + (b.vy + b.angVel * bx - a.vy - a.angVel * ax) * ny;
  if (speed >= 0) return;
  const ca = ax * ny - ay * nx, cb = bx * ny - by * nx;
  const impulse = -speed / (aim + bim + ca * ca * aii + cb * cb * bii);
  a.vx -= nx * impulse * aim; a.vy -= ny * impulse * aim; a.angVel -= ca * impulse * aii;
  b.vx += nx * impulse * bim; b.vy += ny * impulse * bim; b.angVel += cb * impulse * bii;
}

// The resolver consumes each pass before rebuilding the next one. Reuse
// wrappers while recalculating every moved pose/bound; never retain stale AABBs.
const bodyPool: Body[] = [];
function bodies(organisms: Organism[], density: number): Body[] {
  const list: Body[] = [];
  for (const org of organisms) for (let index = 0; index < org.segments.length; index++) {
    const p = org.segments[index];
    const def = org.genome.parts[index], mass = Math.max(.35, def.dimN * def.dimM * density);
    const c = Math.cos(p.angle), s = Math.sin(p.angle);
    const rx = (Math.abs(c) * def.width + Math.abs(s) * def.height) / 2;
    const ry = (Math.abs(s) * def.width + Math.abs(c) * def.height) / 2;
    const im = 1 / mass, ii = 12 / (mass * (def.width ** 2 + def.height ** 2));
    const left = p.x - rx, right = p.x + rx, top = p.y - ry, bottom = p.y + ry;
    let body = bodyPool[list.length];
    if (!body) {
      body = {org, index, p, def, im, ii, c, s, left, right, top, bottom};
      bodyPool.push(body);
    } else {
      body.org = org; body.index = index; body.p = p; body.def = def;
      body.im = im; body.ii = ii; body.c = c; body.s = s;
      body.left = left; body.right = right; body.top = top; body.bottom = bottom;
    }
    list.push(body);
  }
  bodyPool.length = list.length;
  return list;
}

/** Deterministic spatial broad phase; directly hinged neighbors may overlap while bending. */
function pairs(list: Body[]): [Body, Body][] {
  const grid = new Map<number, Map<number, number[]>>(), seen = new Set<number>(), result: [Body, Body][] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let x = Math.floor(a.left / 128); x <= Math.floor(a.right / 128); x++) {
      let column = grid.get(x);
      if (!column) {column = new Map(); grid.set(x, column);}
      for (let y = Math.floor(a.top / 128); y <= Math.floor(a.bottom / 128); y++) {
        let cell = column.get(y);
        if (!cell) {cell = []; column.set(y, cell);}
        for (const j of cell) {
          const id = j * list.length + i; if (seen.has(id)) continue; seen.add(id);
          const b = list[j];
          if (a.org === b.org && (a.def.parentIndex === b.index || b.def.parentIndex === a.index)) continue;
          if (a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom) continue;
          result.push([b, a]);
        }
        cell.push(i);
      }
    }
  }
  return result;
}

/** Contacts alternate with hinge projection; position repair never creates separation velocity. */
export function resolveBodyContacts(organisms: Organism[], density: number,
  projectJoints: (org: Organism, iterations: number) => void): Set<Organism> {
  const touched = new Set<Organism>();
  for (let iteration = 0; iteration < 8; iteration++) {
    let contactCount = 0;
    for (const [a, b] of pairs(bodies(organisms, density))) {
      const contact = rectangleContact(a.p, a.def, b.p, b.def); if (!contact) continue;
      contactCount++; touched.add(a.org); touched.add(b.org);
      contactImpulse(a.p, a.im, a.ii, b.p, b.im, b.ii, contact);
      // Split positional correction prevents overlap recovery from acting as propulsion.
      const correction = Math.min(3, Math.max(0, contact.depth - .02) * .6) / (a.im + b.im);
      a.p.x -= contact.nx * correction * a.im; a.p.y -= contact.ny * correction * a.im;
      b.p.x += contact.nx * correction * b.im; b.p.y += contact.ny * correction * b.im;
    }
    if (!contactCount) break;
    for (const org of touched) projectJoints(org, 4);
  }
  for (const org of touched) projectJoints(org, 12);
  return touched;
}
