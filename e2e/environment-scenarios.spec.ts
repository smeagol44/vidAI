import {test, expect} from '@playwright/test';
import {build} from 'vite';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS, createSnapshot} from '../persistence';
import {createInitialWorld} from '../world';

test.setTimeout(60000);
let scenarioBrowserCode: string;
test.beforeAll(async () => {
  const built = await build({configFile: false, logLevel: 'silent', build: {
    write: false, minify: false, lib: {entry: 'tests/support/scenario-browser.ts',
      formats: ['iife'], name: 'scenarioReference'},
  }});
  const output = Array.isArray(built) ? built[0] : built;
  if (!('output' in output)) throw new Error('Missing scenario reference bundle');
  const chunk = output.output.find(file => file.type === 'chunk');
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing scenario reference code');
  scenarioBrowserCode = chunk.code;
});
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
  // Node and browser transcendental math may differ by one ULP. Generate the
  // exact reference in this browser instead of weakening state equality.
  await page.addScriptTag({content: scenarioBrowserCode});
  const selector = page.getByRole('combobox', {name: 'Environment scenario'});
  await expect(selector).toHaveValue('default');
  expect(await selector.locator('option').allTextContents()).toEqual(['🌎 Default', '⛰ Harsh World', 'Pipe World']);
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
  expect(normal.metadata.observerPreferences).toEqual({selectAddedCreature: true, trackSelectedCreature: true, showCaustics: true});
  expect(normal.settings).toMatchObject({worldWidth: 2400, worldHeight: 1500,
    waterViscosity: .18, gravity: 0, maxOrganisms: 30, inflowRate: 15, nutrientLimit: null});
  const start = fallback ? normal : await page.evaluate(() => (window as any).scenarioResets.at(-1));
  expect(start.state.simTime).toBe(0); expect(start.state.nutrients).toHaveLength(275);
  const expected = await page.evaluate(({settings, seed}) => {
    const reference = (window as any).scenarioReference;
    return reference.createSnapshot(reference.createInitialWorld(settings, seed), settings).state;
  }, {settings: start.settings, seed: start.state.initialSeed});
  expect(start.state).toEqual(expected);
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  await page.getByTitle('Game Menu').dispatchEvent('click');
  await page.getByRole('button', {name: 'MAIN MENU', exact: true}).dispatchEvent('click');
  await selector.selectOption('harsh-world');
  await page.screenshot({path: info.outputPath('environment-menu.png')});
  // Both existing alternative founder buttons combine with the environment.
  const preset = fallback ? 'megafauna' : 'predator_cove';
  await page.getByRole('button', {name: fallback ? 'Megafauna' : 'Predator Cove', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Pause', exact: true}).dispatchEvent('click');
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  const harsh = await read();
  expect(harsh.metadata.observerPreferences).toEqual({selectAddedCreature: false, trackSelectedCreature: false, showCaustics: false});
  expect(harsh.settings).toEqual({...normal.settings, inflowRate: 1, nutrientLimit: 200,
    worldWidth: 4800, worldHeight: 3000, gravity: 20, maxOrganisms: 50, waterViscosity: .4});
  const harshStart = fallback ? harsh : await page.evaluate(() => (window as any).scenarioResets.at(-1));
  expect(harshStart.state.simTime).toBe(0); expect(harshStart.state.nutrients).toHaveLength(0);
  expect(harshStart.state.organisms).toHaveLength(fallback ? 12 : 18);
  const planned = await page.evaluate(({settings, seed, preset}) => {
    const reference = (window as any).scenarioReference;
    const world = reference.createScenarioWorld(settings, 'harsh-world', seed, 'balanced', preset);
    const matchingDefault = reference.createInitialWorld(settings, seed, 'balanced', preset);
    return {state: reference.createSnapshot(world.state, world.settings).state,
      budget: matchingDefault.energyPool.budget};
  }, {settings: normal.settings, seed: harshStart.state.initialSeed, preset});
  expect(harshStart.state).toEqual(planned.state);
  expect(harshStart.state.energyPool.budget).toBe(planned.budget);
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
  await page.getByTitle('Game Menu').dispatchEvent('click');
  await page.getByRole('button', {name: 'MAIN MENU', exact: true}).dispatchEvent('click');
  await selector.selectOption('default');
  await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Pause', exact: true}).dispatchEvent('click');
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  expect((await read()).settings).toEqual(normal.settings);
  expect(errors).toEqual([]);
});

