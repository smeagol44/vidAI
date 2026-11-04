import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createSnapshot} from '../persistence';
import {cycleFixture, food} from '../tests/support/nutrient-cycle';

test.use({viewport: {width: 1280, height: 850}});
test.setTimeout(60000);
for (const fallback of [false, true]) test(`versioned nutrient radii, paused imports and live mineralization (${fallback ? 'fallback' : 'Worker'})`, async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const radii: number[] = []; Object.assign(window, {nutrientRadii: radii});
    const arcs = new WeakMap<CanvasRenderingContext2D, number>();
    const arc = CanvasRenderingContext2D.prototype.arc, fill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.arc = function(x, y, r, a, b, ccw) {
      arcs.set(this, r); return arc.call(this, x, y, r, a, b, ccw);
    };
    CanvasRenderingContext2D.prototype.fill = function(this: CanvasRenderingContext2D, ...args: Parameters<typeof fill>) {
      if (this.fillStyle === '#22e078' && arcs.has(this)) {
        radii.push(arcs.get(this)!); if (radii.length > 60) radii.shift();
      }
      return fill.apply(this, args);
    } as typeof fill;
  });
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  const read = async () => {
    const download = page.waitForEvent('download');
    // A native click grants Chromium the user activation required for each download.
    // Force skips element-stability waiting but still sends an actual mouse gesture.
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).click({force: true});
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  const upload = async (snapshot: unknown) => {
    const canvas = page.getByLabel('Aquatic simulation');
    const epoch = Number(await canvas.getAttribute('data-world-epoch'));
    await page.evaluate(() => {(window as any).nutrientRadii.length = 0;});
    await page.locator('input[type=file]').setInputFiles({name: 'nutrient-cycle.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot))});
    // A visible Resume button can belong to the previous paused world. Wait
    // for replacement before exporting; downloads are not a polling transport.
    await expect(canvas).toHaveAttribute('data-world-epoch', String(epoch + 1), {timeout: 10000});
    await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
    // Worker reset precedes the snapshot on the same ordered message port.
    const current = await read();
    expect({state: current.state, settings: current.settings})
      .toEqual({state: (snapshot as any).state, settings: (snapshot as any).settings});
  };
  // New startup must explicitly opt in, while old imports retain their semantics.
  const startup = await read(); expect(startup.schemaVersion).toBe('20.0.0');
  expect(startup.settings.nutrientCycle).toBe('decay-v2');
  const f = cycleFixture([food(75, false, 1120, 750), food(3000, false, 1280, 750), food(9300, true, 1200, 850)]);
  f.state.caustics = []; f.state.nutrients[2].decayTimeRemaining = .1;
  const source = createSnapshot(f.state, f.settings);
  await upload(source);
  await expect.poll(() => page.evaluate(() => (window as any).nutrientRadii.some((r: number) => r > 2.84 && r < 2.85))).toBe(true);
  expect((await read()).state).toEqual(source.state);
  expect((await read()).settings).toEqual(source.settings);
  await page.screenshot({path: info.outputPath('nutrient-cycle-radii.png')});
  await page.getByRole('button', {name: '5x', exact: true}).click();
  await expect.poll(async () => (await read()).state.nutrients.some((n: any) => n.kind === 'carrion')).toBe(false);
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  const advanced = await read(); expect(advanced.state.simTime).toBeGreaterThan(.1);
  expect(advanced.state.nutrients.every((n: any) => n.energyValue <= 3000)).toBe(true);
  const small = advanced.state.nutrients.find((n: any) => n.id === source.state.nutrients[0].id);
  if (small) {expect(small.energyValue).toBeLessThan(75); expect(small.radius).toBeLessThan(source.state.nutrients[0].radius);}
  await upload(advanced); expect((await read()).state).toEqual(advanced.state);
  expect((await read()).settings).toEqual(advanced.settings);
  const old = structuredClone(source); old.schemaVersion = '16.0.0'; delete old.settings.nutrientCycle;
  old.state.nutrients[0].radius = 8;
  await upload(old); expect((await read()).state).toEqual(old.state);
  expect((await read()).settings).toEqual(old.settings);
  await expect.poll(() => page.evaluate(() => (window as any).nutrientRadii.includes(8))).toBe(true);
  // Explicit upgrade retains exact current energy/PRNG and changes only food radii.
  await page.getByRole('button', {name: 'Update food decay to 1 J/s', exact: true}).click();
  await expect(page.getByTestId('nutrient-cycle')).toContainText('1 J/s');
  const slow = await read(); expect(slow.schemaVersion).toBe('19.0.0');
  expect(slow.settings.nutrientCycle).toBe('decay-v2');
  expect(slow.state.energyPool).toEqual(old.state.energyPool);
  expect(slow.state.prngState).toEqual(old.state.prngState);
  expect(slow.state.nutrients.map((n: any) => n.energyValue)).toEqual(old.state.nutrients.map((n: any) => n.energyValue));
  expect(slow.state.nutrients[0].radius).toBe(6);
  await expect.poll(() => page.evaluate(() => (window as any).nutrientRadii.includes(6))).toBe(true);
  // Keep the old source entirely intact: updated exports must restore exactly.
  await upload(slow); expect((await read()).state).toEqual(slow.state);
  expect(errors).toEqual([]);
});
