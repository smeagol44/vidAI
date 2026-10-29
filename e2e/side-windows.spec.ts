import {build} from 'vite';
import {tubePresentationFixture, tubeProtrusionFixture} from '../tests/support/tube-presentation';
import {selfTubeFixture} from '../tests/support/self-tubes';
import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {enableClosedEconomy} from '../energyEconomy';
import {XoshiroPRNG, type SimulationState} from '../simulation';

test.use({viewport: {width: 1280, height: 900}});
test.setTimeout(90000);
// Bundle an isolated test-only kernel for exact replay in Chrome's own math
// runtime. Node/Chrome transcendental rounding and near-zero diagnostic branch
// counts are not a valid bit-exact cross-runtime reference.
let browserReplayCode: string;
test.beforeAll(async () => {
  const built = await build({configFile: false, logLevel: 'silent', build: {
    write: false, minify: false, lib: {entry: 'tests/support/self-tube-browser.ts',
      formats: ['iife'], name: 'selfTubeReplay'},
  }});
  const output = Array.isArray(built) ? built[0] : built;
  if (!('output' in output)) throw new Error('Missing browser replay bundle');
  const chunk = output.output.find(file => file.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing browser replay code');
  browserReplayCode = chunk.code;
});
for (const fallback of [false, true]) test(`local phone consent and grouped glass tubes follow tank/camera with authoritative physical topology (${fallback ? 'fallback' : 'Worker'})`, async ({page}, info) => {
  // This scenario exercises multiple real imports, resizes and camera gestures.
  // Keep all assertions; allow slow software-rendered CI runners to complete them.
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    type Point = {x: number; y: number; screenX: number; screenY: number; scale: number};
    const capture = {frame: 0, labels: [] as Array<Point & {id: string}>,
      circles: [] as Array<Point & {radius: number}>, tubes: [] as number[][], wall: {width: 0, height: 0, scale: 0, screenX: 0, screenY: 0}};
    Object.assign(window, {sideWindowPaint: capture});
    const tank = (ctx: CanvasRenderingContext2D) => ctx.canvas.getAttribute('aria-label') === 'Aquatic simulation';
    const point = (ctx: CanvasRenderingContext2D, x: number, y: number): Point => {
      const m = ctx.getTransform(), p = m.transformPoint(new DOMPoint(x, y));
      return {x, y, screenX: p.x / devicePixelRatio, screenY: p.y / devicePixelRatio,
        scale: Math.hypot(m.a, m.b) / devicePixelRatio};
    };
    const background = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
      if (tank(this) && x === 0 && y === 0) {capture.frame++; capture.labels = []; capture.circles = []; capture.tubes = [];}
      return background.call(this, x, y, w, h);
    };
    const wall = CanvasRenderingContext2D.prototype.strokeRect;
    CanvasRenderingContext2D.prototype.strokeRect = function(x, y, w, h) {
      if (tank(this) && x === 0 && y === 0) capture.wall = {width: w, height: h, ...point(this, x, y)};
      return wall.call(this, x, y, w, h);
    };
    const text = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(id, x, y, maxWidth) {
      if (tank(this) && /^[LR]\d+$/.test(id)) {
        const p = point(this, x, y); capture.labels.push({...p, id});
      }
      return maxWidth === undefined ? text.call(this, id, x, y) : text.call(this, id, x, y, maxWidth);
    };
    let pen = [0, 0], segments: number[][] = [];
    const begin = CanvasRenderingContext2D.prototype.beginPath;
    CanvasRenderingContext2D.prototype.beginPath = function() {segments = []; return begin.call(this);};
    const move = CanvasRenderingContext2D.prototype.moveTo;
    CanvasRenderingContext2D.prototype.moveTo = function(x, y) {pen = [x, y]; return move.call(this, x, y);};
    const line = CanvasRenderingContext2D.prototype.lineTo;
    CanvasRenderingContext2D.prototype.lineTo = function(x, y) {segments.push([...pen, x, y]); pen = [x, y]; return line.call(this, x, y);};
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function(this: CanvasRenderingContext2D, ...args: Parameters<typeof stroke>) {
      if (tank(this) && typeof this.strokeStyle === 'string' && this.strokeStyle.replace(/\s/g, '') === 'rgba(6,182,212,0.25)') {
        const top = segments.find(([x, y, end, endY]) => x === 0 && y === 0 && endY === 0 && end > 0);
        if (top) {
          const bottom = segments.find(([x, y, end, endY]) => x === 0 && y > 0 && end === top[2] && endY === y);
          if (bottom) capture.wall = {width: top[2], height: bottom[1], ...point(this, 0, 0)};
        }
      }
      if (tank(this) && this.strokeStyle instanceof CanvasGradient) for (const segment of segments) {
        const [x, y, end, endY] = segment;
        if (y === endY && Math.abs(end - x) === 300 && (x === 0 || Math.abs(x - capture.wall.width) < 1e-5)) capture.tubes.push(segment);
      }
      return stroke.apply(this, args);
    } as typeof stroke;
    const arcs = new WeakMap<CanvasRenderingContext2D, Point & {radius: number}>();
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function(x, y, radius, start, end, counterclockwise) {
      if (tank(this)) arcs.set(this, {...point(this, x, y), radius});
      return arc.call(this, x, y, radius, start, end, counterclockwise);
    };
    const fill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function(this: CanvasRenderingContext2D, ...args: Parameters<typeof fill>) {
      if (tank(this) && this.fillStyle === '#facc15' && arcs.has(this)) capture.circles.push(arcs.get(this)!);
      return fill.apply(this, args);
    } as typeof fill;
  });
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  const state: SimulationState = {simTime: 0, organisms: [], eggs: [], nutrients: [], caustics: [], bubbles: [],
    ledger: {externalInflow: 0, metabolicDissipation: 0, mechanicalWorkHeat: 0, recordedLosses: 0},
    nutrientAccumulator: 0, totalBirths: 0, totalDeaths: 0, initialSeed: 51,
    prng: new XoshiroPRNG(51), lineage: new Map(), recentDeaths: []};
  // An empty closed world keeps running; a legacy open world correctly ends on extinction.
  enableClosedEconomy(state);
  const read = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  const upload = async (height: number) => {
    const canvas = page.getByLabel('Aquatic simulation'), epoch = await canvas.getAttribute('data-world-epoch');
    const snapshot = JSON.parse(JSON.stringify(createSnapshot(state,
      {...DEFAULT_SETTINGS, worldWidth: 1800, worldHeight: height, targetNutrients: 0, inflowRate: 0})));
    await page.locator('input[type=file]').setInputFiles({name: 'side-windows.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot))});
    await expect(canvas).not.toHaveAttribute('data-world-epoch', epoch!);
    await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
    await expect.poll(async () => (await read()).state).toEqual(snapshot.state);
    return snapshot;
  };
  const source = await upload(1500);
  const paint = () => page.evaluate(() => (window as any).sideWindowPaint);
  const check = async (height: number) => {
    const count = Math.max(1, Math.floor(height / 300));
    await expect.poll(async () => {const p = await paint(); return [Math.round(p.wall.width), Math.round(p.wall.height), p.labels.length, p.circles.length];})
      .toEqual([1800, height, 0, 0]);
    // Read the painted camera and every DOM anchor in one browser task. During
    // easing/panning, sequential Playwright box reads can span different frames.
    await expect.poll(() => page.evaluate(height => {
      const p = (window as any).sideWindowPaint;
      const canvasTop = document.querySelector('canvas[aria-label="Aquatic simulation"]')!.getBoundingClientRect().y;
      const count = Math.max(1, Math.floor(height / 300));
      let error = 0;
      for (const side of ['L', 'R']) {
        const buttons = document.querySelectorAll(`[data-testid^="side-demo-window-${side}"]`);
        if (buttons.length !== count) return Infinity;
        buttons.forEach((button, index) => {
          const box = button.getBoundingClientRect();
          const anchor = button.closest('.side-demo-anchor') as HTMLElement;
          const anchorY = new DOMMatrix(anchor.style.transform).m42;
          const expected = p.wall.screenY + (height - (index + .5) * height / count) * p.wall.scale;
          // Firefox quantizes DOMRect layout coordinates. Check the authored
          // anchor against independent Canvas geometry at the original strict
          // precision, plus the actual visible center within .02 CSS pixels.
          const visibleError = Math.abs(box.y + box.height / 2 - canvasTop - expected);
          if (visibleError >= .02) error = Infinity;
          error = Math.max(error, Math.abs(anchorY - expected));
        });
      }
      return error;
    }, height)).toBeLessThan(.001);
    return paint();
  };
  await check(1500);
  await expect(page.getByLabel('Tank height', {exact: true})).toHaveAttribute('min', '600');
  await expect(page.getByLabel('Tank height', {exact: true})).toHaveAttribute('max', '3000');
  const setHeight = async (height: number) => {
    await page.getByLabel('Tank height', {exact: true}).evaluate((node, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, String(value));
      node.dispatchEvent(new Event('input', {bubbles: true}));
    }, height);
    await check(height);
  };
  for (const height of [1800, 1600, 1200, 600, 900, 1500]) await setHeight(height);
  await upload(700); await check(700); await upload(1500); await check(1500);
  await page.getByTitle('Close settings (✕)').click();
  const canvas = page.getByLabel('Aquatic simulation');
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 200);
  await expect.poll(async () => (await paint()).wall.scale).toBeCloseTo(.35, 6);
  await check(1500);
  const phone = (side: string) => page.getByTestId(`side-demo-phone-${side}`);
  const windowButton = (side: string, index: number) => page.getByTestId(`side-demo-window-${side}${index}`);
  const eye = page.getByTestId('side-demo-eye');
  const menu = (side: string) => page.getByRole('region', {name: `${side} phone menu`, exact: true});
  const tubes = async (expected: number) => expect.poll(async () => (await paint()).tubes.length).toBe(expected);
  // Downward phone cards intentionally follow the world rather than pinning to
  // the viewport. Bring the tank floor into view through the real camera input.
  const framePhones = async (target = 400) => {
    // Center Cam and wheel zoom ease toward their targets. Measuring before
    // that motion settles bakes its remaining displacement into the next drag.
    let previousY = (await phone('L').boundingBox())!.y;
    await expect.poll(async () => {
      const y = (await phone('L').boundingBox())!.y, delta = Math.abs(y - previousY);
      previousY = y;
      return delta;
    }, {intervals: [50, 100, 250]}).toBeLessThan(.001);
    // Move through clear water in bounded increments; a large drag can leave
    // the viewport or overshoot while the camera is still easing on CI.
    const current = (await canvas.boundingBox())!;
    const startX = current.x + current.width / 3, startY = current.y + current.height / 2;
    for (let correction = 0; correction < 12; correction++) {
      const y = (await phone('L').boundingBox())!.y;
      if (Math.abs(y - target) < 8) break;
      const distance = Math.max(-120, Math.min(120, target - y));
      await page.mouse.move(startX, startY); await page.mouse.down();
      await page.mouse.move(startX, startY + distance, {steps: 5}); await page.mouse.up();
      // Observe the result after easing instead of compounding stale offsets.
      await page.waitForTimeout(200);
    }
    // The same original strict framing tolerance remains an acceptance gate.
    await expect.poll(async () => Math.abs((await phone('L').boundingBox())!.y - target)).toBeLessThan(8);
  };
  const call = async (side: string) => {
    await framePhones();
    await phone(side).click(); await page.getByTestId(`side-person-self-${side}`).click();
  };
  await expect(page.getByTestId('side-demo-pair')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Reset local connections', exact: true})).toHaveCount(0);
  await expect(page.locator('.side-demo-toolbar')).toHaveCount(0);
  await expect(windowButton('L', 0)).toBeDisabled(); await tubes(0);
  await framePhones();
  await phone('L').click();
  await menu('L').getByLabel('Your display name').pressSequentially('fN 123');
  await menu('L').getByLabel('Your display name').press('Enter');
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  await expect(page.getByTestId('side-person-self-L')).toContainText('fN 123');
  await page.getByTestId('side-person-self-L').click();
  await expect(phone('R')).toHaveAttribute('data-ringing', 'true');
  await expect(page.getByTestId('side-call-accept-R')).toBeVisible();
  await expect(page.locator('[aria-modal=true]')).toHaveCount(0);
  await page.screenshot({path: info.outputPath(`side-windows-${fallback ? 'fallback' : 'worker'}-incoming.png`)});
  const eyeAlignment = await page.evaluate(() => {
    const eye = document.querySelector('[data-testid="side-demo-eye"]') as HTMLElement;
    const phone = document.querySelector('[data-testid="side-demo-phone-L"]') as HTMLElement;
    const center = (node: HTMLElement) => new DOMMatrix((node.closest('.side-demo-anchor') as HTMLElement).style.transform).m42 + node.offsetHeight / 2;
    const a = eye.getBoundingClientRect(), b = phone.getBoundingClientRect();
    return {logicalEye: center(eye), logicalPhone: center(phone),
      visibleDifference: Math.abs(a.y + a.height / 2 - b.y - b.height / 2)};
  });
  expect(eyeAlignment.logicalEye).toBeCloseTo(eyeAlignment.logicalPhone, 3);
  expect(eyeAlignment.visibleDifference).toBeLessThan(.02);
  await eye.click();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(eye).toHaveAttribute('aria-expanded', 'false');
  await expect(eye.locator('svg')).toHaveClass(/lucide-eye-closed/);
  expect(await eye.evaluate(node => Number(getComputedStyle(node).opacity))).toBe(.35);
  await expect(phone('L')).toBeHidden(); await expect(phone('R')).toBeHidden();
  await expect(page.getByTestId('side-call-accept-R')).toBeHidden();
  await expect(phone('R')).toHaveAttribute('data-ringing', 'true');
  await eye.press('Space');
  await expect(eye).toHaveAttribute('aria-expanded', 'true');
  await expect(eye.locator('svg')).toHaveClass(/(?:^|\s)lucide-eye(?:\s|$)/);
  await expect(page.getByTestId('side-call-accept-R')).toBeVisible();
  // Pending calls never block simulation controls or acquire a response deadline.
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Pause', exact: true})).toBeVisible();
  await page.getByTitle('Ecology & Physical Settings').click();
  await expect.poll(async () => (await read()).state.simTime).toBeGreaterThan(0);
  await page.getByTitle('Close settings (✕)').click();
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(phone('R')).toHaveAttribute('data-ringing', 'true');
  await menu('L').getByRole('button', {name: 'Cancel call', exact: true}).click();
  await expect(phone('R')).toHaveAttribute('data-ringing', 'false');
  await page.getByTestId('side-person-self-L').click();
  await menu('R').getByRole('button', {name: 'Decline', exact: true}).click();
  await expect(phone('R')).toHaveAttribute('data-ringing', 'false');
  await page.getByTitle('Ecology & Physical Settings').click(); await upload(1500);
  await page.getByTitle('Close settings (✕)').click();
  await call('R'); await page.getByTestId('side-call-accept-L').click();
  await expect(phone('L')).toHaveAttribute('data-connected', 'true');
  await expect(phone('R')).toHaveAttribute('data-connected', 'true');
  await tubes(0); await expect(windowButton('L', 0)).toHaveAttribute('data-state', 'closed');
  const pixel = () => canvas.evaluate(node => {
    const c = node as HTMLCanvasElement, p = (window as any).sideWindowPaint;
    const x = Math.round((p.wall.screenX - 100 * p.wall.scale) * devicePixelRatio);
    const count = Math.max(1, Math.floor(p.wall.height / 300));
    const y = Math.round((p.wall.screenY + (p.wall.height - .5 * p.wall.height / count) * p.wall.scale) * devicePixelRatio);
    return Array.from(c.getContext('2d')!.getImageData(x, y, 1, 1).data).slice(0, 3);
  });
  const closedPixel = await pixel();
  await windowButton('L', 0).focus(); await windowButton('L', 0).press('Space');
  await expect(windowButton('L', 0)).toHaveAttribute('data-state', 'outgoing');
  await expect(windowButton('R', 0)).toHaveAttribute('data-state', 'incoming');
  await expect(windowButton('L', 0).locator('svg')).toHaveAttribute('data-hand-direction', 'left');
  await expect(windowButton('R', 0).locator('svg')).toHaveAttribute('data-hand-direction', 'left');
  await tubes(0); await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Decline window offer R0', exact: true}).click();
  await expect(windowButton('L', 0)).toHaveAttribute('data-state', 'rejected');
  await windowButton('L', 0).click(); await windowButton('R', 0).click(); await tubes(4);
  await expect.poll(pixel).toEqual(closedPixel); // channel water has no extra tint
  await windowButton('L', 1).click(); await windowButton('R', 1).click(); await tubes(4);
  await expect.poll(async () => (await paint()).tubes.length === 4 && (await paint()).tubes.every(([, y]: number[]) => y === 900 || y === 1500)).toBe(true);
  // Phone dialogs are framed lower than the tank's topmost window. Pan through
  // the actual canvas before clicking upper windows, rather than DOM scrolling.
  await framePhones(650);
  await windowButton('R', 4).click(); await windowButton('L', 4).click(); await tubes(8);
  const geometry = await paint(), leftBox = (await windowButton('L', 0).boundingBox())!, rightBox = (await windowButton('R', 0).boundingBox())!;
  expect(leftBox.x + leftBox.width).toBeLessThan(bounds.x + geometry.wall.screenX - 300 * geometry.wall.scale);
  expect(rightBox.x).toBeGreaterThan(bounds.x + geometry.wall.screenX + 2100 * geometry.wall.scale);
  await page.screenshot({path: info.outputPath(`side-windows-${fallback ? 'fallback' : 'worker'}.png`)});
  await page.getByTitle('Ecology & Physical Settings').click(); const beforeEye = (await read()).state;
  await page.getByTitle('Close settings (✕)').click(); await eye.click();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(phone('L')).toBeHidden(); await expect(windowButton('R', 0)).toBeHidden();
  await expect(page.locator('.side-demo-peer').filter({visible: true})).toHaveCount(0);
  await tubes(8); // Infrastructure is painted even with its controls hidden.
  await page.screenshot({path: info.outputPath(`side-windows-${fallback ? 'fallback' : 'worker'}-eye-closed.png`)});
  await page.getByTitle('Ecology & Physical Settings').click(); expect((await read()).state).toEqual(beforeEye);
  await page.getByTitle('Close settings (✕)').click(); await eye.click();
  await expect(windowButton('R', 0)).toHaveAttribute('data-state', 'accepted'); await tubes(8);

  await page.getByTitle('Ecology & Physical Settings').click(); await setHeight(600);
  await page.getByTitle('Close settings (✕)').click();
  await expect(windowButton('L', 4)).toHaveCount(0); await tubes(4);
  await expect(page.getByTestId('side-demo-suspended-L4')).toBeVisible();
  await expect(page.getByTestId('side-demo-suspended-R4')).toBeVisible();
  await page.screenshot({path: info.outputPath(`side-windows-${fallback ? 'fallback' : 'worker'}-suspended.png`)});
  await page.getByTitle('Ecology & Physical Settings').click(); await setHeight(1500);
  await page.getByTitle('Close settings (✕)').click();
  await expect(windowButton('L', 4)).toHaveAttribute('data-state', 'accepted'); await tubes(8);
  await page.getByTitle('Ecology & Physical Settings').click(); await setHeight(600);
  await page.getByTitle('Close settings (✕)').click();
  await page.getByTestId('side-demo-suspended-L4').click();
  await expect(page.getByTestId('side-demo-suspended-R4')).toHaveCount(0);
  await page.getByTitle('Ecology & Physical Settings').click(); await setHeight(1500);
  await page.getByTitle('Close settings (✕)').click(); await tubes(4);
  await framePhones();
  await phone('L').click();
  await menu('L').getByRole('button', {name: 'Turn availability off', exact: true}).click();
  await tubes(4); // leaving discovery does not break an existing connection
  await menu('L').getByRole('button', {name: 'Disconnect · retain agreements', exact: true}).click();
  await tubes(0); await expect(windowButton('L', 0)).toHaveAttribute('data-state', 'suspended');
  await expect(windowButton('L', 0).locator('svg')).toHaveClass(/lucide-wifi-off/);
  await expect(page.getByTestId('side-demo-suspended-L0')).toHaveCount(0);
  await menu('L').getByRole('button', {name: 'Make phone available', exact: true}).click();
  await page.getByTestId('side-person-self-L').click(); await page.getByTestId('side-call-accept-R').click(); await tubes(4);
  // Opening all windows leaves only the outer floor and ceiling on each side.
  await framePhones(650);
  for (const index of [2, 3, 4]) {await windowButton('L', index).click(); await windowButton('R', index).click();}
  await tubes(4);
  await expect.poll(async () => (await paint()).tubes.length === 4 && (await paint()).tubes.every(([, y]: number[]) => y === 0 || y === 1500)).toBe(true);
  for (let index = 0; index < 5; index++) await windowButton('L', index).click();
  await tubes(0);
  const before = await paint();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2 + 40, {steps: 4}); await page.mouse.up();
  await expect.poll(async () => Math.abs((await paint()).wall.screenX - before.wall.screenX)).toBeGreaterThan(20);
  await check(1500);
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => (await paint()).wall.scale).toBeGreaterThan(.35);
  await check(1500);
  const beforeResize = (await paint()).frame;
  await page.setViewportSize({width: 960, height: 720});
  await expect.poll(() => canvas.evaluate(node => node.getBoundingClientRect().width)).toBe(960);
  await expect.poll(async () => (await paint()).frame).toBeGreaterThan(beforeResize);
  await check(1500);
  await page.getByTitle('Ecology & Physical Settings').click();
  const exact = await read();
  expect(exact.state).toEqual({...source.state, selfTubes: {version: 1, connected: true, accepted: []}});
  expect(exact.settings.worldWidth).toBe(1800); expect(exact.settings.worldHeight).toBe(1500);
  expect(errors).toEqual([]);
  await page.getByTitle('Close settings (✕)').click();
  await page.getByRole('button', {name: 'Center Cam', exact: true}).click();
  // Center Cam restores 0.85 zoom. Wheel events must target the canvas, not
  // the footer button where the preceding click left the mouse.
  const smallBounds = (await canvas.boundingBox())!;
  await page.mouse.move(smallBounds.x + smallBounds.width / 2, smallBounds.y + smallBounds.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 200);
  await expect.poll(async () => (await paint()).wall.scale).toBeCloseTo(.35, 6);
  await framePhones(300);
  await phone('R').click({timeout: 5000});
  await expect.poll(() => page.getByTestId('tank-viewport').evaluate(node => node.scrollTop)).toBe(0);
  await expect.poll(() => page.getByRole('region', {name: 'Local aquarium connections', exact: true}).evaluate(node => node.scrollTop)).toBe(0);
  const dialogAnchors = () => page.evaluate(() => {
    const phoneNode = document.querySelector('[data-testid="side-demo-phone-R"]') as HTMLElement;
    const cardNode = document.querySelector('[aria-label="R phone menu"]') as HTMLElement;
    const phone = phoneNode.getBoundingClientRect(), card = cardNode.getBoundingClientRect();
    const p = new DOMMatrix((phoneNode.closest('.side-demo-anchor') as HTMLElement).style.transform);
    const c = new DOMMatrix(cardNode.style.transform);
    return {phone: {x: p.m41, y: p.m42, height: phoneNode.offsetHeight}, card: {x: c.m41, y: c.m42},
      visibleGap: card.y - phone.y - phone.height};
  });
  // Read both anchors atomically so camera easing cannot split the measurement
  // across two rendered frames.
  const {card, phone: phoneBefore, visibleGap} = await dialogAnchors();
  expect(card.y - phoneBefore.y - phoneBefore.height).toBeCloseTo(12, 3);
  expect(Math.abs(visibleGap - 12)).toBeLessThan(.02);
  // Both anchors move by the same world-camera displacement; no viewport clamp.
  // The centered eye is at the phone height: a center-column drag here clicks
  // that control. Use clear water and verify the actual pointer target first.
  const dragX = smallBounds.x + smallBounds.width / 3, dragY = smallBounds.y + 160;
  expect(await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.getAttribute('aria-label'),
    {x: dragX, y: dragY})).toBe('Aquatic simulation');
  await page.mouse.move(dragX, dragY);
  await page.mouse.down(); await page.mouse.move(dragX, dragY + 100, {steps: 5}); await page.mouse.up();
  await expect.poll(async () => (await dialogAnchors()).phone.y - phoneBefore.y).toBeGreaterThan(80);
  const {card: moved, phone: movedPhone, visibleGap: movedGap} = await dialogAnchors();
  expect(Math.abs(movedGap - 12)).toBeLessThan(.02);
  expect(moved.y - card.y).toBeCloseTo(movedPhone.y - phoneBefore.y, 3);
  expect(moved.x - card.x).toBeCloseTo(movedPhone.x - phoneBefore.x, 3);
  await page.setViewportSize({width: 1280, height: 900});
  await page.reload();
  // This final check concerns session reset, not live ecology throughput.
  // Pause the newly autoplayed world before measuring fallback camera easing.
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  const reloadedCanvas = (await canvas.boundingBox())!;
  await page.mouse.move(reloadedCanvas.x + reloadedCanvas.width / 2, reloadedCanvas.y + reloadedCanvas.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 200);
  await expect(phone('L')).toHaveAttribute('data-connected', 'false');
  await framePhones();
  await phone('L').click(); await expect(menu('L').getByLabel('Your display name')).toHaveValue('');
});


