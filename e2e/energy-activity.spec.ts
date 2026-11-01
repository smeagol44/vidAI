import {test, expect} from '@playwright/test';
import {energyActivityFixture} from '../tests/support/energy-activity';
import {createSnapshot} from '../persistence';

test.use({viewport: {width: 1280, height: 850}});
test.setTimeout(60000);
for (const fallback of [false, true]) test(`energy contour glows follow real body paths and freeze while paused (${fallback ? 'fallback' : 'Worker'})`, async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const capture = {armPause: false, skinFills: 0, bodyOverGlow: 0, totals: {green: 0, red: 0}, green: [] as Array<{alpha: number; path: number[]; at: number; scale: number; width: number}>,
      red: [] as Array<{alpha: number; path: number[]; at: number; scale: number; width: number}>};
    Object.assign(window, {energyTintCapture: capture});
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
        // Pause via the real host control as soon as both rendered waves have
        // been observed. The independent Worker must not exhaust the victim
        // while the software-rendered browser waits for another test command.
        if (capture.armPause && capture.green.some(s => s.alpha > .20)
          && capture.red.some(s => s.alpha > .25)) {
          capture.armPause = false;
          queueMicrotask(() => document.querySelector<HTMLButtonElement>('[data-testid="action-toolbar"] button')!.click());
        }
      }
      return originalStroke.apply(this, args);
    } as typeof originalStroke;
  });
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  const {state, config} = energyActivityFixture();
  await page.locator('input[type=file]').setInputFiles({name: 'activity.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(createSnapshot(state, config)))});
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  await page.evaluate(() => {const c = (window as any).energyTintCapture; c.green.length = c.red.length = c.totals.green = c.totals.red = 0; c.armPause = true;});
  await page.getByRole('button', {name: '1x', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await expect.poll(() => page.evaluate(() => {
    const c = (window as any).energyTintCapture; return c.green.some((s: any) => s.alpha > .20) && c.red.some((s: any) => s.alpha > .25);
  })).toBe(true);
  // Freeze activity using the existing upstream pause control and overlay.
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  const sample = () => page.evaluate(() => {
    const c = (window as any).energyTintCapture;
    return {green: c.green.at(-1), red: c.red.at(-1), counts: [c.totals.green, c.totals.red]};
  });
  await page.waitForTimeout(150);
  const paused = await sample();
  await expect.poll(async () => {
    const latest = await sample();
    return latest.counts[0] > paused.counts[0] && latest.counts[1] > paused.counts[1];
  }).toBe(true);
  const held = await sample();
  // Observe fresh painted frames while paused: both waves keep exact opacity/path.
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
  // Upstream's pause overlay is unchanged. Exercise its existing canvas zoom
  // handler without importing #113's interactive x0 UI.
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
  await page.getByRole('button', {name: '5x', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  // Replacing the paused world must clear all old activity without advancing time.
  state.nutrients = []; state.organisms = [];
  await page.locator('input[type=file]').setInputFiles({name: 'empty.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(createSnapshot(state, config)))});
  await page.waitForTimeout(150);
  const cleared = await sample(); await page.waitForTimeout(150);
  expect((await sample()).counts).toEqual(cleared.counts);
  expect(errors).toEqual([]);
});
