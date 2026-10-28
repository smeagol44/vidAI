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
      // Read both rectangles in the same browser frame while resizing.
      const [a,c] = await page.evaluate(() => ['[data-testid=tank-viewport]','canvas'].map(selector => {
        const r=document.querySelector(selector)!.getBoundingClientRect();
        return {x:r.x,y:r.y,width:r.width,height:r.height};
      }));
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
    await page.setViewportSize({width: 700, height: 500}); await settleToolbarLayout(page);
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

// Valid imported worlds exercise React/Worker updates without an expensive ecosystem.
function toolbarWorld(time: number, generation: number) {
  const state = emptyWorld(109);
  state.simTime = time;
  const genome = sim.createReferenceNematodeGenome(state.prng);
  genome.parts = [genome.parts[0]]; genome.eyes = []; genome.mouths = []; genome.motorForce = 0;
  genome.generation = generation; sim.ensureBrainLayout(genome);
  genome.bodyCost = sim.calculateBodyCost(genome.parts, genome.eyes, genome.mouths);
  const org = sim.spawnOrganism(genome, 1200, 750, 0, undefined, undefined, state.prng);
  state.organisms.push(org); state.totalBirths = 1;
  state.ledger.externalInflow = org.energy + org.structuralBiomass;
  return createSnapshot(state, {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, gravity: 0});
}

// ResizeObserver-based presentation decisions settle after the resize frame.
// Statistic-only checks below keep their immediate, unchanged geometry tolerance.
async function settleToolbarLayout(page: import('@playwright/test').Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('toolbar stays top-right with priority-ordered controls across widths', async ({page}) => {
  await page.goto('./?autoplay');
  const widths = [1920, 1600, 1536, 1512, 1511, 1500, 1366, 1280, 1152, 1151, 1024, 768, 640, 520, 390, 320];
  let at1512: {height: number; counterY: number; speedY: number; menuY: number} | undefined;

  for (const width of widths) {
    await page.setViewportSize({width, height: 900}); await settleToolbarLayout(page);
    const layout = await page.getByTestId('simulation-toolbar').evaluate(header => {
      const box = (element: Element) => {
        const r = element.getBoundingClientRect();
        return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom};
      };
      const controls = header.querySelector('.toolbar-controls')!;
      const action = (index: number) => box(controls.children[index]);
      const nodes = Array.from(controls.children).map(box);
      const collisions: string[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1) collisions.push(i + ':' + j);
        }
      }
      return {
        header: box(header),
        general: box(header.querySelector('.toolbar-general')!),
        counters: box(header.querySelector('.toolbar-counters')!),
        controls: box(controls),
        add: action(0), speed: action(1), bank: action(2),
        inspector: action(3), settings: action(4), ledger: action(5), menu: action(6),
        collisions, overflow: header.scrollWidth - header.clientWidth,
      };
    });

    expect(layout.collisions, 'overlapping controls at ' + width).toEqual([]);
    expect(layout.overflow, 'horizontal toolbar overflow at ' + width).toBeLessThan(2);
    expect(layout.menu.right, 'Menu must touch right padding at ' + width).toBeCloseTo(width - 12, 0);
    expect(layout.menu.y, 'Menu must remain in the first row at ' + width).toBeLessThan(layout.counters.y);
    if (width >= 640) {
      expect(layout.general.right, 'left and right regions intersect at ' + width)
        .toBeLessThanOrEqual(layout.controls.x + 1);
    }
    if (width >= 1600) {
      expect(Math.abs(layout.speed.y - layout.menu.y)).toBeLessThan(4);
      expect(Math.abs(layout.add.y - layout.menu.y)).toBeLessThan(4);
    } else if (width >= 1152) {
      expect(Math.abs(layout.bank.y - layout.menu.y)).toBeLessThan(4);
      expect(layout.add.y).toBeGreaterThan(layout.menu.y + 12);
      expect(Math.abs(layout.speed.y - layout.add.y)).toBeLessThan(4);
    } else if (width >= 640) {
      expect(Math.abs(layout.settings.y - layout.menu.y)).toBeLessThan(4);
      expect(layout.add.y).toBeGreaterThan(layout.menu.y + 12);
      expect(layout.speed.y).toBeGreaterThan(layout.add.y + 12);
    } else {
      expect(layout.menu.y).toBeLessThan(layout.settings.y);
      expect(layout.speed.y).toBeGreaterThan(layout.add.y + 12);
    }
    if (width === 1512) {
      at1512 = {height: layout.header.height, counterY: layout.counters.y,
        speedY: layout.speed.y, menuY: layout.menu.y};
    } else if (width === 1511) {
      expect(at1512).toBeDefined();
      expect(Math.abs(layout.header.height - at1512!.height)).toBeLessThan(1);
      expect(Math.abs(layout.counters.y - at1512!.counterY)).toBeLessThan(1);
      expect(Math.abs(layout.speed.y - at1512!.speedY)).toBeLessThan(1);
      expect(Math.abs(layout.menu.y - at1512!.menuY)).toBeLessThan(1);
    }
  }
});