for (const fallback of [false, true]) test(`physical self-tube crossing conserves live state in ${fallback ? 'fallback' : 'Worker'}`, async ({page}) => {
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  const read = async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  };
  for (const side of ['L', 'R'] as const) {
    const {source, settings} = selfTubeFixture(side);
    const canvas = page.getByLabel('Aquatic simulation'), epoch = await canvas.getAttribute('data-world-epoch');
    await page.locator('input[type=file]').setInputFiles({name: 'physical-tubes.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(source))});
    // An export issued before asynchronous import replaces the world can be
    // rejected by the intentional epoch guard. Observe replacement first.
    await expect(canvas).not.toHaveAttribute('data-world-epoch', epoch!);
    await expect.poll(async () => (await read()).state).toEqual(source.state);
    await expect(page.getByTestId('side-demo-window-L0')).toHaveAttribute('data-state', 'accepted');
    await page.getByRole('button', {name: 'Resume', exact: true}).click();
    await expect.poll(async () => {
      const s = await read(), x = s.state.organisms[0].segments[0].x;
      return side === 'L' ? x > settings.worldWidth : x < 0;
    }).toBe(true);
    await page.getByRole('button', {name: 'Pause', exact: true}).click();
    const arrived = await read();
    const ticks = Math.round(arrived.state.simTime * 60); expect(ticks).toBeGreaterThan(0);
    await page.addScriptTag({content: browserReplayCode});
    const expected = await page.evaluate(({source, ticks}) =>
      (window as any).selfTubeReplay.replaySelfTubeSnapshot(source, ticks), {source, ticks});
    expect(arrived.state).toEqual(expected);
    expect(arrived.state.organisms).toHaveLength(1);
    expect(arrived.state.organisms[0].id).toBe(source.state.organisms[0].id);
    expect(arrived.state.totalBirths).toBe(source.state.totalBirths);
    expect(Math.abs(totalAccountedEnergy(restoreSnapshot(arrived).state) - source.state.energyPool!.budget)).toBeLessThan(1e-6);
    expect((await read()).state).toEqual(arrived.state);
  }
});

test('all tube entities fade spatially, water is untinted and paused sensory state stays exact', async ({page}, info) => {
  await page.addInitScript(() => {
    const recordPaint = (ctx: CanvasRenderingContext2D) => {
      if (ctx.canvas.getAttribute('aria-label') === 'Aquatic simulation') {
        Object.assign(window, {tubeScenePaintScale: ctx.getTransform().a / devicePixelRatio,
          tubeScenePaintEpoch: ctx.canvas.getAttribute('data-world-epoch')});
      }
    };
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function(this: CanvasRenderingContext2D, ...args: Parameters<typeof stroke>) {
      recordPaint(this);
      return stroke.apply(this, args);
    } as typeof stroke;
    // Closed tanks paint their glass with strokeRect rather than stroke.
    const strokeRect = CanvasRenderingContext2D.prototype.strokeRect;
    CanvasRenderingContext2D.prototype.strokeRect = function(...args: Parameters<typeof strokeRect>) {
      recordPaint(this);
      return strokeRect.apply(this, args);
    };
  });
  await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.getByRole('button', {name: 'Hidden', exact: true}).click();
  const canvas = page.getByLabel('Aquatic simulation');
  const upload = async (snapshot: ReturnType<typeof tubePresentationFixture>) => {
    restoreSnapshot(snapshot); // Validate the fixture before requesting a real app import.
    const epoch = await canvas.getAttribute('data-world-epoch');
    await page.locator('input[type=file]').setInputFiles({name: 'tube-observer.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot))});
    await expect(canvas).not.toHaveAttribute('data-world-epoch', epoch!);
    const current = await canvas.getAttribute('data-world-epoch');
    await expect.poll(() => page.evaluate(() => (window as any).tubeScenePaintEpoch)).toBe(current);
  };
  await upload(tubePresentationFixture('L', 0, true));
  await page.getByTitle('Close settings (✕)').click();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 4, bounds.y + bounds.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => (window as any).tubeScenePaintScale)).toBeCloseTo(.35, 6);
  await page.getByTitle('Ecology & Physical Settings').click();
  // Import recenters the camera while retaining zoom; no arbitrary browser state edits.
  await upload(tubePresentationFixture('L', 0, true));
  const samples = (side: 'L' | 'R', depth: number) => canvas.evaluate((node, {side, depth}) => {
    const c = node as HTMLCanvasElement, box = c.getBoundingClientRect(), ctx = c.getContext('2d')!;
    const ratio = c.width / box.width, x = side === 'L' ? -depth : 800 + depth;
    return [150, 450, 750, 1050, 1350, 1650, 1700].map(y => {
      const px = Math.round((box.width / 2 + (x - 400) * .35) * ratio);
      const py = Math.round((box.height / 2 + (y - 900) * .35) * ratio);
      return Array.from(ctx.getImageData(px - 5, py - 5, 11, 11).data);
    });
  }, {side, depth});
  const depths = [0, 100, 200, 300], names = ['caustic', 'bubble', 'nutrient', 'carrion', 'egg', 'organism', 'trace'];
  for (const side of ['L', 'R'] as const) {
    await upload(tubePresentationFixture(side, 0, true));
    const background = await Promise.all(depths.map(depth => samples(side, depth)));
    const strength: number[][] = [];
    for (const [index, depth] of depths.entries()) {
      const source = tubePresentationFixture(side, depth);
      await upload(source);
      const pixels = await samples(side, depth);
      strength.push(pixels.map((rgba, row) => rgba.reduce((sum, value, channel) =>
        sum + (channel % 4 === 3 ? 0 : Math.abs(value - background[index][row][channel])), 0)));
      const pending = page.waitForEvent('download');
      await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
      const exact = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
      expect(exact.state).toEqual(source.state); // includes optical inputs and learned records
      if (side === 'L' && depth === 100) {
        await page.getByTitle('Close settings (✕)').click();
        await page.screenshot({path: info.outputPath('side-windows-all-elements.png')});
        await page.getByTitle('Ecology & Physical Settings').click();
      }
    }
    for (const [row, name] of names.entries()) {
      expect(strength[0][row], `${side} ${name} is visible at entrance`).toBeGreaterThan(0);
      expect(strength[1][row], `${side} ${name} fades at 100`).toBeGreaterThan(0);
      expect(strength[1][row], `${side} ${name} fades at 100`).toBeLessThan(strength[0][row]);
      expect(strength[2][row], `${side} ${name} approaches invisibility at 200`).toBeLessThan(strength[1][row]);
      expect(strength[3][row], `${side} ${name} disappears at 300`).toBe(0);
    }
  }
  for (const side of ['L', 'R'] as const) {
    const open = tubePresentationFixture(side, 200); await upload(open);
    const openPixels = await samples(side, 200);
    const closed = structuredClone(open); closed.state.selfTubes!.accepted = [];
    await upload(closed);
    expect(await samples(side, 200), `${side}: observer fade is independent of window agreements`).toEqual(openPixels);
  }
  for (const side of ['L', 'R'] as const) {
    const spillPixels = (depth: number, rootY: number) => canvas.evaluate((node, {side, depth, rootY}) => {
      const c = node as HTMLCanvasElement, box = c.getBoundingClientRect(), ratio = c.width / box.width;
      const x = side === 'L' ? -depth : 800 + depth;
      const left = Math.round((box.width / 2 + (x - 70 - 400) * .35) * ratio);
      const top = Math.round((box.height / 2 + (rootY - 55 - 900) * .35) * ratio);
      return Array.from(c.getContext('2d')!.getImageData(left, top, Math.round(140 * .35 * ratio), Math.round(110 * .35 * ratio)).data);
    }, {side, depth, rootY});
    const compare = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + (i % 4 === 3 ? 0 : Math.abs(value - b[i])), 0);
    for (const rootY of [1501, 1499, 1799, 1801]) {
      await upload(tubeProtrusionFixture(side, 400, rootY, true)); const background = await spillPixels(400, rootY);
      const source = tubeProtrusionFixture(side, 400, rootY); await upload(source);
      expect(compare(await spillPixels(400, rootY), background), `${side} whole body including overflow is fully masked beyond 300 / y=${rootY}`).toBe(0);
      const pending = page.waitForEvent('download');
      await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
      expect(JSON.parse(await readFile((await (await pending).path())!, 'utf8')).state).toEqual(source.state);
    }
    for (const [rootY, sampleY] of [[1, -12], [1799, 1812]]) {
      const outsidePixels = () => canvas.evaluate((node, {side, sampleY}) => {
        const c = node as HTMLCanvasElement, box = c.getBoundingClientRect(), ratio = c.width / box.width;
        const x = side === 'L' ? -100 : 900;
        const px = Math.round((box.width / 2 + (x - 400) * .35) * ratio);
        const py = Math.round((box.height / 2 + (sampleY - 900) * .35) * ratio);
        return Array.from(c.getContext('2d')!.getImageData(px - 5, py - 2, 11, 5).data);
      }, {side, sampleY});
      await upload(tubeProtrusionFixture(side, 100, rootY, true)); const dark = await outsidePixels();
      await upload(tubeProtrusionFixture(side, 100, rootY));
      expect(await outsidePixels(), `${side}: body/glow overflow outside tank y=${sampleY} stays dark`).toEqual(dark);
    }
    await upload(tubeProtrusionFixture(side, 0, 1501, true)); const baseline = await spillPixels(0, 1501);
    await upload(tubeProtrusionFixture(side, 0, 1501));
    expect(compare(await spillPixels(0, 1501), baseline), `${side} protruding body remains visible at entrance`).toBeGreaterThan(0);
  }

});
