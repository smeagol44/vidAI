import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot} from '../persistence';

test.use({viewport: {width: 1360, height: 900}});
test.setTimeout(90000);
test('fresh defaults, five-design population, slotted bank preview and jellyfish spawn', async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  await page.getByTitle('Ecology & Physical Settings').click();
  await expect(page.getByLabel('Nutrient target', {exact: true})).toHaveValue('275');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export Snapshot', exact: true}).click();
  const snapshot = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(snapshot.schemaVersion).toBe('8.0.0');
  expect(snapshot.settings.targetNutrients).toBe(275);
  expect(snapshot.state.organisms).toHaveLength(18);
  expect(new Set(snapshot.state.organisms.map((o: any) => o.genome.id)).size).toBe(5);
  for (const o of snapshot.state.organisms) {
    expect(o.genome.anatomyVersion).toBe(1);
    expect([...o.genome.eyes, ...o.genome.mouths].every((x: any) => [0, 1, 2].includes(x.slot))).toBe(true);
  }
  await page.getByTitle('Close settings (✕)').click();
  await page.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').click();
  await expect(page.getByTestId('specimen-row')).toHaveCount(55);
  await page.getByLabel('Body family').selectOption('Bell swimmers');
  const jelly = page.getByTestId('specimen-row'); await expect(jelly).toHaveCount(1);
  await expect(jelly).toContainText('Moonbell Jellyfish');
  const preview = jelly.getByLabel('Moonbell Jellyfish body preview');
  await expect(preview.locator('polygon')).toHaveCount(5);
  await expect(preview.locator('circle')).toHaveCount(3);
  const circles = await preview.locator('circle').evaluateAll(nodes => nodes.map(n => [n.getAttribute('cx'), n.getAttribute('cy')]));
  expect(new Set(circles.map(x => x.join(','))).size).toBe(3);
  await jelly.getByRole('button', {name: 'Spawn', exact: true}).click();
  await page.getByTitle('Close specimen bank (✕)').click();
  await page.getByTitle('Inspect Specimen Brain & Vision Rays').click();
  await expect(page.getByTestId('motor-telemetry').locator(':scope > span')).toHaveCount(4);
  await page.getByTestId('creature-inspector').getByRole('button', {name: 'Tree', exact: true}).click();
  await expect(page.getByTestId('creature-inspector')).toContainText('Moonbell Jellyfish');
  await page.screenshot({path: info.outputPath('jellyfish-slotted-organs.png')});
  expect(errors).toEqual([]);
});

test('expanded organ layouts import and their retinal strip scrolls on a narrow screen', async ({page}) => {
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
  const g = createFounderGenome('FND-001'); g.parts = [{...g.parts[0], dimN: 10, dimM: 10, width: 70, height: 70}];
  g.eyes = []; g.mouths = []; g.motorForce = 0;
  for (const direction of sim.CARDINAL_DIRS) {
    for (const slot of [1, 2] as const) g.eyes.push({id: `eye-${direction}-${slot}`, partIndex: 0, direction, slot, range: 500, fov: 1});
    g.mouths.push({id: `mouth-${direction}`, partIndex: 0, direction, slot: 0, intakeWidth: 10, mouthType: 'omnivore'});
  }
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier); sim.remapBrain(g);
  const state = createInitialWorld(settings, 71, 'unbiased', 'standard', 0);
  addExternalOrganism(state, g, settings, 1200, 750, 0); sim.stepSimulation(state, settings, 1 / 60);
  await page.setViewportSize({width: 520, height: 900}); await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.locator('input[type=file]').setInputFiles({name: 'slotted.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createSnapshot(state, settings)))});
  await expect(page.getByRole('button', {name: 'RESUME SIMULATION', exact: true})).toBeVisible();
  await page.getByTitle('Close settings (✕)').click();
  await page.getByRole('button', {name: 'RESUME SIMULATION', exact: true}).click();
  const rect = (await page.getByLabel('Aquatic simulation').boundingBox())!;
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.getByTitle('Close Diagnostics Window (✕)').click();
  const badgeHeader = page.getByTestId('badge-window').locator('[class*=cursor-grab]').first();
  const h = (await badgeHeader.boundingBox())!;
  await badgeHeader.hover({position: {x: 20, y: 10}}); await page.mouse.down();
  await page.mouse.move(h.x + 20, h.y + 130, {steps: 8}); await page.mouse.up();
  const samples = page.getByLabel('Retinal samples', {exact: true});
  await expect(samples).toBeVisible();
  expect(await samples.evaluate(n => n.scrollWidth > n.clientWidth)).toBe(true);
  await samples.hover(); await page.mouse.wheel(900, 0);
  await expect.poll(() => samples.evaluate(n => n.scrollLeft)).toBeGreaterThan(100);
  await expect(samples.locator(':scope > div').last()).toBeInViewport();
  await page.getByTitle('Inspect Specimen Brain & Vision Rays').click();
  const inspector = page.getByTestId('creature-inspector');
  await inspector.getByRole('button', {name: 'Anatomy', exact: true}).click();
  await expect(inspector).toContainText('EYES (8)');
  await expect(inspector).toContainText('MOUTH APERTURES & DIET PERMISSIONS (4)');
});