test('toolbar stays grouped and hides credits only to avoid an extra row', async ({page}) => {
  await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.locator('input[type=file]').setInputFiles({name: 'grouped.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(toolbarWorld(0, 1)))});
  await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  await page.getByTitle('Close settings (✕)').click();
  const header = page.getByTestId('simulation-toolbar');
  let hidden = 0, visible = 0;
  for (const width of [1920,1600,1536,1512,1511,1366,1280,1200,1152,1100,1024,900,768,700,640,639,520,390,375,320,700,768,700,768]) {
    await page.setViewportSize({width, height: 900}); await settleToolbarLayout(page);
    await expect.poll(() => header.locator('.toolbar-general').evaluate(g => {
      const metrics = g.querySelector('.toolbar-metrics')!;
      const gap = parseFloat(getComputedStyle(metrics).columnGap);
      const required = [...metrics.children].reduce((n, el) => n + el.getBoundingClientRect().width, gap * 2);
      return (g.getAttribute('data-compact-metrics') === 'true') === (required > g.getBoundingClientRect().width);
    })).toBe(true);
    const geometry = await header.evaluate(h => {
      const g = h.querySelector<HTMLElement>('.toolbar-general')!;
      const m = h.querySelector<HTMLElement>('.toolbar-metrics')!;
      const c = h.querySelector<HTMLElement>('.toolbar-credits')!;
      const rect = (n: Element) => {const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {general:rect(g), metrics:rect(m), credits:rect(c), height:g.getBoundingClientRect().height,
        shown:getComputedStyle(c).visibility !== 'hidden', compact:g.dataset.compactMetrics === 'true',
        chips:[...m.children].map(rect), overflow:h.scrollWidth-h.clientWidth,
        menu:rect(h.querySelector('.toolbar-controls')!.lastElementChild!),
        parents:[...m.children].every(n=>n.parentElement === m)};
    });
    expect(geometry.overflow, 'toolbar overflow at '+width).toBeLessThan(2);
    expect(geometry.parents).toBe(true);
    for (const chip of geometry.chips) {
      expect(chip.x).toBeGreaterThanOrEqual(geometry.metrics.x - 1);
      expect(chip.right).toBeLessThanOrEqual(geometry.metrics.right + 1);
      expect(chip.y).toBeGreaterThanOrEqual(geometry.metrics.y - 1);
      expect(chip.bottom).toBeLessThanOrEqual(geometry.metrics.bottom + 1);
    }
    if (!geometry.compact) {
      for (const chip of geometry.chips) expect(Math.abs(chip.y-geometry.chips[0].y)).toBeLessThan(4);
    } else {
      expect(Math.abs(geometry.chips[0].y-geometry.chips[2].y)).toBeLessThan(4);
      expect(geometry.chips[1].y).toBeGreaterThan(geometry.chips[0].y);
    }
    if (geometry.shown) {
      visible++;
      expect(geometry.credits.right).toBeLessThanOrEqual(geometry.general.right+1);
      expect(Math.min(geometry.credits.right,geometry.menu.right)-Math.max(geometry.credits.x,geometry.menu.x)<=0
        || Math.min(geometry.credits.bottom,geometry.menu.bottom)-Math.max(geometry.credits.y,geometry.menu.y)<=0).toBe(true);
    } else hidden++;
    // Counterfactual layout proof: displaying hidden credits must add a row;
    // hiding visible credits must not reduce the already minimal height.
    const alternateHeight = await header.evaluate((h, shown) => {
      const c = h.querySelector<HTMLElement>('.toolbar-credits')!;
      const original = c.getAttribute('style');
      c.style.position = shown ? 'absolute' : 'static';
      c.style.visibility = shown ? 'hidden' : 'visible';
      const height = h.querySelector('.toolbar-general')!.getBoundingClientRect().height;
      if (original === null) c.removeAttribute('style'); else c.setAttribute('style', original);
      return height;
    }, geometry.shown);
    if (geometry.shown) expect(alternateHeight, 'credits add an unnecessary row at '+width).toBeGreaterThanOrEqual(geometry.height-1);
    else expect(alternateHeight, 'credits hidden without saving a row at '+width).toBeGreaterThan(geometry.height+1);
    if (width <= 639) {
      const mobile = await header.evaluate(h => {
        const controls=h.querySelector('.toolbar-controls')!;
        const indices=[0,2,3,4,5];
        const actions=indices.map(i=>controls.children[i].getBoundingClientRect());
        const speed=controls.children[1].getBoundingClientRect();
        return {actions:actions.map(r=>({y:r.y,width:r.width,bottom:r.bottom})),speed:{y:speed.y,width:speed.width},
          controlsWidth:controls.getBoundingClientRect().width,
          icons:h.querySelectorAll('.toolbar-counter-mobile-icon').length === 5 && [...h.querySelectorAll('.toolbar-counter-mobile-icon')].every(n=>n.getBoundingClientRect().width === 13 && getComputedStyle(n).display !== 'none'),
          labels:[...h.querySelectorAll('.toolbar-counter-label,.toolbar-food-limit')].every(n=>getComputedStyle(n).display === 'none'),
          names:[...h.querySelector('.toolbar-counters')!.children].every(n=>n.getAttribute('role') === 'group' && !!n.getAttribute('aria-label') && !!n.getAttribute('title'))};
      });
      expect(mobile.icons).toBe(true); expect(mobile.labels).toBe(true); expect(mobile.names).toBe(true);
      for (const action of mobile.actions) {
        expect(Math.abs(action.y-mobile.actions[0].y)).toBeLessThan(1);
        expect(Math.abs(action.width-mobile.actions[0].width)).toBeLessThan(1);
        expect(action.bottom).toBeLessThan(mobile.speed.y);
      }
      expect(Math.abs(mobile.speed.width-mobile.controlsWidth)).toBeLessThan(1);
    }
  }
  expect(hidden).toBeGreaterThan(0); expect(visible).toBeGreaterThan(0);
});

test('toolbar stays stable with naturally packed performance text', async ({page}) => {
  await page.setViewportSize({width:1920,height:1080}); await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.locator('input[type=file]').setInputFiles({name:'packed.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(toolbarWorld(0,1)))});
  await expect(page.getByRole('button',{name:'RESUME SIMULATION',exact:true})).toBeVisible();
  await page.getByTitle('Close settings (✕)').click();
  const performance = page.locator('.toolbar-performance');
  await expect(performance.locator('.toolbar-value')).toHaveCount(0);
  const box=(await performance.boundingBox())!;
  const tank=(await page.getByTestId('tank-viewport').boundingBox())!;
  for (const text of ['0x (1 FPS · 0 Steps/s)','50x (144 FPS · 3000 Steps/s)','999999x (999999 FPS · 999999 Steps/s)']) {
    const measured=await performance.evaluate((node,text)=>{
      node.querySelector('.toolbar-performance-text')!.textContent=text;
      const range=document.createRange();range.selectNodeContents(node.querySelector('.toolbar-performance-text')!);
      const r=node.getBoundingClientRect(),t=range.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,text:t.width,available:node.clientWidth-12};
    },text);
    for (const key of ['x','y','width','height'] as const) expect(Math.abs(measured[key]-box[key])).toBeLessThan(.5);
    expect(measured.text).toBeLessThanOrEqual(measured.available+1);
    expect(text).not.toMatch(/ {2,}/);
    expect(await page.getByTestId('tank-viewport').boundingBox()).toEqual(tank);
  }
});

for (const viewport of [
  {width: 1920, height: 1080}, {width: 1536, height: 864}, {width: 1366, height: 768},
  {width: 1280, height: 720}, {width: 1152, height: 768}, {width: 1151, height: 768},
  {width: 1024, height: 768}, {width: 1023, height: 768},
  {width: 768, height: 768}, {width: 640, height: 768}, {width: 520, height: 900},
  {width: 390, height: 844}, {width: 320, height: 720},
]) {
  test(`toolbar stays fixed across statistics and interactions at ${viewport.width}x${viewport.height}`, async ({page}, info) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize(viewport); await page.goto('./?autoplay');
    const toolbar = page.locator('header');
    const settings = page.getByTitle('Ecology & Physical Settings');
    const load = async (time: number, generation: number) => {
      await settings.click();
      await page.locator('input[type=file]').setInputFiles({name: 'toolbar.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(toolbarWorld(time, generation)))});
      await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
      await page.getByTitle('Close settings (✕)').click();
    };
    const measure = () => page.evaluate(() => {
      const rect = (node: Element) => {
        const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height};
      };
      const h = document.querySelector('header')!;
      return [h, document.querySelector('[data-testid=tank-viewport]')!, document.querySelector('canvas')!,
        ...h.querySelectorAll('button'), ...h.children[1].children, ...Array.from(h.children[0].children).slice(1)].map(rect);
    });
    const stable = async (before: Awaited<ReturnType<typeof measure>>) => {
      const after = await measure(); expect(after.length).toBe(before.length);
      after.forEach((r, i) => {
        for (const key of ['x', 'y', 'width', 'height'] as const)
          expect(Math.abs(r[key] - before[i][key]), `element ${i} ${key}`).toBeLessThan(.5);
      });
    };
    const reachable = async () => {
      const problems = await toolbar.evaluate(h => {
        const failures: string[] = [], bounds = h.getBoundingClientRect();
        const nodes = [...h.querySelectorAll('button'), ...h.children[1].children, ...h.children[0].children]
          .filter(n => n.getBoundingClientRect().width > 0);
        const rectangles = nodes.map(n => ({n, r: n.getBoundingClientRect()}));
        for (const {n, r} of rectangles) {
          if (r.left < 0 || r.right > innerWidth + 1 || r.top < bounds.top || r.bottom > bounds.bottom + 1)
            failures.push(`outside: ${n.textContent || n.getAttribute('title')} (${r.left}..${r.right})`);
          if (n.scrollWidth > n.clientWidth + 1) failures.push(`overflow: ${n.textContent}`);
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          if (!hit || !n.contains(hit)) failures.push(`occluded: ${n.textContent || n.getAttribute('title')}`);
        }
        for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
          const a = rectangles[i].r, b = rectangles[j].r;
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > .5
            && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .5) failures.push('overlap');
        }
        for (const n of h.querySelectorAll('.toolbar-value')) {
          if (n.scrollWidth > n.clientWidth + 1) failures.push(`numeric overflow: ${n.textContent}`);
        }
        return failures;
      });
      expect(problems).toEqual([]);
    };
    await load(0, 1); const small = await measure();
    // Both imports go through normal application state, including large generation/time.
    await load(9999999999.9, 999999); await stable(small); await reachable();
    await expect(toolbar.locator('.toolbar-generation .toolbar-value')).toHaveText('999999');
    await expect(toolbar.locator('.toolbar-time .toolbar-value')).toHaveText('9999999999.9');
    await load(1e20, 1e9); await stable(small); await reachable();
    await expect(toolbar.locator('.toolbar-generation .toolbar-value')).toHaveText('1e+9');
    await expect(toolbar.locator('.toolbar-time .toolbar-value')).toHaveText('1e+20');
    await expect(toolbar.locator('.toolbar-time .toolbar-value')).toHaveAttribute('title', String(1e20));
    // Stress all reserved slots, including FPS/rate/count extremes, without simulating
    // hundreds of organisms or changing production data/Worker behavior for the test.
    for (let iteration = 0; iteration < 12; iteration++) {
      await toolbar.locator('.toolbar-value').evaluateAll((nodes, i) => {
        for (const node of nodes) node.textContent = i % 2 ? '0' : '9'.repeat(parseInt((node as HTMLElement).style.width));
      }, iteration);
      await stable(small); await reachable();
    }
    await toolbar.locator('.toolbar-value').evaluateAll(nodes => {
      for (const node of nodes) node.textContent = (node as HTMLElement).title;
    });
    await load(0, 1);
    // Real advancing telemetry must also leave the toolbar and the hit target fixed.
    await page.getByRole('button', {name: 'RESUME SIMULATION', exact: true}).click();
    const time = toolbar.locator('.toolbar-time .toolbar-value');
    await expect.poll(async () => Number(await time.textContent())).toBeGreaterThan(0);
    for (let sample = 0; sample < 8; sample++) {
      await page.waitForTimeout(150); await stable(small); await reachable();
    }
    const canvas = page.getByLabel('Aquatic simulation'), c = (await canvas.boundingBox())!;
    await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
    await expect(page.getByTestId('badge-window')).toBeVisible();
    await toolbar.getByTitle('Inspect Specimen Brain & Vision Rays').click();
    await expect(page.getByTestId('creature-inspector')).toBeVisible();
    await page.getByTitle('Close Diagnostics Window (✕)').click();
    await toolbar.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').click();
    await expect(page.getByTestId('bank-window')).toBeVisible();
    await page.getByTitle('Close specimen bank (✕)').click();
    await toolbar.getByTitle('Ecosystem Telemetry Graph').click();
    await expect(page.getByTestId('ledger-window')).toBeVisible();
    await toolbar.getByTitle('Ecosystem Telemetry Graph').click();
    for (const speed of ['MAX', '1x']) {
      await toolbar.getByRole('button', {name: speed, exact: true}).click();
      await expect(toolbar.getByRole('button', {name: speed, exact: true})).toHaveClass(/bg-cyan-500/);
    }
    await toolbar.getByTitle('Seed Primordial Specimen').click();
    await expect.poll(async () => Number(await toolbar.locator('.toolbar-counters .toolbar-value').first().textContent())).toBe(2);
    await toolbar.getByTitle('Game Menu').click();
    await expect(page.getByRole('button', {name: 'RESUME', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'RESUME', exact: true}).click();
    await stable(small); await reachable();
    await page.screenshot({path: info.outputPath('stable-toolbar.png')});
    // Resize away and back: row changes must follow the viewport and be reversible.
    await page.setViewportSize({width: 520, height: 900}); await settleToolbarLayout(page); await reachable();
    await page.setViewportSize(viewport); await settleToolbarLayout(page); await stable(small); await reachable();
    expect(errors).toEqual([]);
  });
}
