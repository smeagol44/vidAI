import {test, expect, type Locator} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import * as sim from '../simulation';
import {DEFAULT_SETTINGS, createSnapshot} from '../persistence';

test.use({viewport: {width: 1360, height: 900}});
test.setTimeout(90000);
async function range(input: Locator, value: number) {
  await input.evaluate((node, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, String(v));
    node.dispatchEvent(new Event('input', {bubbles: true}));
    node.dispatchEvent(new Event('change', {bubbles: true}));
  }, value);
}

test('catalogue, saved specimens, live brain graph and draggable inspector', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByText('By Hernán Garro & Federico Regueira', {exact: true}).last()).toBeVisible();
  await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).click();
  await page.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').click();
  const rows = page.getByTestId('specimen-row');
  await expect(rows).toHaveCount(55);
  await expect(rows.first().getByRole('button')).toHaveCount(1);
  // Native select keyboard actions must not trigger simulation hotkeys.
  await page.getByLabel('Body family').focus();
  await page.keyboard.press('Space'); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeHidden();
  await page.getByLabel('Body family').selectOption('Four paddles'); await expect(rows).toHaveCount(5);
  await page.getByLabel('Diet filter').selectOption('carnivore'); await expect(rows).toHaveCount(1);
  await rows.first().getByRole('button', {name: 'Spawn', exact: true}).click();
  await page.getByTitle('Close specimen bank (✕)').click();
  await page.getByTitle('Save to Specimen Bank', {exact: true}).click();
  await page.getByTitle('Inspect Specimen Brain & Vision Rays').click();
  const inspector = page.getByTestId('creature-inspector');
  await expect(page.getByRole('img', {name: 'Live recurrent neural network'})).toBeVisible();
  await expect(inspector.getByText('6-CH MOTORS', {exact: true})).toBeVisible();
  await expect(page.getByTestId('motor-telemetry')).toBeVisible();
  await expect(inspector.locator('text').filter({hasText: /^J1:Amp$/})).toHaveCount(1);
  await expect(inspector.locator('text').filter({hasText: /^J1:Engage$/})).toHaveCount(1);
  const before = await inspector.boundingBox();
  const header = inspector.getByText('RECURRENT BRAIN & DIAGNOSTICS');
  await header.hover(); await page.mouse.down(); await page.mouse.move(before!.x - 100, before!.y + 120, {steps: 8}); await page.mouse.up();
  const after = await inspector.boundingBox(); expect(after!.x).not.toBe(before!.x);
  const title = inspector.locator('circle title').filter({hasText: /^Hidden 1:/});
  const activation = await title.textContent();
  await expect.poll(() => title.textContent()).not.toBe(activation);
  await page.screenshot({path: test.info().outputPath('catalogue-inspector.png')});
  await page.reload(); await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).click();
  await page.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').click();
  await expect(page.getByTestId('specimen-row')).toHaveCount(52);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vida_specimen_bank_v3')!).length)).toBe(1);
  expect(errors).toEqual([]);
});

