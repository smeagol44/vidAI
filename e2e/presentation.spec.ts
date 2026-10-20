import {test, expect} from '@playwright/test';
import * as sim from '../simulation';
import {BUILD_VERSION, DEFAULT_SETTINGS, createSnapshot} from '../persistence';

test.setTimeout(90000);
function emptyWorld(seed: number): sim.SimulationState {
  return {simTime: 0, organisms: [], eggs: [], nutrients: [], caustics: [], bubbles: [],
    ledger: {externalInflow: 0, metabolicDissipation: 0, mechanicalWorkHeat: 0, recordedLosses: 0},
    nutrientAccumulator: 0, totalBirths: 0, totalDeaths: 0, initialSeed: seed,
    prng: new sim.XoshiroPRNG(seed), lineage: new Map(), recentDeaths: []};
}

for (const viewport of [{width: 1920, height: 900}, {width: 520, height: 900}, {width: 1024, height: 480}]) {
  test(`canvas fills ${viewport.width}x${viewport.height} and windows remain reachable`, async ({page}, info) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize(viewport); await page.goto('./?autoplay');
    // Keep layout measurements independent of ecological/rendering workload.
    // This is a genuine imported, paused snapshot, not a product test flag.
    const quiet = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
    await page.getByTitle('Ecology & Physical Settings').click();
    await page.locator('input[type=file]').setInputFiles({name: 'layout.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(createSnapshot(emptyWorld(11), quiet)))});
    await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
    await page.getByTitle('Close settings (✕)').click();
    await expect(page.getByTestId('build-version')).toHaveText(`v${BUILD_VERSION}`);
    for (const name of ['Eel', 'Predator', 'Flapper', 'Tadpole', 'Glider', 'Random'])
      await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
    const area = page.getByTestId('tank-viewport'), canvas = page.getByLabel('Aquatic simulation');
    const assertFilled = async () => {
      const a = (await area.boundingBox())!, c = (await canvas.boundingBox())!;
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(a[key] - c[key])).toBeLessThan(1);
      await expect.poll(() => canvas.evaluate(node => {
        const c = node as HTMLCanvasElement;
        const rect = c.getBoundingClientRect(); return Math.abs(c.width / rect.width - c.height / rect.height);
      })).toBeLessThan(.005);
    };
    const contained = async (id: string) => {
      const a = (await area.boundingBox())!, w = (await page.getByTestId(id).boundingBox())!;
      expect(w.x).toBeGreaterThanOrEqual(a.x); expect(w.y).toBeGreaterThanOrEqual(a.y);
      expect(w.x + w.width).toBeLessThanOrEqual(a.x + a.width + 1);
      expect(w.y + w.height).toBeLessThanOrEqual(a.y + a.height + 1);
    };
    await assertFilled();
    await page.getByTitle('Ecology & Physical Settings').click();
    const panel = page.getByTestId('settings-window');
    await contained('settings-window');
    await panel.getByRole('button', {name: 'Export Snapshot', exact: true}).scrollIntoViewIfNeeded();
    await expect(panel.getByRole('button', {name: 'Export Snapshot', exact: true})).toBeInViewport();
    // Exercise the actual browser resize handle rather than setting a synthetic dimension.
    const before = (await panel.boundingBox())!;
    await page.mouse.move(before.x + before.width - 3, before.y + before.height - 3);
    await page.mouse.down(); await page.mouse.move(before.x + before.width - 50, before.y + before.height - 45, {steps: 8}); await page.mouse.up();
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeLessThan(before.width - 20);
    // Drag against both lower edges and verify the entire panel stays above the toolbar.
    await panel.evaluate(node => { node.scrollTop = 0; });
    const header = panel.getByText('ENVIRONMENT & BRANCHING');
    await header.hover(); await page.mouse.down(); await page.mouse.move(viewport.width - 1, viewport.height - 1, {steps: 10}); await page.mouse.up();
    await contained('settings-window');
    await page.screenshot({path: info.outputPath('bounded-settings.png')});
    await page.getByTitle('Close settings (✕)').click();
    await page.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').click();
    await contained('bank-window');
    await page.getByTestId('specimen-row').last().scrollIntoViewIfNeeded();
    await expect(page.getByTestId('specimen-row').last()).toBeInViewport();
    await page.getByTestId('specimen-row').last().getByRole('button', {name: 'Spawn', exact: true}).click();
    await page.getByTitle('Close specimen bank (✕)').click();
    await page.getByTitle('Inspect Specimen Brain & Vision Rays').click();
    await contained('creature-inspector'); await contained('badge-window');
    await page.setViewportSize({width: 700, height: 500});
    await assertFilled(); await contained('creature-inspector'); await contained('badge-window');
    await page.getByTitle('Ecosystem Telemetry Graph').click();
    await contained('ledger-window');
    await page.getByTestId('ledger-window').getByText('Recorded Losses & Rejections:').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('ledger-window').getByText('Recorded Losses & Rejections:')).toBeInViewport();
    expect(errors).toEqual([]);
  });
}

