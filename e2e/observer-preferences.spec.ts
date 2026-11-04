import {test, expect, type Locator} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SETTINGS, createSnapshot} from '../persistence';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createFounderGenome} from '../founders';
import {enableClosedEconomy, setWorldEnergy} from '../energyEconomy';

test.setTimeout(120000);
for (const fallback of [false, true]) test(`independent observer preferences, both spawn paths and exact imports (${fallback ? 'fallback' : 'Worker'})`, async ({page}, info) => {
  await page.setViewportSize({width: 1280, height: 850});
  // Paused-world policy checks need no continuous software-rendered tank.
  // Advance only the few frames used for physical picking and layout checks.
  await page.clock.install({time: new Date('2026-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
  const setChecked = async (checkbox: Locator, checked: boolean) => {
    if (await checkbox.isChecked() !== checked) await checkbox.dispatchEvent('click');
    await expect(checkbox).toBeChecked({checked});
  };
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const translate = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function(x, y) {
      translate.call(this, x, y);
      if (x === 1200 && y === 750) {
        const m = this.getTransform(); (window as any).originalCreaturePoint = {x: m.e / devicePixelRatio, y: m.f / devicePixelRatio};
      }
    };
  });
  await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);
  await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
  const read = async () => {
    const download = page.waitForEvent('download');
    // A native click grants Chromium the user activation required for each download.
    // Force skips frame-stability waiting while the test's presentation clock is paused.
    await page.getByRole('button', {name: 'Export Snapshot', exact: true}).click({force: true});
    return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  };
  const cfg = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
  const state = createInitialWorld(cfg, 126, 'balanced', 'standard', 0);
  addExternalOrganism(state, createFounderGenome('FND-001'), cfg, 1200, 750, 0);
  enableClosedEconomy(state); setWorldEnergy(state, 1e6);
  const config = {...cfg, ecologyRegime: 'closed-v1' as const, nutrientLimit: null};
  const source = createSnapshot(state, config);
  const canvas = page.getByLabel('Aquatic simulation'), badge = page.getByTestId('badge-window');
  const settings = page.getByTestId('settings-window');
  const openAdvanced = async () => {
    await settings.getByRole('button', {name: 'Advanced Settings', exact: true}).dispatchEvent('click');
    return page.getByRole('dialog', {name: 'Advanced Settings', exact: true});
  };
  const upload = async (snapshot: unknown) => {
    const epoch = Number(await canvas.getAttribute('data-world-epoch'));
    await page.locator('input[type=file]').setInputFiles({name: 'observer-preferences.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot))});
    await expect(canvas).toHaveAttribute('data-world-epoch', String(epoch + 1));
    await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
    // The epoch acknowledges replacement; reset then snapshot are FIFO Worker requests.
    expect((await read()).state).toEqual((snapshot as any).state);
  };
  const selectCenter = async () => {
    await page.clock.runFor(32);
    await expect.poll(() => page.evaluate(() => !!(window as any).originalCreaturePoint)).toBe(true);
    const point = await page.evaluate(() => (window as any).originalCreaturePoint);
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + point.x, box.y + point.y);
    await expect(badge).toHaveAttribute('data-organism-id', source.state.organisms[0].id);
  };
  for (const selectAddedCreature of [false, true]) for (const trackSelectedCreature of [false, true]) {
    await upload(source); await expect(badge).toHaveCount(0);
    const advanced = await openAdvanced();
    await expect(advanced.getByRole('checkbox')).toHaveCount(3);
    await setChecked(advanced.getByLabel('Automatically select added creatures', {exact: true}), selectAddedCreature);
    await setChecked(advanced.getByLabel('Automatically track selected creatures', {exact: true}), trackSelectedCreature);
    const configured = await read();
    expect(configured.state).toEqual(source.state); expect(configured.settings).toEqual(source.settings);
    expect(configured.metadata.observerPreferences).toEqual({selectAddedCreature, trackSelectedCreature, showCaustics: true});
    await advanced.getByTitle('Close advanced settings').dispatchEvent('click');
    await page.getByTitle('Close settings (✕)').dispatchEvent('click');
    await page.getByRole('button', {name: 'Add Life', exact: true}).dispatchEvent('click');
    if (selectAddedCreature) {
      await expect(badge).toBeVisible();
      await expect(badge.getByRole('button', {name: 'Track selected creature'})).toHaveAttribute('aria-pressed', String(trackSelectedCreature));
    } else await expect(badge).toHaveCount(0);
    await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
    // Spawn and snapshot share the ordered Worker port; assert one authoritative result.
    expect((await read()).state.organisms).toHaveLength(2);
    await page.getByTitle('Close settings (✕)').dispatchEvent('click');
    // Clear any automatic choice, then explicitly pick the fixed original creature.
    if (!selectAddedCreature) await expect(badge).toHaveCount(0);
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + 10, box.y + 10);
    await selectCenter();
    const track = badge.getByRole('button', {name: 'Track selected creature'});
    await expect(track).toHaveAttribute('aria-pressed', String(trackSelectedCreature));
    await track.dispatchEvent('click'); await expect(track).toHaveAttribute('aria-pressed', String(!trackSelectedCreature));
    await track.dispatchEvent('click');
    await page.getByTitle('Specimen Bank (Save & Spawn Custom Genomes)').dispatchEvent('click');
    await page.getByTestId('specimen-row').first().getByRole('button', {name: 'Spawn', exact: true}).dispatchEvent('click');
    if (selectAddedCreature) {
      await expect(badge).not.toHaveAttribute('data-organism-id', source.state.organisms[0].id);
      await expect(track).toHaveAttribute('aria-pressed', String(trackSelectedCreature));
    } else await expect(badge).toHaveAttribute('data-organism-id', source.state.organisms[0].id);
    await page.getByTitle('Close specimen bank (✕)').dispatchEvent('click');
    await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
    expect((await read()).state.organisms).toHaveLength(3);
    if (!selectAddedCreature) await expect(badge).toHaveAttribute('data-organism-id', source.state.organisms[0].id);
    const final = await read(); await upload(final);
    const restored = await openAdvanced();
    await expect(restored.getByLabel('Automatically select added creatures')).toBeChecked({checked: selectAddedCreature});
    await expect(restored.getByLabel('Automatically track selected creatures')).toBeChecked({checked: trackSelectedCreature});
    await restored.getByLabel('Automatically track selected creatures').focus();
    await page.keyboard.press('Escape'); await expect(restored).toHaveCount(0);
  }
  const override = await openAdvanced();
  await setChecked(override.getByLabel('Automatically select added creatures'), false);
  await setChecked(override.getByLabel('Automatically track selected creatures'), false);
  await setChecked(override.getByLabel('Show water caustics'), false);
  await override.getByTitle('Close advanced settings').dispatchEvent('click');
  const beforeFork = await read(), epoch = Number(await canvas.getAttribute('data-world-epoch'));
  await settings.getByRole('button', {name: 'Fork', exact: true}).dispatchEvent('click');
  await expect(canvas).toHaveAttribute('data-world-epoch', String(epoch + 1));
  const forked = await read(); expect(forked.state).toEqual(beforeFork.state);
  expect(forked.metadata.observerPreferences).toEqual({selectAddedCreature: false, trackSelectedCreature: false, showCaustics: false});
  await page.setViewportSize({width: 375, height: 812});
  const advanced = await openAdvanced();
  await page.clock.runFor(32);
  const box = (await advanced.boundingBox())!, tank = (await canvas.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(tank.x); expect(box.x + box.width).toBeLessThanOrEqual(tank.x + tank.width);
  expect(box.y + box.height).toBeLessThanOrEqual(tank.y + tank.height);
  await page.screenshot({path: info.outputPath('observer-preferences-mobile.png')});
  expect(errors).toEqual([]);
});

for (const fallback of [false, true]) {
  test(`caustic paint can be disabled without changing authoritative world state (${fallback ? 'fallback' : 'Worker'})`,
    async ({page}) => {
      await page.setViewportSize({width: 1280, height: 850});
      await page.clock.install({time: new Date('2026-01-01T00:00:00Z')});
      await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
      const pageErrors: string[] = [];
      page.on('pageerror', error => pageErrors.push(error.message));

      // Count precisely the expensive native caustic filter submissions, not display FPS.
      await page.addInitScript(() => {
        (window as any).causticBlurFills = 0;
        const original = CanvasRenderingContext2D.prototype.fill;
        CanvasRenderingContext2D.prototype.fill = function(...args: any[]) {
          if (this.filter === 'blur(16px)') (window as any).causticBlurFills++;
          return (original as any).apply(this, args);
        };
      });
      await page.goto(`./?autoplay${fallback ? '&mainthread' : ''}`);

      const cfg = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0, nutrientLimit: null};
      const state = createInitialWorld(cfg, 71, 'balanced', 'standard', 1);
      state.caustics = [{x: cfg.worldWidth / 2, y: cfg.worldHeight / 2, radius: 180,
        speed: .3, alpha: .09, angle: 0}];
      const source = createSnapshot(state, cfg);
      const upload = async (value: unknown) => {
        await page.getByTestId('settings-window').locator('input[type=file]').setInputFiles({name: 'caustic-visibility.json',
          mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value))});
        await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
      };
      const paintCount = async () => {
        await page.evaluate(() => { (window as any).causticBlurFills = 0; });
        await page.clock.runFor(64);
        return page.evaluate(() => (window as any).causticBlurFills as number);
      };

      await page.getByTitle('Ecology & Physical Settings').dispatchEvent('click');
      const settings = page.getByTestId('settings-window');
      await expect(settings).toBeVisible();
      await upload(source);
      await settings.getByRole('button', {name: 'Advanced Settings', exact: true}).dispatchEvent('click');
      const toggle = page.getByRole('dialog', {name: 'Advanced Settings'}).getByLabel('Show water caustics');
      await expect(toggle).toBeChecked();
      expect(await paintCount()).toBeGreaterThan(0);

      const read = async () => {
        const download = page.waitForEvent('download');
        await page.getByRole('button', {name: 'Export Snapshot', exact: true}).dispatchEvent('click');
        return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
      };
      await toggle.dispatchEvent('click');
      await expect(toggle).not.toBeChecked();
      expect(await paintCount()).toBe(0);
      const hidden = await read();
      expect(hidden.metadata.observerPreferences.showCaustics).toBe(false);
      expect(hidden.state).toEqual(source.state);
      expect(hidden.settings).toEqual(source.settings);

      await toggle.dispatchEvent('click');
      await expect(toggle).toBeChecked();
      expect(await paintCount()).toBeGreaterThan(0);
      await toggle.dispatchEvent('click');
      expect(await paintCount()).toBe(0);

      // Explicit observer metadata restores the override; historical snapshots remain visible.
      await upload(hidden);
      await expect(toggle).not.toBeChecked();
      expect(await paintCount()).toBe(0);
      await upload(source);
      await expect(toggle).toBeChecked();
      expect(await paintCount()).toBeGreaterThan(0);
      expect(pageErrors).toEqual([]);
    });
}
