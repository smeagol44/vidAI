import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MIN_WINDOW_HEIGHT, sideWindowLayout, glassTubeRuns, drawGlassTubes, GLASS_TUBE_LENGTH} from '../sideWindows';

const cases = [[100, 1], [299, 1], [300, 1], [450, 1], [599, 1], [600, 2],
  [700, 2], [800, 2], [900, 3], [1200, 4], [1500, 5], [1600, 5],
  [1799, 5], [1800, 6], [2100, 7], [3000, 10]];

function adjacent(value: number, direction: -1 | 1) {
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction));
  return view.getFloat64(0);
}

test('fixed 300-world-unit reference covers every specified height, including below the UI minimum', () => {
  assert.equal(MIN_WINDOW_HEIGHT, 300);
  for (const [height, expected] of cases) {
    const {count, sectionHeight} = sideWindowLayout(height);
    assert.equal(count, expected, String(height)); assert.equal(sectionHeight, height / expected);
    assert.ok(count >= 1);
    assert.ok(height < 300 ? sectionHeight === height : sectionHeight >= 300);
  }
  assert.equal(sideWindowLayout(1799).sectionHeight, 359.8);
});

test('exact and immediately adjacent floating-point thresholds obey floor in both directions', () => {
  for (const threshold of [300, 600, 900, 1200, 1800, 2100, 3000, 3000000]) {
    const count = threshold / 300;
    assert.equal(sideWindowLayout(adjacent(threshold, -1)).count, Math.max(1, count - 1));
    assert.equal(sideWindowLayout(threshold).count, count);
    assert.equal(sideWindowLayout(adjacent(threshold, 1)).count, count);
  }
});

test('growth and shrinkage keep uniform logical sections without default-height dependence or a count cap', () => {
  for (const height of [1500, 1799, 1800, 600, 599, 100, 3000, 900, 299, 1500]) {
    const {count, sectionHeight} = sideWindowLayout(height);
    assert.equal(count, Math.max(1, Math.floor(height / 300)));
    assert.equal(sectionHeight * count, height);
  }
  assert.deepEqual([1500, 1800, 2100].map(h => sideWindowLayout(h).count), [5, 6, 7]);
  assert.equal(sideWindowLayout(3000000).count, 10000, 'no artificial logical window cap');
});

test('tube runs merge arbitrary consecutive windows and omit gaps and removed indices', () => {
  assert.equal(GLASS_TUBE_LENGTH, 300);
  assert.deepEqual(glassTubeRuns(1500, []), []);
  assert.deepEqual(glassTubeRuns(1500, [4, 1, 0, 1, -1, 9, 1.5]), [
    {first: 0, last: 1, top: 900, bottom: 1500}, {first: 4, last: 4, top: 0, bottom: 300}]);
  assert.deepEqual(glassTubeRuns(1500, [0, 1, 2, 3, 4]), [{first: 0, last: 4, top: 0, bottom: 1500}]);
  assert.deepEqual(glassTubeRuns(600, [0, 1, 4]), [{first: 0, last: 1, top: 0, bottom: 600}]);
  assert.deepEqual(glassTubeRuns(299, [0]), [{first: 0, last: 0, top: 0, bottom: 299}]);
  assert.deepEqual(glassTubeRuns(700, [0, 1]), [{first: 0, last: 1, top: 0, bottom: 700}]);
});

test('actual tube painter leaves water untouched and draws only symmetric uncapped glass edges', () => {
  const lines: number[][] = [], fills: number[][] = [], gradients: number[][] = [];
  const stops: Array<[number, string]> = []; let origin = [0, 0], depth = 0;
  const ctx = {save() {depth++;}, restore() {depth--;}, beginPath() {}, stroke() {},
    moveTo(x: number, y: number) {origin = [x, y];}, lineTo(x: number, y: number) {lines.push([...origin, x, y]);},
    fillRect(...coords: number[]) {fills.push(coords);}, createLinearGradient(...coords: number[]) {
      gradients.push(coords); return {addColorStop(at: number, color: string) {stops.push([at, color]);}};
    }} as unknown as CanvasRenderingContext2D;
  const run = glassTubeRuns(1600, [0, 1, 3]);
  drawGlassTubes(ctx, 1800, .35, {L: run, R: run});
  assert.equal(depth, 0); assert.equal(lines.length, 8); assert.equal(fills.length, 0);
  for (const [x, y, tip, endY] of lines) {
    assert.equal(y, endY, 'no vertical wall or tip cap');
    assert.equal(Math.abs(x - tip), 300); assert.ok(x === 0 || x === 1800);
    assert.ok(y === 1600 || y === 960 || y === 640 || y === 320, 'no internal crossbar at adjacent section boundary');
  }
  assert.deepEqual(gradients[0], [0, 0, -300, 0]); assert.deepEqual(gradients[1], [1800, 0, 2100, 0]);
  assert.ok(stops.some(([at, color]) => at === 1 && color.endsWith(', 0.02)')), 'glass remains softly diffused');
});