test('manual food buttons respect zero and saturated limits through the actual UI', async ({page}) => {
  await page.goto('./?autoplay'); await page.getByTitle('Ecology & Physical Settings').click();
  const read = async () => {
    await page.getByRole('button', {name: 'Copy Diagnostic Report', exact: true}).click();
    return JSON.parse(await page.getByLabel('Diagnostic report', {exact: true}).inputValue());
  };
  // Import a paused empty world so no foraging changes the count during button checks.
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
  const state = emptyWorld(33);
  await page.locator('input[type=file]').setInputFiles({name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createSnapshot(state, settings)))});
  await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  for (const name of ['Feed (F)', 'Feed All']) await page.getByRole('button', {name, exact: true}).click();
  expect((await read()).population.nutrients).toBe(0);
  const fullSettings = {...settings, targetNutrients: 3};
  const full = emptyWorld(33); sim.addNutrients(full, fullSettings, 3);
  await page.locator('input[type=file]').setInputFiles({name: 'full.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createSnapshot(full, fullSettings)))});
  await expect.poll(async () => (await read()).settings.targetNutrients).toBe(3);
  await expect(page.getByLabel('Nutrient target', {exact: true})).toHaveValue('3');
  for (const name of ['Feed (F)', 'Feed All']) await page.getByRole('button', {name, exact: true}).click();
  const report = await read(); expect(report.population.nutrients).toBe(3); expect(Math.abs(report.energy.errorJ)).toBeLessThan(.001);
});

test('import keeps the exact snapshot paused while replacing a fast-running world and its settings', async ({page}) => {
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
  const state = emptyWorld(99); state.simTime = 42;
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(99));
  g.parts = [g.parts[0]]; g.eyes = []; g.mouths = []; g.motorForce = 0;
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths); sim.ensureBrainLayout(g);
  const org = sim.spawnOrganism(g, 1200, 750, 0, undefined, undefined, state.prng);
  state.organisms.push(org); state.totalBirths = 1; state.ledger.externalInflow = org.energy + org.structuralBiomass;
  const snapshot = Buffer.from(JSON.stringify(createSnapshot(state, settings)));
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', {rate: 4});
  await page.goto('./?autoplay'); await page.getByTitle('Ecology & Physical Settings').click();
  const setRange = async (label: string | null, value: number) => {
    const input = label ? page.getByLabel(label, {exact: true}) : page.getByTestId('settings-window').locator('input[type=range]').first();
    await input.evaluate((node, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, String(v));
      node.dispatchEvent(new Event('input', {bubbles: true})); node.dispatchEvent(new Event('change', {bubbles: true}));
    }, value);
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    await setRange('Nutrient target', 800); await setRange(null, 150);
    await page.getByRole('button', {name: 'MAX', exact: true}).click();
    await page.locator('input[type=file]').setInputFiles({name: 'atomic.json', mimeType: 'application/json', buffer: snapshot});
    await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Copy Diagnostic Report', exact: true}).click();
    const report = JSON.parse(await page.getByLabel('Diagnostic report', {exact: true}).inputValue());
    expect(report.simTime).toBe(42); expect(report.population.nutrients).toBe(0);
    expect(report.settings.targetNutrients).toBe(0); expect(report.settings.inflowRate).toBe(0);
    expect(Math.abs(report.energy.errorJ)).toBeLessThan(.001);
    await page.getByRole('button', {name: 'RESUME SIMULATION', exact: true}).click();
  }
});

