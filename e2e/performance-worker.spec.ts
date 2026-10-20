import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS, createSnapshot} from '../persistence';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createFounderGenome} from '../founders';

test.use({viewport: {width: 1280, height: 850}});
test('worker imports/exports exact paused state and owns feeding/spawning while rendering stays independent', async ({page}) => {
  const errors: string[] = []; const workers: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
  await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 80, inflowRate: 0};
  const world = createInitialWorld({...settings, targetNutrients: 0}, 91, 'balanced', 'standard', 2);
  const source = createSnapshot(world, settings);
  await page.locator('input[type=file]').setInputFiles({name: 'worker-test.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source))});
  await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  const exportState = async () => {
    const downloaded = page.waitForEvent('download');
    // Paused overlay covers the settings button; dispatch its real handler
    // without resuming (and thereby changing the exact state under test).
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'));
  };
  expect((await exportState()).state).toEqual(source.state);
  expect(workers.some(url => url.includes('simulation.worker'))).toBe(true);
  await page.getByRole('button', {name: 'RESUME SIMULATION', exact: true}).click();
  await page.getByTitle('Close settings (✕)').click();
  await page.getByRole('button', {name: 'Feed (F)', exact: true}).click();
  await page.getByRole('button', {name: 'Add Life', exact: true}).click();
  // The simulation continues while the main thread is deliberately occupied.
  await page.evaluate(() => {const end = performance.now() + 200; while (performance.now() < end) { /* short bounded stall */ }});
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  const after = await exportState();
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
  await expect(page.getByLabel('Nutrient target', {exact: true})).toHaveValue('275');
  await expect(page.getByLabel('Maximum living creatures', {exact: true})).toHaveValue('30');
  await expect(page.locator('#simulation-seed')).toHaveValue('123456789');

  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
  const state = createInitialWorld(settings, 91, 'balanced', 'standard', 0);
  const genome = createFounderGenome('FND-001'); genome.motorForce = 0;
  addExternalOrganism(state, genome, settings, 1200, 750, 0);
  await page.locator('input[type=file]').setInputFiles({name: 'selection.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(createSnapshot(state, settings)))});
  await page.getByRole('button', {name: 'RESUME SIMULATION', exact: true}).click();
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
