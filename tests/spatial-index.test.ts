import assert from 'node:assert/strict';
import {test} from 'node:test';
import {OrderedSpatialIndex, type SpatialBounds} from '../spatialIndex';
import * as sim from '../simulation';
import {createInitialWorld} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot} from '../persistence';

test('ray corridor conservatively retains exact rectangle hits and stable ties', () => {
  const random = new sim.XoshiroPRNG(715);
  const objects = Array.from({length: 240}, () => {
    const phys = {x: random.range(-300, 3000), y: random.range(-200, 2000), angle: random.range(-Math.PI, Math.PI),
      vx: 0, vy: 0, angVel: 0};
    const def = {width: random.range(1, 300), height: random.range(1, 300)} as sim.PartDef;
    const corners = sim.getPartCornerVertices(phys, def);
    return {corners, bounds: {left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
      top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y))}};
  });
  const index = new OrderedSpatialIndex(objects.map(o => o.bounds));
  for (let ray = 0; ray < 250; ray++) {
    const x0 = random.range(-400, 3200), y0 = random.range(-400, 2200);
    const x1 = random.range(-400, 3200), y1 = random.range(-400, 2200);
    const candidates = index.query(x0,y0,x1,y1);
    assert.deepEqual(candidates, [...new Set(candidates)].sort((a,b)=>a-b));
    for (let i = 0; i < objects.length; i++) {
      const corners = objects[i].corners;
      if (corners.some((p,c) => sim.lineIntersection(x0,y0,x1,y1,p.x,p.y,corners[(c+1)%4].x,corners[(c+1)%4].y).hit))
        assert.ok(candidates.includes(i), 'A real rectangle edge hit must survive broadphase');
    }
    assert.deepEqual(index.query(x1,y1,x0,y0), candidates, 'Ray reversal preserves the conservative corridor');
  }
});

test('boundary, point, diagonal and oversized queries include all touched cells without duplicates', () => {
  const boxes: SpatialBounds[] = [
    {left: 128, right: 128, top: 128, bottom: 128},
    {left: -512, right: 512, top: -512, bottom: 512},
    {left: 256, right: 258, top: 0, bottom: 128},
    {left: 2000, right: 2010, top: 0, bottom: 10},
  ];
  const index = new OrderedSpatialIndex(boxes);
  for (const ray of [[0,128,512,128],[128,-512,128,512],[128,128,128,128],[-128,-128,128,128]]) {
    const found = index.query(...ray as [number,number,number,number]);
    assert.ok(found.includes(0)); assert.ok(found.includes(1));
    assert.equal(new Set(found).size, found.length);
    assert.ok(!found.includes(3));
  }
  assert.ok(index.queryBounds(128,128,128,128).includes(0));
  assert.deepEqual(index.queryBounds(-600,-600,2100,600), [0,1,2,3]);
  // A long diagonal should not inspect objects merely inside its surrounding rectangle.
  const grid = new OrderedSpatialIndex([
    {left: 500, right: 510, top: 500, bottom: 510},
    {left: 0, right: 10, top: 900, bottom: 910},
  ]);
  assert.deepEqual(grid.query(0,0,1000,1000), [0]);
});

test('new-world defaults do not replace explicit or historically omitted imported settings', () => {
  assert.equal(DEFAULT_SETTINGS.maxOrganisms, 30); assert.equal(DEFAULT_SETTINGS.targetNutrients, 275);
  const settings = {...DEFAULT_SETTINGS, maxOrganisms: 100, targetNutrients: 400};
  const state = createInitialWorld({...settings, targetNutrients: 0}, 7, 'balanced', 'standard', 0);
  const snapshot = createSnapshot(state, settings);
  assert.deepEqual(restoreSnapshot(snapshot).settings, settings);
  const partial = structuredClone(snapshot);
  delete (partial.settings as Partial<sim.SimulationSettings>).maxOrganisms;
  delete (partial.settings as Partial<sim.SimulationSettings>).targetNutrients;
  assert.equal(restoreSnapshot(partial).settings.maxOrganisms, 100);
  assert.equal(restoreSnapshot(partial).settings.targetNutrients, 400);
});