test.describe('high-density canvas', () => {
test.use({deviceScaleFactor: 2});
test('white eggs render white and actual feeding animates the mouth', async ({page}, info) => {
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 1, inflowRate: 0, waterViscosity: 0};
  const state = emptyWorld(21); state.caustics = [];
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(21));
  g.parts = [g.parts[0]]; g.eyes = []; g.motorForce = 0; sim.ensureBrainLayout(g);
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  const org = sim.spawnOrganism(g, 1200, 750, 0, undefined, undefined, state.prng);
  state.organisms.push(org); state.totalBirths = 1; state.ledger.externalInflow += org.energy + org.structuralBiomass;
  state.nutrients = [{id: 'food', x: 1200 + g.parts[0].width / 2, y: 750, vx: 0, vy: 0, energyValue: 3000, radius: 18, bottomTimer: 0}];
  state.ledger.externalInflow += 3000;
  state.eggs.push({id: 'white-egg', clutchId: 'c', parentOrgId: org.id, x: 1400, y: 750, vx: 0, vy: 0,
    genome: structuredClone(g), fundedReserve: 10000, fundedStructural: g.bodyCost, incubationProgress: 0,
    totalIncubationTime: 100, colorHue: 0, pulseTimer: 0, readyToHatch: false});
  state.ledger.externalInflow += 10000 + g.bodyCost;
  await page.addInitScript(() => {
    const translate = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function(x, y) {
      if (x < -100 && y < -100) {
        (window as any).cameraTranslation = [x, y];
        (window as any).cameraZoom = this.getTransform().a / window.devicePixelRatio;
      }
      return translate.call(this, x, y);
    };
    const original = CanvasRenderingContext2D.prototype.ellipse;
    (window as any).mouthOpenings = [];
    CanvasRenderingContext2D.prototype.ellipse = function(...args) {
      (window as any).mouthOpenings.push([args[2], args[3]]);
      if ((window as any).mouthOpenings.length > 100) (window as any).mouthOpenings.shift();
      return original.apply(this, args);
    };
  });
  await page.setViewportSize({width: 1360, height: 900}); await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.locator('input[type=file]').setInputFiles({name: 'visuals.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createSnapshot(state, settings)))});
  await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  const readPixel = () => page.getByLabel('Aquatic simulation').evaluate(node => {
    const c = node as HTMLCanvasElement;
    const rect = c.getBoundingClientRect(), dpr = c.width / rect.width;
    return [...c.getContext('2d')!.getImageData(Math.round((rect.width / 2 + 170) * dpr), Math.round(rect.height / 2 * dpr), 1, 1).data];
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({path: info.outputPath('white-egg-paused.png')});
  await expect.poll(async () => Math.min(...(await readPixel()).slice(0, 3))).toBeGreaterThan(210);
  const pixel = await readPixel();
  expect(Math.max(...pixel.slice(0, 3)) - Math.min(...pixel.slice(0, 3))).toBeLessThan(12);
  await page.getByTitle('Close settings (✕)').click();
  await page.getByRole('button', {name: 'RESUME SIMULATION', exact: true}).click();
  await page.evaluate(() => { (window as any).mouthOpenings = []; });
  await page.setViewportSize({width: 700, height: 500});
  const canvas = page.getByLabel('Aquatic simulation');
  const rect = (await canvas.boundingBox())!;
  await expect.poll(() => canvas.evaluate(node => (node as HTMLCanvasElement).width)).toBe(Math.round(rect.width * 2));
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await expect(page.getByTestId('badge-window')).toBeVisible();
  await page.getByTestId('badge-window').getByRole('button', {name: 'Inspect', exact: true}).click();
  await expect(page.getByTestId('creature-inspector')).toBeVisible();
  await expect.poll(() => page.evaluate(() => new Set((window as any).mouthOpenings.map((a: number[]) => a[1].toFixed(3))).size)).toBeGreaterThan(5);
  await expect.poll(() => page.evaluate(() => Math.max(...(window as any).mouthOpenings.map((a: number[]) => a[1])))).toBeGreaterThan(1.3);
  await page.screenshot({path: info.outputPath('white-egg-feeding.png')});
  await page.getByTitle('Close Diagnostics Window (✕)').click();
  const beforePan = await page.evaluate(() => (window as any).cameraTranslation[0]);
  const area = (await canvas.boundingBox())!;
  await page.mouse.move(area.x + area.width - 40, area.y + area.height / 2);
  await page.mouse.down(); await page.mouse.move(area.x + area.width - 120, area.y + area.height / 2, {steps: 8}); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).cameraTranslation[0])).toBeLessThan(beforePan - 30);
  await expect(page.getByTestId('creature-inspector')).toHaveCount(0);
  const beforeZoom = await page.evaluate(() => (window as any).cameraZoom);
  await page.mouse.wheel(0, -200);
  await expect.poll(() => page.evaluate(() => (window as any).cameraZoom)).toBeGreaterThan(beforeZoom);

});

});
