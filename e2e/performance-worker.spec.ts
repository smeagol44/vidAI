import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS, createSnapshot} from '../persistence';
import {createInitialWorld} from '../world';

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
