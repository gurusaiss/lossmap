import { expect, test } from '@playwright/test';
import { mockBackend } from './mockBackend.ts';
import { expectHome, fillLotDetails, loginAs, snapBoth } from './helpers.ts';

test('new lot with AI: the scale is read, quality estimated, the worker confirms, rows and photos are uploaded, a QR label appears', async ({ page }) => {
  const rec = await mockBackend(page, { ai: 'ok' });
  await loginAs(page, 1); await expectHome(page);
  await page.getByTestId('home-new-lot').click();
  await fillLotDetails(page);
  await snapBoth(page);
  await expect(page.getByTestId('weight-input')).toHaveValue('250');
  await expect(page.getByTestId('ai-weight-note')).toContainText('250');
  await expect(page.getByTestId('quality-ai')).toContainText('Visible quality estimate (AI)');
  await page.getByTestId('save-checkpoint').click();
  await expect(page.getByTestId('lot-created')).toBeVisible();
  await expect(page.getByTestId('qr-label')).toHaveAttribute('data-qr-url', /\/l\/[0-9a-f-]{36}$/);
  await expect.poll(() => rec.checkpoints.length).toBe(1);
  expect(rec.order.filter((o) => o !== 'farmer')).toEqual(['lot', 'checkpoint']);
  expect(rec.uploads).toHaveLength(2);
  expect(rec.checkpoints[0]).toMatchObject({ stage: 'farm_pickup', weight_kg: 250, ai_weight_kg: 250, quality_is_ai: true, capture_method: 'camera' });
  expect(rec.functionCalls).toContain('weather-exposure');
});

test('AI unavailable: the worker types the weight and saving is never blocked', async ({ page }) => {
  const rec = await mockBackend(page, { ai: 'fail' });
  await loginAs(page, 1); await page.getByTestId('home-new-lot').click(); await fillLotDetails(page);
  await snapBoth(page);
  await expect(page.getByTestId('ai-unreadable')).toBeVisible();
  await page.getByTestId('weight-input').fill('248.5');
  await page.getByTestId('preset-good').click();
  await page.getByTestId('save-checkpoint').click();
  await expect(page.getByTestId('lot-created')).toBeVisible();
  await expect.poll(() => rec.checkpoints.length).toBe(1);
  expect(rec.checkpoints[0]).toMatchObject({ weight_kg: 248.5, ai_weight_kg: null, quality_is_ai: false, quality_good_pct: 90 });
});

test('an unreadable scale display asks for typing and records no AI reading', async ({ page }) => {
  const rec = await mockBackend(page, { ai: 'unreadable' });
  await loginAs(page, 1); await page.getByTestId('home-new-lot').click(); await fillLotDetails(page);
  await page.getByTestId('scale-open').click(); await page.getByTestId('scale-snap').click();
  await expect(page.getByTestId('ai-unreadable')).toBeVisible(); await expect(page.getByTestId('weight-input')).toHaveValue('');
  await page.getByTestId('weight-input').fill('100'); await page.getByTestId('save-checkpoint').click();
  await expect(page.getByTestId('lot-created')).toBeVisible();
  await expect.poll(() => rec.checkpoints[0]).toMatchObject({ weight_kg: 100, ai_weight_kg: null });
});

test('offline cycle: saved with no network, shown in the queue, uploaded in order once the connection returns', async ({ page, context }) => {
  const rec = await mockBackend(page, { ai: 'fail' });
  await loginAs(page, 1); await page.getByTestId('home-new-lot').click();
  await expect(page.getByLabel('Farmer')).toBeVisible(); // master data is now cached on the phone
  await page.getByRole('link', { name: 'Back' }).click(); await page.getByTestId('home-new-lot').click();
  await expect(page.getByLabel('Crop')).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByTestId('online-badge')).toHaveText('Offline');
  await fillLotDetails(page);
  await page.getByTestId('weight-input').fill('120'); await page.getByTestId('save-checkpoint').click();
  await expect(page.getByTestId('lot-created')).toBeVisible();
  expect(rec.checkpoints).toHaveLength(0);
  await expect(page.getByTestId('pending-badge')).toContainText('2'); // the lot and its first checkpoint
  await context.setOffline(false);
  await expect.poll(() => rec.checkpoints.length, { timeout: 40_000 }).toBe(1);
  expect(rec.order.filter((o) => o !== 'farmer')).toEqual(['lot', 'checkpoint']);
  await expect(page.getByTestId('pending-badge')).toHaveCount(0);
});

test('a farmer added with no signal is uploaded before the lot that uses them', async ({ page, context }) => {
  const rec = await mockBackend(page, { ai: 'fail' });
  await loginAs(page, 1); await page.getByTestId('home-new-lot').click(); await expect(page.getByLabel('Farmer')).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('farmer-add').click(); await page.getByLabel('Name', { exact: true }).fill('New Farmer'); await page.getByLabel('Village').fill('New Village'); await page.getByTestId('farmer-add-save').click();
  await page.getByLabel('Crop').selectOption({ label: 'Tomato' }); await page.getByTestId('details-next').click();
  await page.getByTestId('weight-input').fill('90'); await page.getByTestId('save-checkpoint').click(); await expect(page.getByTestId('lot-created')).toBeVisible();
  await context.setOffline(false);
  await expect.poll(() => rec.checkpoints.length, { timeout: 40_000 }).toBe(1);
  expect(rec.order).toEqual(['farmer', 'lot', 'checkpoint']);
});

test('a checkpoint that fails to upload stays queued and is retried (no loss, no duplicate)', async ({ page }) => {
  const rec = await mockBackend(page, { ai: 'fail' }); rec.failNextCheckpoint = true;
  await loginAs(page, 1); await page.getByTestId('home-new-lot').click(); await fillLotDetails(page);
  await page.getByTestId('weight-input').fill('77'); await page.getByTestId('save-checkpoint').click(); await expect(page.getByTestId('lot-created')).toBeVisible();
  await expect.poll(() => rec.checkpoints.length, { timeout: 45_000 }).toBe(1);
  expect(rec.lots).toHaveLength(1);
});

test('scan page: a typed code opens the lot, an invalid code shows an error', async ({ page }) => {
  await mockBackend(page); await loginAs(page, 1);
  await page.getByTestId('home-scan').click();
  await page.getByTestId('code-input').fill('nonsense text'); await page.getByTestId('code-go').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByTestId('code-input').fill('t-1043'); await page.getByTestId('code-go').click();
  await expect(page).toHaveURL(/\/l\/t-1043$/);
  await expect(page.getByTestId('lot-summary')).toContainText('Venkata Ramana');
  await expect(page.getByTestId('timeline-item')).toHaveCount(4);
});

test('the field screens fit a 360 px phone without sideways scrolling', async ({ page }) => {
  await mockBackend(page); await loginAs(page, 1);
  for (const path of ['/', '/lot/new', '/scan', '/queue', '/account']) {
    await page.goto(path); await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
  }
});

test('Telugu: the field home and the lot form switch language', async ({ page }) => {
  await mockBackend(page); await loginAs(page, 1);
  await page.getByTestId('lang-toggle').click();
  await expect(page.getByTestId('home-new-lot')).toContainText('కొత్త లాట్');
});
