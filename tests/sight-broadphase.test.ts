import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {NutrientSightGrid} from '../sightBroadphase';
import {createInitialWorld} from '../world';
import {DEFAULT_SETTINGS, totalAccountedEnergy, createSnapshot, restoreSnapshot} from '../persistence';

function nutrient(id: string, x: number, y: number, radius: number): sim.Nutrient {
  return {id, x, y, vx: 0, vy: 0, energyValue: 3000,
    kind: 'nutrient', radius, bottomTimer: 0, pulseTimer: 0};
}

test('spatial food ray candidates preserve all actual intersections in original stable index order', () => {
  const random = new sim.XoshiroPRNG(107);
  const foods: sim.Nutrient[] = Array.from({length: 380}, (_, i) =>
    nutrient(`food-${i}`, random.range(0, 2400), random.range(0, 1500), random.range(8, 38)));
  foods.push(nutrient('large-carrion', 1199.99, 750, 133));
  const index = new NutrientSightGrid(foods);
  let candidateCount = 0;
  for (let i = 0; i < 240; i++) {
    const ox = random.range(-50, 2450), oy = random.range(-50, 1550);
    const angle = random.range(-Math.PI, Math.PI), len = random.range(100, 650);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const candidates = index.query(ox, oy, ox + dx * len, oy + dy * len);
    candidateCount += candidates.length;
    assert.deepEqual(candidates, [...new Set(candidates)].sort((a,b) => a-b));
    const scan = (ids: readonly number[]) => {
      let closest = len, found = -1;
      for (const n of ids) {
        const food = foods[n];
        if (Math.abs(food.x - ox) > closest + food.radius
          || Math.abs(food.y - oy) > closest + food.radius) continue;
        const hit = sim.rayCircleIntersection(ox, oy, dx, dy, closest, food.x, food.y, food.radius);
        if (hit.hit && hit.dist < closest) {closest = hit.dist; found = n;}
      }
      return {found, closest};
    };
    assert.deepEqual(scan(candidates), scan(foods.map((_, n) => n)), `ray ${i}`);
  }
  assert.ok(candidateCount < 240 * foods.length * .5,
    'broadphase should materially reduce broad scan candidates');
});

test('broadphase includes edge-touching, overlapping and oversized food, preserving ties by original index', () => {
  const foods = [
    nutrient('a', 150, 128, 15), nutrient('b', 150, 128, 15),
    nutrient('c', 500, 400, 260), nutrient('d', 4000, 4000, 8),
    nutrient('e', -10, 10, 13),
  ];
  const grid = new NutrientSightGrid(foods);
  for (const [ox, oy, ex, ey] of [[0, 128, 300, 128], [0, 140, 500, 140],
    [230, 230, 600, 230], [-40, 0, 40, 40]] as const) {
    const len = Math.hypot(ex-ox, ey-oy), dx = (ex-ox)/len, dy = (ey-oy)/len;
    const hits = foods.map((f,i) => sim.rayCircleIntersection(ox,oy,dx,dy,len,f.x,f.y,f.radius).hit ? i : -1)
      .filter(i => i >= 0);
    const candidates = grid.query(ox,oy,ex,ey);
    assert.ok(hits.every(i => candidates.includes(i)), JSON.stringify({hits,candidates}));
  }
  assert.deepEqual(grid.query(0, 128, 300, 128).filter(i => i <= 1), [0,1]);
});

test('20 articulated creatures with 200 nutrients and 180 carrion simulate off-camera with exact energy ledger', () => {
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 200, inflowRate: 0,
    maxOrganisms: 30, mutationSeverity: 0};
  const s = createInitialWorld(settings, 82, 'balanced', 'standard', 20);
  assert.equal(s.nutrients.length, 200);
  for (let i = 0; i < 180; i++) {
    const x = s.prng.range(40, settings.worldWidth - 40);
    const y = s.prng.range(40, settings.worldHeight - 40);
    s.nutrients.push({...nutrient(`carrion-${i}`, x, y, sim.getNutrientRadius(3000)),
      kind: 'carrion', decayTimeRemaining: sim.CARRION_DECAY_SECONDS});
    s.ledger.externalInflow += 3000;
  }
  assert.equal(s.nutrients.length, 380);
  for (let step = 0; step < 8; step++) {
    sim.stepSimulation(s, settings, 1/60);
    assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-4);
  }
  assert.ok(s.organisms.every(o => o.segments.every(p =>
    Object.values(p).every(Number.isFinite))));
  const snap = createSnapshot(s, settings);
  const clone = restoreSnapshot(snap);
  assert.deepEqual(createSnapshot(clone.state, clone.settings), snap);
  sim.stepSimulation(s, settings, 1/60);
  sim.stepSimulation(clone.state, clone.settings, 1/60);
  assert.deepEqual(createSnapshot(clone.state, clone.settings), createSnapshot(s, settings),
    'sight acceleration must not make continuations depend on stale spatial caches');
});
