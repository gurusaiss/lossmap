import { expect, test } from '@playwright/test';
import { mockBackend } from './mockBackend.ts';
import { loginAs } from './helpers.ts';

test.describe('manager dashboard (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  test('overview shows the KPIs from the real views, the worst centre first, charts with tables and the simulated label', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0);
    await expect(page).toHaveURL(/\/m$/);
    await expect(page.getByTestId('kpi-lost')).toContainText('₹46,053');
    await expect(page.getByTestId('kpi-lost')).toContainText('8% of ₹5,73,192 farm-gate value');
    await expect(page.getByTestId('kpi-worst')).toContainText('Centre B (Punganur)');
    await expect(page.getByTestId('kpi-alerts')).toContainText('2');
    await expect(page.getByTestId('simulated-badge').first()).toBeVisible();
    await expect(page.getByTestId('stage-chart')).toBeVisible();
    await expect(page.getByTestId('stage-table')).toContainText('Waiting at centre');
    await expect(page.getByTestId('stage-table')).toContainText('₹31,939');
    const centres = page.getByTestId('centre-ranking').locator('li');
    await expect(centres.first()).toContainText('Centre B'); await expect(centres.first()).toContainText('11.3%'); await expect(centres.nth(1)).toContainText('4.5%');
    await expect(page.getByTestId('hour-table')).toContainText('13:00');
  });

  test('every number is traceable: a stage row opens the segments behind it, linking to the lot', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0);
    await page.getByTestId('stage-table').getByText('Waiting at centre').click();
    await expect(page.getByTestId('drill-panel')).toContainText('T-1043');
    await page.getByTestId('drill-panel').getByRole('link').first().click();
    await expect(page).toHaveURL(/\/m\/lot\/T-1043$/);
  });

  test('lot detail: waterfall, the rule that fired with its numbers, weather, audit trail, farmer link', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0);
    await page.goto('/m/lot/T-1043');
    await expect(page.getByTestId('waterfall')).toBeVisible();
    await expect(page.getByTestId('lot-total')).toContainText('₹1,249');
    const waiting = page.getByTestId('segment').nth(1);
    await expect(waiting).toContainText('₹942'); await expect(waiting.getByTestId('cause')).toContainText('Heat during waiting'); await expect(waiting.getByTestId('cause')).toContainText('Waited 5 h');
    await expect(waiting.getByTestId('weather')).toContainText('3 h above the heat threshold');
    await expect(page.getByTestId('audit')).toContainText('240.00 → 245.00');
    await expect(page.getByTestId('copy-farmer-link')).toBeVisible();
  });

  test('a manager can correct a recorded weight; the change goes to the server', async ({ page }) => {
    const rec = await mockBackend(page); await loginAs(page, 0);
    await page.goto('/m/lot/T-1043');
    await page.getByTestId('weight-edit').nth(2).click();
    await page.getByLabel('Correct weight').fill('245'); await page.getByTestId('weight-save').click();
    await expect.poll(() => rec.patches.find((p) => p.path === '/rest/v1/checkpoints')?.body).toMatchObject({ weight_kg: 245 });
  });

  test('lots list searches by code, farmer and village', async ({ page }) => {
    await mockBackend(page, { seedLots: true }); await loginAs(page, 0);
    await page.goto('/m/lots');
    await expect(page.getByTestId('lots-table').locator('tbody tr')).toHaveCount(2);
    await page.getByTestId('lots-search').fill('thamballapalle');
    await expect(page.getByTestId('lots-table').locator('tbody tr')).toHaveCount(1);
  });

  test('alerts feed: acknowledge records the acknowledgement', async ({ page }) => {
    const rec = await mockBackend(page); await loginAs(page, 0);
    await page.goto('/m/alerts');
    await expect(page.getByTestId('alert-item')).toHaveCount(2);
    await page.getByTestId('alert-ack').first().click();
    await expect.poll(() => rec.patches.some((p) => p.path === '/rest/v1/alerts')).toBe(true);
    await expect(page.getByText('Acknowledged')).toHaveCount(1);
  });

  test('weekly insight: generate shows the summary and recommendation, labelled by source', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0);
    await page.getByTestId('insight-generate').click();
    await expect(page.getByTestId('insight-text')).toContainText('Centre B lost');
    await expect(page.getByTestId('insight-rec')).toContainText('Dispatch Centre B lots sooner');
    await expect(page.getByTestId('insight-card')).toContainText('Written from the computed numbers');
  });

  test('settings: blank numbers are rejected, edit a crop price, connect Telegram, load and reset the demo', async ({ page }) => {
    const rec = await mockBackend(page); await loginAs(page, 0);
    await page.goto('/m/settings');
    const row = page.getByTestId('crop-row');
    await row.getByLabel('Price ₹/kg').fill(''); await row.getByTestId('crop-save').click();
    await expect(row.getByRole('status')).toHaveText('Something went wrong.'); // blank is invalid, not zero
    await row.getByLabel('Price ₹/kg').fill('24'); await row.getByTestId('crop-save').click();
    await expect(row.getByRole('status')).toHaveText('Saved.');
    expect(rec.patches.find((p) => p.path === '/rest/v1/crops')?.body).toMatchObject({ price_per_kg: 24, max_safe_wait_hours: 3 });
    await page.getByTestId('telegram-connect').click();
    await expect(page.getByTestId('telegram-link')).toHaveAttribute('href', 'https://t.me/lossmap_test_bot?start=abcdef0123456789abcdef0123456789');
    await page.getByTestId('demo-load').click(); await expect(page.getByTestId('demo-msg')).toHaveText('Demo data loaded.');
    await page.getByTestId('demo-reset').click(); await expect(page.getByTestId('demo-msg')).toHaveText('Demo data removed.');
  });

  test('the map renders one marker per centre without needing the tile network', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0);
    await expect(page.getByTestId('centre-map')).toBeVisible();
    await expect(page.getByTestId('map-marker')).toHaveCount(2, { timeout: 15_000 });
  });

  test('dark mode applies and the dashboard keeps working', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0);
    await page.getByTestId('theme-toggle').click(); await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('stage-chart')).toBeVisible();
  });
});

test.describe('manager dashboard (phone)', () => {
  test('the overview fits a 360 px screen without sideways scrolling', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0);
    await expect(page.getByTestId('kpi-lost')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('roles and public pages', () => {
  test('a field agent cannot open the dashboard', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 1);
    await page.goto('/m'); await expect(page).not.toHaveURL(/\/m/); await expect(page.getByTestId('home-new-lot')).toBeVisible();
  });
  test('the public farmer report works without login, shows the simulated label, and a short token is refused', async ({ page }) => {
    await mockBackend(page);
    await page.goto(`/r/${'a'.repeat(64)}`);
    await expect(page.getByTestId('report-weight')).toHaveText('250 kg'); await expect(page.getByTestId('simulated-badge')).toBeVisible();
    await page.goto('/r/short'); await expect(page.getByTestId('report-invalid')).toBeVisible();
  });
});
