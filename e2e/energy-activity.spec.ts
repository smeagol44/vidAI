import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {energyActivityFixture} from '../tests/support/energy-activity';
import {createSnapshot} from '../persistence';

test.use({viewport: {width: 1280, height: 850}});
test.setTimeout(60000);
for (const fallback of [false, true]) test(`energy contour glows follow real body paths and freeze at x0 (${fallback ? 'fallback' : 'Worker'})`, async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const capture = {frames: 0, skinFills: 0, bodyOverGlow: 0, totals: {green: 0, red: 0}, green: [] as Array<{alpha: number; path: number[]; at: number; scale: number; width: number}>,
      red: [] as Array<{alpha: number; path: number[]; at: number; scale: number; width: number}>};
    Object.assign(window, {energyTintCapture: capture});
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function(...args) {
      if (this.canvas.getAttribute('aria-label') === 'Aquatic simulation' && args[0] === 0 && args[1] === 0) capture.frames++;
      return fillRect.apply(this, args);
    };
    const paths = new WeakMap<CanvasRenderingContext2D, number[]>();
    const originalRect = CanvasRenderingContext2D.prototype.roundRect;
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, ...rest) {
      paths.set(this, [x, y, w, h]); return originalRect.call(this, x, y, w, h, ...rest);
    };
    const pendingGlow = new WeakSet<CanvasRenderingContext2D>();
    const originalFill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function(this: CanvasRenderingContext2D, ...args: Parameters<typeof originalFill>) {
      if (/rgba\((34, 220, 105|245, 55, 65),/.test(String(this.fillStyle))) capture.skinFills++;
      if (pendingGlow.delete(this)) capture.bodyOverGlow++;
      return originalFill.apply(this, args);
    } as typeof originalFill;
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function(this: CanvasRenderingContext2D, ...args: Parameters<typeof originalStroke>) {
      const style = String(this.strokeStyle);
      const color = /rgba\(34, 220, 105, ([\d.]+)\)/.exec(style) ? 'green'
        : /rgba\(245, 55, 65, ([\d.]+)\)/.exec(style) ? 'red' : null;
      if (color) {
        pendingGlow.add(this);
        const alpha = Number(style.match(/([\d.]+)\)$/)![1]);
        capture.totals[color]++;
        capture[color].push({width: this.lineWidth, alpha, path: paths.get(this) ?? [], at: performance.now(), scale: Math.hypot(this.getTransform().a, this.getTransform().b)});
        if (capture[color].length > 1000) capture[color].shift();
      }
      return originalStroke.apply(this, args);
    } as typeof originalStroke;
  });
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  const {state, config} = energyActivityFixture();
  const read = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  const upload = async (name: string) => {
    const snapshot = JSON.parse(JSON.stringify(createSnapshot(state, config)));
    await page.locator('input[type=file]').setInputFiles({name, mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot))});
    await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
    // An already-visible Resume button or a wall-clock delay cannot acknowledge
    // file.text(), React's replacement, and the authoritative Worker reset.
    await expect.poll(async () => (await read()).state).toEqual(snapshot.state);
  };
  await upload('activity.json');
  await page.evaluate(() => {const c = (window as any).energyTintCapture; c.green.length = c.red.length = c.totals.green = c.totals.red = 0;});
  await page.getByRole('button', {name: '1x', exact: true}).click();
  await expect.poll(() => page.evaluate(() => {
    // Real finite feeding must paint both signals. A slow renderer can skip the
    // short peaks; exact peak amplitudes are checked with a controlled clock in
    // energy-activity.test.ts, including the actual glow drawing function.
    const c = (window as any).energyTintCapture; return c.totals.green > 0 && c.totals.red > 0;
  })).toBe(true);
  // Freeze while activity is ongoing; navigation/inspection remain available.
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  const sample = () => page.evaluate(() => {
    const c = (window as any).energyTintCapture;
    return {frames: c.frames, green: c.green.at(-1), red: c.red.at(-1), counts: [c.totals.green, c.totals.red]};
  });
  const stopping = await sample();
  await expect.poll(async () => (await sample()).frames).toBeGreaterThan(stopping.frames + 1);
  const paused = await sample();
  await expect.poll(async () => {
    const latest = await sample();
    return latest.counts[0] > paused.counts[0] && latest.counts[1] > paused.counts[1];
  }).toBe(true);
  const held = await sample();
  // Observe fresh painted frames at x0: both waves keep exact opacity/path.
  if (held.counts[0] > paused.counts[0]) expect(held.green.alpha).toBe(paused.green.alpha);
  if (held.counts[1] > paused.counts[1]) expect(held.red.alpha).toBe(paused.red.alpha);
  const capture = await page.evaluate(() => (window as any).energyTintCapture);
  expect(capture.green.some((s: any) => s.path[2] === 7 && s.path[3] === 7)).toBe(true);
  expect(capture.red.every((s: any) => s.path[2] === 7 && s.path[3] === 7)).toBe(true);
  expect(Math.max(...capture.green.map((s: any) => s.alpha))).toBeLessThanOrEqual(.32);
  expect(Math.max(...capture.red.map((s: any) => s.alpha))).toBeLessThanOrEqual(.37);
  expect(capture.skinFills).toBe(0);
  expect(capture.bodyOverGlow).toBeGreaterThan(0);
  for (const color of ['green', 'red']) {
    // Every glow uses the body path, with at most 10.5 CSS pixels outside it.
    const widths = capture[color].map((s: any) => s.width * s.scale);
    expect(widths.some((w: number) => Math.abs(w - 21) < .001)).toBe(true);
    expect(Math.max(...widths)).toBeLessThanOrEqual(21.001);
  }
  const beforeZoom = await sample();
  // Zoom remains interactive at x0 without advancing the paused world.
  await page.getByLabel('Aquatic simulation').dispatchEvent('wheel', {deltaY: -500, clientX: 800, clientY: 450});
  await expect.poll(async () => {
    const latest = await sample();
    return (latest.green?.scale !== beforeZoom.green?.scale && latest.counts[0] > beforeZoom.counts[0])
      || (latest.red?.scale !== beforeZoom.red?.scale && latest.counts[1] > beforeZoom.counts[1]);
  }).toBe(true);
  const zoomed = await page.evaluate(() => (window as any).energyTintCapture);
  for (const color of ['green', 'red']) {
    const last = zoomed[color].at(-1);
    expect(last.width * last.scale).toBeCloseTo(2, 3);
  }
  await page.screenshot({path: info.outputPath('energy-pulses-paused.png')});
  await page.getByRole('button', {name: '5x', exact: true}).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  // Replacing the world at x0 must clear all old activity without advancing time.
  state.nutrients = []; state.organisms = [];
  await upload('empty.json');
  const imported = await sample();
  await expect.poll(async () => (await sample()).frames).toBeGreaterThan(imported.frames);
  const cleared = await sample();
  await expect.poll(async () => (await sample()).frames).toBeGreaterThan(cleared.frames + 2);
  expect((await sample()).counts).toEqual(cleared.counts);
  expect(errors).toEqual([]);
});
