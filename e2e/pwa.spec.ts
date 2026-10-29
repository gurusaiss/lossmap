import { expect, test } from '@playwright/test';
import { mockBackend } from './mockBackend.ts';
import { loginAs } from './helpers.ts';

// Runs against the PRODUCTION build served by `vite preview` (port 4174) with the real service worker.
test.use({ baseURL: 'http://localhost:4174' });

test('the installed app opens and works with no connection at all (cold start offline)', async ({ page, context }) => {
  const rec = await mockBackend(page, { ai: 'fail' });
  await loginAs(page, 1); await expect(page.getByTestId('home-new-lot')).toBeVisible();
  await page.getByTestId('home-new-lot').click(); await expect(page.getByLabel('Farmer')).toBeVisible(); // master data cached
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForTimeout(1500); // let the worker finish precaching
  await context.setOffline(true);
  await page.goto('/'); // a full cold navigation with the network down
  await expect(page.getByTestId('home-new-lot')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('online-badge')).toHaveText('Offline');
  await page.getByTestId('home-new-lot').click(); await expect(page.getByLabel('Farmer')).toBeVisible();
  await page.getByLabel('Farmer').selectOption({ label: 'Ravi · Kothapalli' }); await page.getByLabel('Crop').selectOption({ label: 'Tomato' }); await page.getByTestId('details-next').click();
  await page.getByTestId('weight-input').fill('55'); await page.getByTestId('save-checkpoint').click(); await expect(page.getByTestId('lot-created')).toBeVisible();
  await context.setOffline(false);
  await expect.poll(() => rec.checkpoints.length, { timeout: 40_000 }).toBe(1);
});

test('an expired login token cannot refresh offline, but the remembered person keeps working', async ({ page, context }) => {
  await mockBackend(page, { sessionSeconds: 2 });
  await loginAs(page, 1); await expect(page.getByTestId('home-new-lot')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.waitForTimeout(3500);
  await context.setOffline(true); await page.goto('/');
  await expect(page.getByTestId('home-new-lot')).toBeVisible({ timeout: 15_000 });
});

test('the map library is not part of the first load of the field app', async ({ page }) => {
  await mockBackend(page); const loaded: string[] = []; page.on('request', (r) => loaded.push(r.url()));
  await loginAs(page, 1); await expect(page.getByTestId('home-new-lot')).toBeVisible();
  expect(loaded.filter((u) => /CentreMap|Charts/.test(u))).toEqual([]);
});
