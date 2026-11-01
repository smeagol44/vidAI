import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createSnapshot} from '../persistence';
import {eggReserveFixture} from '../tests/support/egg-reserve';

test.use({viewport: {width: 1280, height: 850}});
test.setTimeout(60000);
for (const fallback of [false, true]) test(`egg reserve sectors, rings, selection and exact paused/5x exports (${fallback ? 'fallback' : 'Worker'})`, async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const workers: string[] = []; page.on('worker', w => workers.push(w.url()));
  await page.addInitScript(() => {
    type Arc = {x: number; y: number; radius: number; start: number; end: number; ccw: boolean; scale: number};
    const capture = {pink: [] as Arc[], rings: [] as Arc[], selected: [] as Arc[]};
    Object.assign(window, {eggReserveCapture: capture});
    const arcs = new WeakMap<CanvasRenderingContext2D, Arc>();
    const originalArc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function(x, y, radius, start, end, ccw = false) {
      const matrix = this.getTransform(), point = matrix.transformPoint(new DOMPoint(x, y));
      arcs.set(this, {x: point.x, y: point.y, radius, start, end, ccw, scale: Math.hypot(matrix.a, matrix.b)});
      return originalArc.call(this, x, y, radius, start, end, ccw);
    };
    const fill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function(this: CanvasRenderingContext2D, ...args: Parameters<typeof fill>) {
      if (this.fillStyle === '#f4a7c1' && arcs.has(this)) {
        capture.pink.push(arcs.get(this)!); if (capture.pink.length > 100) capture.pink.shift();
      }
      return fill.apply(this, args);
    } as typeof fill;
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function(this: CanvasRenderingContext2D, ...args: Parameters<typeof stroke>) {
      const arc = arcs.get(this);
      const group = arc?.radius === 22.4 ? capture.rings : arc?.radius === 21 && this.strokeStyle === '#fbbf24' ? capture.selected : null;
      if (group && arc) {group.push(arc); if (group.length > 100) group.shift();}
      return stroke.apply(this, args);
    } as typeof stroke;
  });
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  const {state, config} = eggReserveFixture();
  const source = createSnapshot(state, config);
  const upload = async (snapshot: unknown) => {
    await page.evaluate(() => {const c = (window as any).eggReserveCapture; c.pink.length = c.rings.length = c.selected.length = 0;});
    await page.locator('input[type=file]').setInputFiles({name: 'egg-reserves.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot))});
    await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  };
  const read = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  await upload(source);
  if (!fallback) expect(workers.some(w => /simulation\.worker/.test(w))).toBe(true);
  const canvas = page.getByLabel('Aquatic simulation');
  await expect.poll(() => page.evaluate(() => (window as any).eggReserveCapture.pink.length)).toBeGreaterThan(3);
  const capture = await page.evaluate(() => (window as any).eggReserveCapture);
  const pink = capture.pink.slice(-4);
  expect(pink.map((p: any) => (p.start - p.end) / (2 * Math.PI))).toEqual([.25, .5, .75, 1]);
  expect(pink.every((p: any) => p.ccw && p.radius === 16 && p.start === -Math.PI / 2)).toBe(true);
  expect(capture.rings.slice(-5).every((r: any) => !r.ccw && r.start === -Math.PI / 2 && r.end === 0)).toBe(true);
  // Inspect actual painted pixels: quarter loss covers upper-left, half loss left.
  const colors = await canvas.evaluate((node, points: any[]) => {
    const ctx = (node as HTMLCanvasElement).getContext('2d')!;
    return points.map(p => Array.from(ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data));
  }, pink.slice(0, 2).flatMap((p: any) => [{x: p.x - 6 * p.scale, y: p.y - 6 * p.scale},
    {x: p.x + 6 * p.scale, y: p.y - 6 * p.scale}]));
  for (const i of [0, 2]) {expect(colors[i][0] - colors[i][1]).toBeGreaterThan(30); expect(colors[i][2] - colors[i][1]).toBeGreaterThan(8);}
  for (const i of [1, 3]) {expect(colors[i][0]).toBeGreaterThan(230); expect(Math.abs(colors[i][0] - colors[i][1])).toBeLessThan(5);}
  expect((await read()).state).toEqual(source.state);
  await page.waitForTimeout(120);
  expect((await read()).state).toEqual(source.state);
  // Keep upstream's pause overlay intact; resume through its real control before selection.
  await page.getByRole('button', {name: 'RESUME SIMULATION', exact: true}).click();
  // Close the settings window and select a painted egg using its actual transform.
  await page.getByTitle('Ecology & Physical Settings').click();
  const bounds = await canvas.boundingBox(); expect(bounds).not.toBeNull();
  const dpr = await page.evaluate(() => devicePixelRatio);
  await page.mouse.click(bounds!.x + pink[0].x / dpr, bounds!.y + pink[0].y / dpr);
  await expect.poll(() => page.evaluate(() => (window as any).eggReserveCapture.selected.length)).toBeGreaterThan(0);
  await page.screenshot({path: info.outputPath('egg-reserve-sectors.png')});
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.getByRole('button', {name: '5x', exact: true}).click();
  await expect.poll(async () => (await read()).state.simTime).toBeGreaterThan(0);
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  const advanced = await read();
  expect(advanced.state.eggs.map((e: any) => e.initialFundedReserve)).toEqual([1000, 1000, 1000, 1000, 1000]);
  expect(advanced.state.eggs.map((e: any) => e.fundedReserve)).toEqual([1000, 750, 500, 250, 0]);
  await page.waitForTimeout(120); expect((await read()).state).toEqual(advanced.state);
  // Reimport a permitted recovery and an exhausted, structurally damaged egg.
  source.state.eggs[1].fundedReserve = 900;
  source.state.eggs[4].fundedStructural /= 2;
  await upload(source);
  await expect.poll(() => page.evaluate(() => {
    const pink = (window as any).eggReserveCapture.pink.slice(-4);
    return pink.length === 4 ? (pink[0].start - pink[0].end) / (2 * Math.PI) : -1;
  })).toBeCloseTo(.1, 8);
  expect((await read()).state.eggs[4].fundedReserve).toBe(0);
  expect(errors).toEqual([]);
});