for (const fallback of [false, true]) test(`Pipe World startup, green icon and exact reload (${fallback ? 'fallback' : 'Worker'})`, async ({page}, info) => {
  await page.setViewportSize(fallback ? {width: 375, height: 812} : {width: 1280, height: 850});
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
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
  const before = await page.evaluate(() => (window as any).scenarioResets.length);
  await selector.selectOption('pipe-world');
  await expect(page.getByRole('img', {name: 'Green retro pipe'})).toBeVisible();
  const box = await selector.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await page.evaluate(() => (window as any).scenarioResets.length)).toBe(before);
  await page.screenshot({path: info.outputPath('pipe-world-menu.png')});
  await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Pause', exact: true}).dispatchEvent('click');
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  const read = async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  const pipe = await read();
  const start = fallback ? pipe : await page.evaluate(() => (window as any).scenarioResets.at(-1));
  expect(start.settings).toEqual({worldWidth: 4600, worldHeight: 2100, gravity: 20,
    waterViscosity: .4, inflowRate: 1, nutrientLimit: 200, targetNutrients: 275,
    nutrientPattern: 'uniform', maxOrganisms: 50, kinshipProtection: true, mutationSeverity: .25,
    physicsRegime: 'passive-work-v3', ecologyRegime: 'closed-v1', mouthContactModel: 'capsule-v1', nutrientCycle: 'decay-v2'});
  expect(start.state.simTime).toBe(0); expect(start.state.organisms).toHaveLength(18);
  expect(start.state.eggs).toHaveLength(0); expect(start.state.nutrients).toHaveLength(0);
  expect(start.state.selfTubes).toBeUndefined();
  expect(start.state.energyPool.reserve).toBe(825000);
  expect(pipe.schemaVersion).toBe('19.0.0');
  expect(pipe.metadata.observerPreferences).toEqual({selectAddedCreature: false, trackSelectedCreature: false, showCaustics: false});
  await expect(page.getByLabel('Tank width', {exact: true})).toHaveValue('4600');
  await expect(page.getByLabel('Tank height', {exact: true})).toHaveValue('2100');
  await page.clock.runFor(50);
  await page.screenshot({path: info.outputPath('pipe-world-started.png')});
  // Start another preset, then restore an edited Pipe snapshot. Neither the
  // selected preset nor its defaults may overwrite authoritative saved values.
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  await page.getByTitle('Game Menu').dispatchEvent('click');
  await page.getByRole('button', {name: 'MAIN MENU', exact: true}).dispatchEvent('click');
  await selector.selectOption('default');
  await expect(page.getByRole('img', {name: 'Green retro pipe'})).toHaveCount(0);
  await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).dispatchEvent('click');
  await page.getByRole('button', {name: 'Pause', exact: true}).dispatchEvent('click');
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  pipe.settings.gravity = -15; pipe.settings.inflowRate = 2; pipe.settings.nutrientLimit = 7;
  await page.locator('input[type=file]').setInputFiles({name: 'pipe-world.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(pipe))});
  await expect(page.getByLabel('Tank width', {exact: true})).toHaveValue('4600');
  await expect(page.getByLabel('Gravity', {exact: true})).toHaveValue('-15');
  const restored = await read();
  expect(restored.settings).toEqual(pipe.settings); expect(restored.state).toEqual(pipe.state);
  expect(restored.metadata.observerPreferences).toEqual(pipe.metadata.observerPreferences);
  expect(errors).toEqual([]);
});
