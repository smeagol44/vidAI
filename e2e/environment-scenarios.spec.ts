import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS, createSnapshot} from '../persistence';
import {createInitialWorld} from '../world';
import {createScenarioWorld} from '../environmentScenarios';

type SnapshotState = ReturnType<typeof createSnapshot>['state'];
function expectInitialState(actual: SnapshotState, expected: SnapshotState) {
  // Node and browser transcendental math can differ by one ULP when placing
  // rotated body parts. Allow only subnanopixel initial x/y differences;
  // every other field and all imported/continued snapshots stay exact.
  const normalized = structuredClone(actual);
  expect(actual.organisms).toHaveLength(expected.organisms.length);
  for (let i = 0; i < expected.organisms.length; i++) {
    expect(actual.organisms[i].segments).toHaveLength(expected.organisms[i].segments.length);
    for (let j = 0; j < expected.organisms[i].segments.length; j++) {
      for (const key of ['x', 'y'] as const) {
        const value = expected.organisms[i].segments[j][key];
        expect(Math.abs(actual.organisms[i].segments[j][key] - value)).toBeLessThanOrEqual(1e-9);
        normalized.organisms[i].segments[j][key] = value;
      }
    }
  }
  expect(normalized).toEqual(expected);
}

test.setTimeout(60000);
for (const fallback of [false, true]) test(`environment dropdown, initial conditions, editable controls and exact imports (${fallback ? 'fallback' : 'Worker'})`, async ({page}, info) => {
  await page.setViewportSize(fallback ? {width: 375, height: 812} : {width: 1280, height: 850});
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  // Freeze window rAF only: fallback cannot tick before its initial export.
  // The real Worker keeps its own clock; observe its original reset packet.
  await page.clock.install({time: new Date('2026-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
  await page.addInitScript(() => {
    (window as any).scenarioResets = [];
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: any, ...rest: any[]) {
      if (message.type === 'reset') (window as any).scenarioResets.push(structuredClone(message.snapshot));
      return (post as any).call(this, message, ...rest);
    };
  });
  await page.goto(`./${fallback ? '?mainthread' : ''}`);
  const selector = page.getByRole('combobox', {name: 'Environment scenario'});
  await expect(selector).toHaveValue('default');
  expect(await selector.locator('option').allTextContents()).toEqual(['🌎 Default', '⛰ Harsh World']);
  const box = await selector.boundingBox();
  expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const read = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  // Choose Harsh, then Default again without creating or modifying a world.
  const resetsBefore = await page.evaluate(() => (window as any).scenarioResets.length);
  await selector.selectOption('harsh-world'); await selector.selectOption('default');
  expect(await page.evaluate(() => (window as any).scenarioResets.length)).toBe(resetsBefore);
  await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Pause', exact: true}).dispatchEvent('click');
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  const normal = await read();
  expect(normal.settings).toMatchObject({worldWidth: 2400, worldHeight: 1500,
    waterViscosity: .18, gravity: 0, maxOrganisms: 30, inflowRate: 15, nutrientLimit: null});
  const start = fallback ? normal : await page.evaluate(() => (window as any).scenarioResets.at(-1));
  expect(start.state.simTime).toBe(0); expect(start.state.nutrients).toHaveLength(275);
  const expected = createSnapshot(createInitialWorld(start.settings, start.state.initialSeed), start.settings);
  expectInitialState(start.state, expected.state);
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'MAIN MENU', exact: true}).dispatchEvent('click');
  await selector.selectOption('harsh-world');
  await page.screenshot({path: info.outputPath('environment-menu.png')});
  // Both existing alternative founder buttons combine with the environment.
  const preset = fallback ? 'megafauna' : 'predator_cove';
  await page.getByRole('button', {name: fallback ? 'Megafauna' : 'Predator Cove', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Pause', exact: true}).dispatchEvent('click');
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  const harsh = await read();
  expect(harsh.settings).toEqual({...normal.settings, inflowRate: 1, nutrientLimit: 200,
    worldWidth: 4800, worldHeight: 3000, gravity: 20, maxOrganisms: 50, waterViscosity: .4});
  const harshStart = fallback ? harsh : await page.evaluate(() => (window as any).scenarioResets.at(-1));
  expect(harshStart.state.simTime).toBe(0); expect(harshStart.state.nutrients).toHaveLength(0);
  expect(harshStart.state.organisms).toHaveLength(fallback ? 12 : 18);
  const planned = createScenarioWorld(normal.settings, 'harsh-world', harshStart.state.initialSeed, 'balanced', preset);
  expectInitialState(harshStart.state, createSnapshot(planned.state, planned.settings).state);
  const matchingDefault = createInitialWorld(normal.settings, harshStart.state.initialSeed, 'balanced', preset);
  expect(harshStart.state.energyPool.budget).toBe(matchingDefault.energyPool!.budget);
  expect(harshStart.state.energyPool.reserve).toBe(825000);
  for (const [label, value] of [['Tank width', '4800'], ['Tank height', '3000'], ['Gravity', '20'],
    ['Maximum creatures + eggs', '50'], ['Maximum nutrients', '200'], ['Nutrient recycling rate', '1'], ['Water viscosity', '0.4']]) {
    await expect(page.getByLabel(label, {exact: true})).toHaveValue(value);
  }
  await expect(page.getByLabel('Unlimited nutrients', {exact: true})).not.toBeChecked();
  await expect(page.getByLabel('Total world energy', {exact: true})).toHaveValue(String(harshStart.state.energyPool.budget));
  await page.getByLabel('Gravity', {exact: true}).evaluate(node => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, '25');
    node.dispatchEvent(new Event('input', {bubbles: true}));
  });
  expect((await read()).settings.gravity).toBe(25);
  // Selected Harsh must not override an imported saved environment or physics.
  const savedSettings = {...DEFAULT_SETTINGS, ecologyRegime: 'closed-v1' as const,
    nutrientLimit: 7, gravity: -15, inflowRate: 0, worldWidth: 1600, waterViscosity: .12};
  const saved = createSnapshot(createInitialWorld(savedSettings, 91, 'unbiased', 'standard', 2), savedSettings);
  await page.locator('input[type=file]').setInputFiles({name: 'saved-environment.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved))});
  await expect(page.getByLabel('Tank width', {exact: true})).toHaveValue('1600');
  const restored = await read();
  expect(restored.settings).toEqual(saved.settings); expect(restored.state).toEqual(saved.state);
  await page.clock.runFor(50); // paint the paused, imported tank for visual smoke
  await page.screenshot({path: info.outputPath('environment-restored.png')});
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'MAIN MENU', exact: true}).dispatchEvent('click');
  await selector.selectOption('default');
  await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Pause', exact: true}).dispatchEvent('click');
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  expect((await read()).settings).toEqual(normal.settings);
  expect(errors).toEqual([]);
});