test('v5 snapshots import through the UI and export all six motor channels without shifting old weights', async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const source = await readFile(new URL('../tests/fixtures/v5-motor-world.json', import.meta.url), 'utf8');
  const original = JSON.parse(source).state.organisms[0];
  await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.locator('input[type=file]').setInputFiles({name: 'v5-motor-world.json', mimeType: 'application/json', buffer: Buffer.from(source)});
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export Snapshot', exact: true}).click();
  const download = await downloadPromise, saved = info.outputPath('migrated-motors.json'); await download.saveAs(saved);
  const snapshot = JSON.parse(await readFile(saved, 'utf8')), current = snapshot.state.organisms[0];
  expect(snapshot.schemaVersion).toBe('8.0.0'); expect(current.genome.brainVersion).toBe(4);
  expect(current.neuralOutputs).toHaveLength(36); expect(current.mouthFeedback).toBeDefined();
  original.genome.outputKeys.forEach((key: string, i: number) => {
    const currentIndex = current.genome.outputKeys.indexOf(key);
    expect(currentIndex).toBeGreaterThanOrEqual(0);
    expect(current.genome.weightsHO[currentIndex]).toEqual(original.genome.weightsHO[i]);
    expect(current.genome.biasesO[currentIndex]).toBe(original.genome.biasesO[i]);
  });
  expect(current.joints.every((j: sim.JointState) => j.amplitude === 1 && j.engagement === 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('sandbox controls, zero food, diagnostic report and snapshot restore', async ({page}, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await range(page.getByLabel('Nutrient target', {exact: true}), 0);
  await page.getByRole('button', {name: 'Clear Free Nutrients', exact: true}).click();
  await range(page.getByLabel('Tank width', {exact: true}), 1800);
  await range(page.getByLabel('Tank height', {exact: true}), 1000);
  await range(page.getByLabel('Gravity', {exact: true}), 10);
  await range(page.getByLabel('Maximum living creatures', {exact: true}), 1);
  await page.getByRole('button', {name: 'Copy Diagnostic Report', exact: true}).click();
  const report = JSON.parse(await page.getByLabel('Diagnostic report', {exact: true}).inputValue());
  expect(report.settings.targetNutrients).toBe(0); expect(report.population.nutrients).toBe(0);
  expect(report.settings.maxOrganisms).toBe(1); expect(report.settings.gravity).toBe(10);
  expect(Math.abs(report.energy.errorJ)).toBeLessThan(.001);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export Snapshot', exact: true}).click();
  const download = await downloadPromise, saved = info.outputPath('world.json'); await download.saveAs(saved);
  const snapshot = JSON.parse(await readFile(saved, 'utf8'));
  expect(snapshot.settings.worldWidth).toBe(1800); expect(snapshot.state.nutrientAccumulator).toBe(0);
  await range(page.getByLabel('Gravity', {exact: true}), -100);
  await page.locator('input[type=file]').setInputFiles(saved);
  await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await expect(page.getByLabel('Gravity', {exact: true})).toHaveValue('10');
  await expect(page.getByLabel('Nutrient target', {exact: true})).toHaveValue('0');
  await expect(page.getByLabel('Tank width', {exact: true})).toHaveValue('1800');
  await page.screenshot({path: info.outputPath('sandbox.png')});
  expect(errors).toEqual([]);
});

test('imported green omnivore and edible remains retain three diet labels and distinct food counts', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(13));
  g.hue = 120; g.colorMutationRate = 0;
  g.mouths[0].mouthType = 'herbivore';
  g.mouths.push({...g.mouths[0], id: 'second-mouth', direction: 'WEST', mouthType: 'carnivore'});
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  const prng = new sim.XoshiroPRNG(13);
  const org = sim.spawnOrganism(g, 1200, 750, 0, undefined, undefined, prng); org.energy = g.maxEnergyCapacity;
  const s: sim.SimulationState = {simTime: 0, initialSeed: 13, organisms: [org], eggs: [], nutrients: [],
    bubbles: [], caustics: [], prng, lineage: new Map(), recentDeaths: [], nutrientAccumulator: 0,
    totalBirths: 1, totalDeaths: 0, ledger: {externalInflow: org.energy + org.structuralBiomass,
      metabolicDissipation: 0, mechanicalWorkHeat: 0, recordedLosses: 0}};
  s.nutrients.push({id: 'remains', kind: 'carrion', decayTimeRemaining: 45, x: 1400, y: 850,
    vx: 0, vy: 0, radius: 18, energyValue: 3000, bottomTimer: 0, pulseTimer: 0});
  s.ledger.externalInflow += 3000;
  await page.addInitScript(genome => {
    localStorage.setItem('vida_specimen_bank_v3', JSON.stringify([{id: 'saved-combo', name: 'Green two-mouth specimen',
      savedAt: 'Test', genome, tags: ['custom']}]));
  }, g);
  await page.goto('./?autoplay');
  await page.getByTitle('Ecology & Physical Settings').click();
  await page.locator('input[type=file]').setInputFiles({name: 'pigment-and-remains.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(createSnapshot(s, settings)))});
  await page.getByRole('button', {name: 'Resume', exact: true}).click();
  await expect(page.getByText(/Remains:/)).toHaveText(/Remains: 1/);
  await expect(page.getByText(/Mixed:/)).toHaveCount(0);
  await page.getByRole('button', {name: 'Copy Diagnostic Report', exact: true}).click();
  const report = JSON.parse(await page.getByLabel('Diagnostic report', {exact: true}).inputValue());
  expect(report.population.diets).toEqual({Omnivore: 1});
  expect(report.population.carrion).toBe(1); expect(report.population.nutrients).toBe(0);
  expect(Math.abs(report.energy.errorJ)).toBeLessThan(.001);
  await page.screenshot({path: test.info().outputPath('pigment-and-remains.png')});
  await page.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').click();
  await page.getByLabel('Diet filter').selectOption('omnivore');
  await expect(page.getByTestId('specimen-row').filter({hasText: 'Green two-mouth specimen'})).toHaveCount(1);
  await page.getByLabel('Diet filter').selectOption('carnivore');
  await expect(page.getByTestId('specimen-row').filter({hasText: 'Green two-mouth specimen'})).toHaveCount(0);
  expect(errors).toEqual([]);
});
