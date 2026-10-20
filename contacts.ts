import type {Organism, PartDef, PartPhys} from './simulation';

interface Body {
  org: Organism; index: number; p: PartPhys; def: PartDef;
  im: number; ii: number; c: number; s: number;
  left: number; right: number; top: number; bottom: number;
  cellLeft: number; cellRight: number; cellTop: number; cellBottom: number;
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
    const cellLeft = Math.floor(left / 128), cellRight = Math.floor(right / 128);
    const cellTop = Math.floor(top / 128), cellBottom = Math.floor(bottom / 128);
    let body = bodyPool[list.length];
    if (!body) {
      body = {org, index, p, def, im, ii, c, s, left, right, top, bottom, cellLeft, cellRight, cellTop, cellBottom};
      bodyPool.push(body);
    } else {
      body.org = org; body.index = index; body.p = p; body.def = def;
      body.im = im; body.ii = ii; body.c = c; body.s = s;
      body.left = left; body.right = right; body.top = top; body.bottom = bottom;
      body.cellLeft = cellLeft; body.cellRight = cellRight; body.cellTop = cellTop; body.cellBottom = cellBottom;
    }
    list.push(body);
  }
  bodyPool.length = list.length;
  return list;
}

type ContactCell = {stamp: number; indices: number[]};
const contactColumns = new Map<number, Map<number, ContactCell>>();
let contactStamp = 0, contactCells = 0;

/** Stable first-common-cell ownership removes the per-pass pair Set without
 * changing pair order. Buckets reuse storage; every body bound is still rebuilt.
 * Bound retained cell storage across world changes and very long runs. */
function pairs(list: Body[]): [Body, Body][] {
  contactStamp = (contactStamp + 1) >>> 0;
  if (!contactStamp || contactCells > 4096) {
    contactColumns.clear(); contactCells = 0; contactStamp = 1;
  }
  const result: [Body, Body][] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let x = a.cellLeft; x <= a.cellRight; x++) {
      let column = contactColumns.get(x);
      if (!column) {column = new Map(); contactColumns.set(x, column);}
      for (let y = a.cellTop; y <= a.cellBottom; y++) {
        let cell = column.get(y);
        if (!cell) {cell = {stamp: contactStamp, indices: []}; column.set(y, cell); contactCells++;}
        if (cell.stamp !== contactStamp) {cell.stamp = contactStamp; cell.indices.length = 0;}
        for (const j of cell.indices) {
          const b = list[j];
          if (x !== Math.max(a.cellLeft, b.cellLeft) || y !== Math.max(a.cellTop, b.cellTop)) continue;
          if (a.org === b.org && (a.def.parentIndex === b.index || b.def.parentIndex === a.index)) continue;
          if (a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom) continue;
          result.push([b, a]);
        }
        cell.indices.push(i);
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
