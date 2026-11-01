import {test, expect} from '@playwright/test';

// Full default ecosystem/effects at the large viewport; layout is tested separately.
test.use({viewport: {width: 1920, height: 900}});
test.setTimeout(60000);

test('production game starts at the Pages subpath, runs and pauses', async ({page}) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('./');
  await expect(page.getByRole('heading', {name: 'VIDA', exact: true})).toBeVisible();
  await expect(page.getByText('VIDA: COMPILING RECURRENT CONTROLLERS...')).toBeHidden();
  await page.getByRole('button', {name: 'SEED SIMULATION', exact: true}).click();
  await expect(page.getByText('Alive:', {exact: false})).toContainText('18');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText(/t = [1-9][\d.]*s/)).toBeVisible({timeout: 15000});
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', {name: 'Resume'})).toBeVisible();
  await page.getByRole('button', {name: 'Resume'}).click();
  await page.getByRole('button', {name: 'Menu', exact: true}).click();
  await expect(page.getByText('SIMULATION MENU', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'RESUME', exact: true}).click();
  await expect(page.getByText('SIMULATION MENU', {exact: true})).toBeHidden();
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(await page.locator('script[src*="gstatic"]').count()).toBe(0);
});
