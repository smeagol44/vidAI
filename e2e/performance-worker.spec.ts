import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS, createSnapshot} from '../persistence';
import {embodiedEnergy, setWorldEnergy} from '../energyEconomy';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createFounderGenome} from '../founders';

test.use({viewport: {width: 1280, height: 850}});
// Software-rendered tanks plus repeated import/download interactions can exceed
// 30s in CI. Keep individual assertion timeouts and all state checks unchanged.
test.setTimeout(60000);
for (const mainthread of [false, true]) test(`notifications expire and replacement/repeat restarts their lifetime (${mainthread ? 'fallback' : 'Worker'})`, async ({page}) => {
  await page.clock.install({time: new Date('2026-01-01T00:00:00Z')});
  // Freeze before navigation, so a busy canvas cannot outrun a pause deadline.
  await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
  await page.goto(`./?autoplay${mainthread ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  const settings = {...DEFAULT_SETTINGS, maxOrganisms: 1, targetNutrients: 0, inflowRate: 0};
  const source = createSnapshot(createInitialWorld(settings, 91, 'balanced', 'standard', 1), settings);
  await page.locator('input[type=file]').setInputFiles({name: 'full-population.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source))});
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  const notice = page.getByTestId('notification');
  await expect(notice).toContainText('Snapshot restored.');
  // Advance wall-clock timers while physics is paused. Skip intermediate canvas
  // frames: replaying every frame makes a wall-clock timer test renderer-bound.
  const addLife = () => page.getByRole('button', {name: 'Add Life', exact: true}).dispatchEvent('click');
  const capacityText = /No population slot|Population slots full/;
  await addLife(); await expect(notice).toContainText(capacityText);
  await page.clock.fastForward(1500);
  await addLife(); await expect(notice).toContainText(capacityText);
  await page.clock.fastForward(1500);
  await expect(notice).toContainText(capacityText); // repeated identical text gets a fresh lifetime
  await page.getByRole('button', {name: 'Clear Free Nutrients', exact: true}).dispatchEvent('click');
  await expect(notice).toContainText('Free nutrients cleared');
  await page.clock.fastForward(1500);
  await expect(notice).toContainText('Free nutrients cleared'); // predecessor must not clear replacement
  await page.clock.fastForward(1500);
  await expect(notice).toHaveCount(0);
  await addLife(); await expect(notice).toContainText(capacityText);
  await page.clock.fastForward(3000);
  await expect(notice).toHaveCount(0);
});
for (const mainthread of [false, true]) test(`closed-budget conversion, controls and exact export (${mainthread ? 'fallback' : 'Worker'})`, async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`./?autoplay${mainthread ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  await expect(page.getByLabel('Unlimited nutrients', {exact: true})).toBeChecked();
  const config = {...DEFAULT_SETTINGS, targetNutrients: 3, inflowRate: 0};
  const state = createInitialWorld(config, 91, 'balanced', 'standard', 1);
  state.ledger.recordedLosses += 100000000;
  const source = createSnapshot(state, config);
  const upload = (snapshot: unknown) => page.locator('input[type=file]').setInputFiles({name: 'economy.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot))});
  const read = async () => {
    const download = page.waitForEvent('download', {timeout: 10000});
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  await upload(source);
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Convert this world to a closed energy budget', exact: true}).dispatchEvent('click');
  await expect(page.getByTestId('closed-energy-controls')).toBeVisible();
  const converted = await read();
  expect(converted.schemaVersion).toBe('16.0.0');
  expect(converted.state.energyPool.budget).toBe(embodiedEnergy(state));
  expect(converted.state.energyPool.reserve).toBe(0);
  expect(converted.state.organisms).toEqual(source.state.organisms);
  expect(converted.state.prngState).toEqual(source.state.prngState);
  const budget = page.getByLabel('Total world energy', {exact: true});
  await expect(budget).toHaveValue(String(converted.state.energyPool.budget));
  await budget.focus();
  await budget.press('Home');
  await expect.poll(async () => (await read()).state.energyPool.budget).toBe(0);
  await budget.press('ArrowRight');
  await expect.poll(async () => (await read()).state.energyPool.budget).toBeGreaterThan(0);
  // An input/change pair must not restore the preceding authoritative value
  // while the Worker frame is in flight.
  await budget.evaluate(node => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, '0');
    node.dispatchEvent(new Event('input', {bubbles: true}));
    node.dispatchEvent(new Event('change', {bubbles: true}));
  });
  await expect.poll(async () => (await read()).state.energyPool.budget).toBe(0);
  const debt = await read();
  expect(debt.state.energyPool.reserve).toBe(-embodiedEnergy(state));
  await page.getByRole('button', {name: 'Clear Free Nutrients', exact: true}).dispatchEvent('click');
  await expect.poll(async () => (await read()).state.nutrients.length).toBe(0);
  const cleared = await read();
  expect(cleared.state.energyPool.reserve).toBe(debt.state.energyPool.reserve + 9000);
  const canvas = page.getByLabel('Aquatic simulation');
  const epoch = Number(await canvas.getAttribute('data-world-epoch'));
  await upload(cleared);
  await expect(canvas).toHaveAttribute('data-world-epoch', String(epoch + 1));
  expect((await read()).state).toEqual(cleared.state);
  expect(errors).toEqual([]);
});
for (const physicsRegime of ['paid-work-v2', 'surface-work-v1', 'legacy-v0'] as const) test(`worker imports/exports ${physicsRegime} and owns feeding/spawning while rendering stays independent`, async ({page}) => {
  const errors: string[] = []; const workers: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
  await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  const settings = {...DEFAULT_SETTINGS, physicsRegime, targetNutrients: 80, inflowRate: 0};
  const world = createInitialWorld({...settings, targetNutrients: 0}, 91, 'balanced', 'standard', 2);
  const source = createSnapshot(world, settings);
  if (physicsRegime === 'legacy-v0') {
    source.schemaVersion = '11.0.0'; delete (source.settings as Partial<typeof settings>).physicsRegime;
  }
  await page.locator('input[type=file]').setInputFiles({name: 'worker-test.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source))});
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  const exportState = async () => {
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'));
  };
  expect((await exportState()).state).toEqual(source.state);
  expect(workers.some(url => url.includes('simulation.worker'))).toBe(true);
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await page.getByTitle('Close settings (✕)').click();
  await page.getByRole('button', {name: 'Feed (F)', exact: true}).click();
  await page.getByRole('button', {name: 'Add Life', exact: true}).click();
  // The simulation continues while the main thread is deliberately occupied.
  await page.evaluate(() => {const end = performance.now() + 200; while (performance.now() < end) { /* short bounded stall */ }});
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  const after = await exportState();
  expect(after.settings.physicsRegime).toBe(physicsRegime);
  expect(after.state.simTime).toBeGreaterThan(.1);
  expect(after.state.organisms).toHaveLength(3);
  expect(after.state.nutrients.length).toBeGreaterThan(0);
  expect(after.state.nutrients.length).toBeLessThanOrEqual(15);
  expect((await exportState()).state).toEqual(after.state);
  expect(errors).toEqual([]);
});

test('new worlds use requested defaults and creature clicks keep diagnostics closed until Inspect', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  // Prove that initial seed comes from the random source, while keeping this
  // UI regression deterministic. Ordinary application runs use real entropy.
  await page.addInitScript(() => {
    const host = crypto as unknown as {getRandomValues(values: Uint32Array): Uint32Array};
    const original = host.getRandomValues.bind(crypto);
    host.getRandomValues = values => {
      const filled = original(values);
      if (filled instanceof Uint32Array && filled.length === 1) filled[0] = 123456789;
      return filled;
    };
  });
  await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await expect(page.getByLabel('Unlimited nutrients', {exact: true})).toBeChecked();
  await expect(page.getByTestId('closed-energy-controls')).toBeVisible();
  await expect(page.getByLabel('Maximum creatures + eggs', {exact: true})).toHaveValue('30');
  await expect(page.locator('#simulation-seed')).toHaveValue('123456789');
  await expect(page.getByTestId('mouth-contact-model')).toContainText('Full rounded aperture');
  await expect(page.getByTestId('build-version')).toHaveText('v0.39.0');

  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
  const state = createInitialWorld(settings, 91, 'balanced', 'standard', 0);
  const genome = createFounderGenome('FND-001'); genome.motorForce = 0;
  addExternalOrganism(state, genome, settings, 1200, 750, 0);
  await page.locator('input[type=file]').setInputFiles({name: 'selection.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(createSnapshot(state, settings)))});
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await page.getByTitle('Close settings (✕)').click();
  const canvas = page.getByLabel('Aquatic simulation'), bounds = (await canvas.boundingBox())!;
  await canvas.click({position: {x: bounds.width / 2, y: bounds.height / 2}});
  const badge = page.getByTestId('badge-window'), inspector = page.getByTestId('creature-inspector');
  await expect(badge).toBeVisible(); await expect(inspector).toHaveCount(0);
  await badge.getByRole('button', {name: 'Inspect', exact: true}).click();
  await expect(inspector).toBeVisible();
  const pruning = inspector.getByLabel('Pruning threshold', {exact: true});
  await expect(pruning).toHaveValue('0.5');
  await expect.poll(() => inspector.locator('svg circle').count()).toBeGreaterThan(0);
  await pruning.evaluate(node => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, '0.1');
    node.dispatchEvent(new Event('input', {bubbles: true})); node.dispatchEvent(new Event('change', {bubbles: true}));
  });
  await expect(pruning).toHaveValue('0.1');
  await page.getByTitle('Close Diagnostics Window (✕)').click();
  await badge.getByRole('button', {name: 'Inspect', exact: true}).click();
  await expect(inspector.getByLabel('Pruning threshold', {exact: true})).toHaveValue('0.5');
  expect(errors).toEqual([]);
});

for (const fallback of [false, true]) test(`legacy import and current reset agree in ${fallback ? 'fallback' : 'Worker'}`, async ({page}) => {
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').click();
  const settings={...DEFAULT_SETTINGS,physicsRegime:'legacy-v0' as const,targetNutrients:0,inflowRate:0};
  const source=createSnapshot(createInitialWorld(settings,91,'balanced','standard',2),settings);
  source.schemaVersion='11.0.0';delete (source.settings as Partial<typeof settings>).physicsRegime;
  await page.locator('input[type=file]').setInputFiles({name:'old-world.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
  await expect(page.getByTestId('physics-regime')).toContainText('Legacy');
  const exportState=async()=>{
    const downloaded=page.waitForEvent('download');
    await page.getByRole('button',{name:'Export Snapshot',exact:true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await downloaded).path())!,'utf8'));
  };
  expect((await exportState()).settings.physicsRegime).toBe('legacy-v0');
  await expect(page.getByTestId('mouth-contact-model')).toContainText('Legacy saved geometry');
  await page.getByRole('button', {name: 'Update mouth contact geometry', exact: true}).dispatchEvent('click');
  await expect(page.getByTestId('mouth-contact-model')).toContainText('Full rounded aperture');
  const updated = await exportState();
  expect(updated.schemaVersion).toBe('16.0.0'); expect(updated.settings.mouthContactModel).toBe('capsule-v1');
  expect(updated.settings.physicsRegime).toBe('legacy-v0'); expect(updated.state).toEqual(source.state);
  await page.getByRole('button', {name: 'Stabilize joint solver in this world', exact: true}).dispatchEvent('click');
  await expect(page.getByTestId('physics-regime')).toContainText('passive joint solver');
  const stabilized = await exportState();
  expect(stabilized.schemaVersion).toBe('16.0.0'); expect(stabilized.settings.physicsRegime).toBe('passive-work-v3');
  expect(stabilized.state).toEqual(source.state);
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await page.getByTitle('Close settings (✕)').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'RESEED SOUP',exact:true}).click();
  await page.getByTitle('Ecology & Physical Settings').click();
  await expect(page.getByTestId('physics-regime')).toContainText('Restored swimming');
  await page.keyboard.press('Space');
  const reset=await exportState();expect(reset.settings.physicsRegime).toBe('passive-work-v3');
  expect(reset.schemaVersion).toBe('16.0.0'); expect(reset.settings.mouthContactModel).toBe('capsule-v1');
  expect(reset.state.organisms.some((o: any)=>o.motorDiagnostics?.positiveWorkJ>0)).toBe(true);
  expect(errors).toEqual([]);
});

test('repairing a surface-model world preserves its exact paused ecosystem',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./?autoplay');await page.getByTitle('Ecology & Physical Settings').click();
  const settings={...DEFAULT_SETTINGS,physicsRegime:'surface-work-v1' as const,targetNutrients:0,inflowRate:0};
  const state=createInitialWorld(settings,91,'balanced','standard',2);
  const source=createSnapshot(state,settings);
  await page.locator('input[type=file]').setInputFiles({name:'surface-world.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await expect(page.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Repair swimming in this world',exact:true}).dispatchEvent('click');
  await expect(page.getByTestId('physics-regime')).toContainText('Restored swimming');
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export Snapshot',exact:true}).dispatchEvent('click');
  const repaired=JSON.parse(await readFile((await (await downloaded).path())!,'utf8'));
  expect(repaired.settings.physicsRegime).toBe('passive-work-v3');expect(repaired.state).toEqual(source.state);
  expect(errors).toEqual([]);
});

for (const fallback of [false, true]) test(`x0 unifies Pause, Space and speed selection (${fallback ? 'fallback' : 'Worker'})`, async ({page}) => {
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  const speeds = page.getByRole('group', {name: 'Simulation speed', exact: true});
  const speed = (value: number) => speeds.getByRole('button', {name: `${value}x`, exact: true});
  const indicator = page.getByTestId('simulation-activity');
  await speed(5).click(); await expect(speed(5)).toHaveAttribute('aria-pressed', 'true');
  await expect(indicator).toHaveAttribute('data-state', 'valid');
  await expect(indicator).toHaveAccessibleName(/Requested: x5.*Actual:/);
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(speed(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(indicator).toHaveAttribute('data-state', 'paused');
  await expect(indicator).toHaveAccessibleName('Simulation advancement paused (0x).');
  await expect(page.getByText('SIMULATION PAUSED', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await expect(speed(5)).toHaveAttribute('aria-pressed', 'true');
  await expect(indicator).toHaveAttribute('data-state', 'valid');
  await speed(0).click(); await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  await expect(indicator).toHaveAttribute('data-state', 'paused');
  await page.keyboard.press('Space'); await expect(speed(5)).toHaveAttribute('aria-pressed', 'true');
  await expect(indicator).toHaveAttribute('data-state', 'valid');
  await page.keyboard.press('Space'); await expect(speed(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(indicator).toHaveAttribute('data-state', 'paused');
  await speed(2).click(); await expect(page.getByRole('button', {name: 'Pause', exact: true})).toBeVisible();
  await page.keyboard.press('Space'); await expect(speed(0)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space'); await expect(speed(2)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Menu', exact: true}).click();
  await expect(speed(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('SIMULATION MENU', {exact: true})).toBeVisible();
  await expect(indicator).toHaveAttribute('data-state', 'paused');
  await page.getByRole('button', {name: 'RESUME', exact: true}).click();
  await expect(speed(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(indicator).toHaveAttribute('data-state', 'valid');
  for (const name of ['0x', '1x', '2x', '5x', '10x', '20x', 'MAX'])
    await expect(speeds.getByRole('button', {name, exact: true})).toBeVisible();
});

for (const fallback of [false, true]) test(`x0 allows inspection, navigation and authoritative manual edits without ticks (${fallback ? 'fallback' : 'Worker'})`, async ({page}) => {
  // Multiple authoritative downloads plus camera/panel interactions exceed 60s
  // on a busy software-rendered CI runner. Keep each assertion's limit unchanged.
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  // Observe the actual tank camera matrix without adding application test hooks.
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.strokeRect;
    CanvasRenderingContext2D.prototype.strokeRect = function(x, y, w, h) {
      if (this.canvas.getAttribute('aria-label') === 'Aquatic simulation' && x === 0 && y === 0) {
        const {a, d, e, f} = this.getTransform();
        (window as unknown as {tankMatrix: number[]}).tankMatrix = [a, d, e, f];
      }
      return original.call(this, x, y, w, h);
    };
  });
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  const settings = {...DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3' as const,
    ecologyRegime: 'closed-v1' as const, nutrientLimit: null, mouthContactModel: 'capsule-v1' as const,
    targetNutrients: 0, inflowRate: 0, maxOrganisms: 2};
  const world = createInitialWorld(settings, 91, 'balanced', 'standard', 0);
  // Fund manual additions through the ordinary budget API, never a runtime subsidy.
  setWorldEnergy(world, 500000);
  addExternalOrganism(world, createFounderGenome('FND-001'), settings, settings.worldWidth / 2, settings.worldHeight / 2, 0);
  expect(world.organisms).toHaveLength(1);
  const source = createSnapshot(world, settings);
  const upload = (snapshot: unknown) => page.locator('input[type=file]').setInputFiles({name: 'paused.json',
    mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot))});
  const read = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).click();
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  await page.getByTitle('Ecology & Physical Settings').click();
  await upload(source);
  await expect(page.getByRole('button', {name: '0x', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('simulation-activity')).toHaveAttribute('data-state', 'paused');
  expect((await read()).state).toEqual(source.state);
  await page.getByTitle('Close settings (✕)').click();
  const canvas = page.getByLabel('Aquatic simulation'), bounds = (await canvas.boundingBox())!;
  await canvas.click({position: {x: bounds.width / 2, y: bounds.height / 2}});
  const badge = page.getByTestId('badge-window'); await expect(badge).toBeVisible();
  await badge.getByRole('button', {name: 'Inspect', exact: true}).click();
  const inspector = page.getByTestId('creature-inspector'); await expect(inspector).toBeVisible();
  await expect.poll(() => inspector.locator('svg circle').count()).toBeGreaterThan(0);
  await page.getByTitle('Close Diagnostics Window (✕)').click();
  await page.keyboard.press('Escape');
  const matrix = () => page.evaluate(() => (window as unknown as {tankMatrix: number[]}).tankMatrix);
  const before = await matrix();
  await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .7);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * .7 + 80, bounds.y + bounds.height * .7 + 30, {steps: 8});
  await page.mouse.up();
  await expect.poll(async () => (await matrix())[2]).not.toBe(before[2]);
  await canvas.hover(); await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await matrix())[0]).toBeGreaterThan(before[0]);
  await page.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').click();
  await expect(page.getByTestId('specimen-row').first()).toBeVisible();
  await page.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').click();
  await page.getByRole('button', {name: 'Feed (F)', exact: true}).click();
  await expect(page.getByRole('group', {name: /^Food: 15 /})).toBeVisible();
  await page.getByRole('button', {name: 'Add Life', exact: true}).click();
  await expect(page.getByRole('group', {name: 'Alive: 2', exact: true})).toBeVisible();
  await expect(badge).toBeVisible();
  await page.getByTitle('Ecology & Physical Settings').click();
  const edited = await read();
  expect(edited.state.simTime).toBe(source.state.simTime);
  expect(edited.state.organisms).toHaveLength(2);
  expect(edited.state.organisms[0]).toEqual(source.state.organisms[0]);
  expect(edited.state.organisms[1].age).toBe(0);
  expect(edited.state.nutrients).toHaveLength(15);
  expect(edited.state.ledger).toEqual(source.state.ledger);
  expect(edited.state.energyPool.budget).toBe(source.state.energyPool!.budget);
  await page.waitForTimeout(250);
  expect((await read()).state).toEqual(edited.state);
  await page.getByRole('button', {name: 'Clear Free Nutrients', exact: true}).click();
  await expect(page.getByRole('group', {name: /^Food: 0 /})).toBeVisible();
  const cleared = await read();
  expect(cleared.state.nutrients).toHaveLength(0);
  expect(cleared.state.energyPool.reserve).toBe(edited.state.energyPool.reserve + 45000);
  expect(cleared.state.organisms).toEqual(edited.state.organisms);
  expect(cleared.state.simTime).toBe(source.state.simTime);
  await page.getByLabel('Maximum creatures + eggs', {exact: true}).focus();
  await page.getByLabel('Maximum creatures + eggs', {exact: true}).press('ArrowRight');
  await expect.poll(async () => (await read()).settings.maxOrganisms).toBe(3);
  const exact = await read(); await upload(exact);
  expect((await read()).state).toEqual(exact.state);
  await expect(page.getByRole('button', {name: '0x', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

for (const fallback of [false, true]) test(`performance pulse preserves exact phase/color across pause and manual edits (${fallback ? 'fallback' : 'Worker'})`, async ({page}) => {
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  const settings = {...DEFAULT_SETTINGS, ecologyRegime: 'closed-v1' as const, nutrientLimit: null,
    physicsRegime: 'passive-work-v3' as const, targetNutrients: 0, inflowRate: 0};
  const world = createInitialWorld(settings, 11, 'balanced', 'standard', 0); setWorldEnergy(world, 500000);
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.locator('input[type=file]').setInputFiles({name: 'performance.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createSnapshot(world, settings)))});
  const dot = page.getByTestId('simulation-activity');
  await expect(dot).toHaveAttribute('data-state', 'paused');
  await page.getByTitle('Close settings (✕)').click();
  await page.getByRole('button', {name: '5x', exact: true}).click();
  await expect(dot).toHaveAttribute('data-state', 'valid');
  await expect.poll(() => dot.evaluate(node => node.getAnimations().find(a => a.id === 'simulation-throughput-pulse')?.playState)).toBe('running');
  const expansion = await dot.evaluate(node => {
    const animation = node.getAnimations().find(a => a.id === 'simulation-throughput-pulse')!;
    const originalTime = animation.currentTime, wasRunning = animation.playState === 'running';
    const header = node.closest('header')!;
    const surroundings = () => [header, node.nextElementSibling!, header.querySelector('[aria-label="Simulation speed"]')!].map(element => {
      const box = element.getBoundingClientRect();
      return [box.x, box.y, box.width, box.height];
    });
    animation.pause();
    try {
      // Sample one real browser-rendered cycle synchronously, then restore it.
      return [0, 250, 500, 999.9].map(time => {
        animation.currentTime = time;
        const box = node.getBoundingClientRect(), style = getComputedStyle(node);
        const matrix = new DOMMatrixReadOnly(style.transform);
        return {width: box.width, height: box.height, opacity: Number(style.opacity),
          layoutWidth: node.clientWidth, layoutHeight: node.clientHeight,
          layoutPosition: [(node as HTMLElement).offsetLeft, (node as HTMLElement).offsetTop],
          origin: style.transformOrigin.split(/\s+/).slice(0, 2).map(Number.parseFloat),
          translation: [matrix.e, matrix.f], surroundings: surroundings()};
      });
    } finally {
      animation.currentTime = originalTime;
      if (wasRunning) animation.play();
    }
  });
  expect(expansion[0].width).toBeCloseTo(12, 1);
  expect(expansion[0].opacity).toBe(1);
  expect(expansion[3].width).toBeCloseTo(30, 1);
  expect(expansion[3].height).toBeCloseTo(30, 1);
  expect(expansion[3].opacity).toBeLessThan(.001);
  for (let i = 0; i < expansion.length; i++) {
    expect(expansion[i].layoutWidth).toBe(12); expect(expansion[i].layoutHeight).toBe(12);
    expect(expansion[i].surroundings).toEqual(expansion[0].surroundings);
    // Transformed DOMRects can be rounded differently by browser engines.
    // Assert the exact layout position and centered, translation-free transform.
    expect(expansion[i].layoutPosition).toEqual(expansion[0].layoutPosition);
    expect(expansion[i].origin).toEqual([6, 6]);
    expect(expansion[i].translation).toEqual([0, 0]);
    if (i > 0) {
      expect(expansion[i].width).toBeGreaterThan(expansion[i - 1].width);
      expect(expansion[i].opacity).toBeLessThan(expansion[i - 1].opacity);
    }
  }
  await expect(dot).not.toHaveAttribute('title');
  // The pulsing transform never becomes stable for Playwright's hover action.
  // Move the real pointer to its center while leaving the animation running.
  const bounds = await dot.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await expect.poll(() => dot.evaluate(node => node.matches(':hover'))).toBe(true);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('button', {name: 'Pause', exact: true}).evaluate(button => {
    button.addEventListener('click', () => {
      const node = document.querySelector('[data-testid=simulation-activity]')!;
      const a = node.getAnimations().find(a => a.id === 'simulation-throughput-pulse')!;
      const style = getComputedStyle(node);
      (window as any).pulseAtPause = {time: a.currentTime, opacity: style.opacity, transform: style.transform, color: style.backgroundColor, animation: a};
    }, {capture: true, once: true});
  });
  await page.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(dot).toHaveAttribute('data-state', 'paused');
  const held = await dot.evaluate(node => {
    const a = node.getAnimations().find(a => a.id === 'simulation-throughput-pulse')!;
    const style = getComputedStyle(node), before = (window as any).pulseAtPause;
    return {time: Number(a.currentTime), before: Number(before.time), opacity: style.opacity, beforeOpacity: before.opacity,
      transform: style.transform, beforeTransform: before.transform, color: style.backgroundColor, beforeColor: before.color, sameAnimation: a === before.animation};
  });
  expect(Math.abs(held.time - held.before)).toBeLessThan(1);
  expect(held.opacity).toBe(held.beforeOpacity); expect(held.transform).toBe(held.beforeTransform);
  expect(held.color).toBe(held.beforeColor); expect(held.sameAnimation).toBe(true);
  await page.getByRole('button', {name: 'Feed (F)', exact: true}).click();
  await expect(page.getByRole('group', {name: /^Food: 15 /})).toBeVisible();
  await page.waitForTimeout(400);
  const after = await dot.evaluate(node => {
    const style = getComputedStyle(node), a = node.getAnimations().find(a => a.id === 'simulation-throughput-pulse')!;
    return {time: Number(a.currentTime), opacity: style.opacity, transform: style.transform, color: style.backgroundColor};
  });
  expect(after).toEqual({time: held.time, opacity: held.opacity, transform: held.transform, color: held.color});
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await expect(dot).toHaveAttribute('data-state', 'valid');
  await expect.poll(() => dot.evaluate(node => Number(node.getAnimations().find(a => a.id === 'simulation-throughput-pulse')!.currentTime))).toBeGreaterThan(held.time);
  await expect.poll(() => dot.evaluate(node => getComputedStyle(node).transform)).not.toBe(held.transform);
  expect(await dot.evaluate(node => node.getAnimations().find(a => a.id === 'simulation-throughput-pulse') === (window as any).pulseAtPause.animation)).toBe(true);
  await expect(dot).not.toHaveAttribute('title');
});

for (const fallback of [false, true]) test(`MAX exceeds its visual reference, remains white and respects reduced motion without hover UI (${fallback ? 'fallback' : 'Worker'})`, async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  const settings = {...DEFAULT_SETTINGS, ecologyRegime: 'closed-v1' as const, nutrientLimit: null, targetNutrients: 0, inflowRate: 0};
  const source = createSnapshot(createInitialWorld(settings, 11, 'balanced', 'standard', 0), settings);
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.locator('input[type=file]').setInputFiles({name:'empty-max.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await page.getByTitle('Close settings (✕)').click();
  await page.getByRole('button', {name:'MAX',exact:true}).click();
  const dot=page.getByTestId('simulation-activity');
  await expect(dot).toHaveAttribute('data-state','valid');
  await expect.poll(async()=>Number(await dot.getAttribute('data-actual-speed'))).toBeGreaterThan(75);
  await expect(dot).toHaveAttribute('data-pulse-frequency','2.5');
  await expect(dot).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(dot).not.toHaveAttribute('title'); await dot.hover(); await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(dot).toHaveAccessibleName(/MAX mode.*not an execution limit/);
  const before=await dot.evaluate(n=>Number(n.getAnimations().find(a=>a.id==='simulation-throughput-pulse')!.currentTime));
  await page.waitForTimeout(300);
  expect(await dot.evaluate(n=>Number(n.getAnimations().find(a=>a.id==='simulation-throughput-pulse')!.currentTime))).toBe(before);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect.poll(()=>dot.evaluate(n=>n.getAnimations().find(a=>a.id==='simulation-throughput-pulse')!.playState)).toBe('running');
  if (fallback) return;
  // Small paired render-cost check in the same empty closed world. Hiding this
  // 12px presentation element does not touch the Worker, world or measurement.
  const visible:number[]=[], hidden:number[]=[];
  for(let i=0;i<3;i++){
    await dot.evaluate(n=>(n as HTMLElement).style.visibility='visible'); await page.waitForTimeout(750);
    visible.push(Number(await dot.getAttribute('data-actual-speed')));
    await dot.evaluate(n=>(n as HTMLElement).style.visibility='hidden'); await page.waitForTimeout(750);
    hidden.push(Number(await dot.getAttribute('data-actual-speed')));
  }
  await dot.evaluate(n=>(n as HTMLElement).style.visibility='visible');
  console.log('Indicator paired empty-world throughput (presentation visible/hidden; not gameplay FPS):',JSON.stringify({visible,hidden}));
});
