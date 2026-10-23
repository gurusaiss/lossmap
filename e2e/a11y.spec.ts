import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockBackend } from './mockBackend.ts';
import { loginAs } from './helpers.ts';

// WCAG 2.1 A/AA automated checks. Automated rules catch roughly a third of issues, so this complements, not replaces, manual review.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.html.slice(0, 140)}`), `${label} accessibility violations`).toEqual([]);
}

test('field screens: login, home, new lot form, capture with AI results, scan, account', async ({ page }) => {
  await mockBackend(page, { ai: 'ok' });
  await page.goto('/login'); await audit(page, 'login');
  await loginAs(page, 1); await expect(page.getByTestId('home-new-lot')).toBeVisible(); await audit(page, 'field home');
  await page.getByTestId('home-new-lot').click();
  await page.getByLabel('Farmer').selectOption({ label: 'Ravi · Kothapalli' }); await page.getByLabel('Crop').selectOption({ label: 'Tomato' }); await audit(page, 'new lot details');
  await page.getByTestId('details-next').click();
  await page.getByTestId('scale-open').click(); await page.getByTestId('scale-snap').click(); await page.getByTestId('produce-open').click(); await page.getByTestId('produce-snap').click();
  await expect(page.getByTestId('quality-ai')).toBeVisible(); await audit(page, 'checkpoint form with AI results');
  await page.goto('/scan'); await audit(page, 'scan');
  await page.goto('/account'); await audit(page, 'account');
});

test.describe('manager (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
test('manager screens: overview, lot detail, alerts, settings with team and a temporary password, farmer report', async ({ page }) => {
  await mockBackend(page, { realOrg: true, seedLots: true }); await loginAs(page, 0);
  await expect(page.getByTestId('stage-chart')).toBeVisible(); await expect(page.getByTestId('centre-map')).toBeVisible(); await audit(page, 'overview');
  await page.goto('/m/lot/T-1043'); await expect(page.getByTestId('waterfall')).toBeVisible(); await audit(page, 'lot detail');
  await page.goto('/m/alerts'); await expect(page.getByTestId('alerts-list')).toBeVisible(); await audit(page, 'alerts');
  await page.goto('/m/settings'); await expect(page.getByTestId('team-member').first()).toBeVisible();
  await page.getByTestId('member-name').fill('Lakshmi Devi'); await page.getByTestId('member-email').fill('lakshmi@staff.test'); await page.getByTestId('member-add').click();
  await expect(page.getByTestId('temp-credential')).toBeVisible(); await audit(page, 'settings with team and temporary password');
  await page.goto(`/r/${'a'.repeat(64)}`); await expect(page.getByTestId('report-weight')).toBeVisible(); await audit(page, 'farmer report');
});
});

test('dark mode: manager overview', async ({ page }) => {
  await mockBackend(page); await loginAs(page, 0);
  await page.getByTestId('theme-toggle').click(); await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.getByTestId('stage-chart')).toBeVisible(); await audit(page, 'overview (dark)');
});

test('tap targets on the field app are at least 44 px', async ({ page }) => {
  await mockBackend(page); await loginAs(page, 1); await expect(page.getByTestId('home-new-lot')).toBeVisible();
  const small = await page.evaluate(() => [...document.querySelectorAll('a, button, select, input')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent?.trim().slice(0, 20) || e.getAttribute('aria-label'), w: r.width, h: r.height }; }).filter((x) => x.w > 0 && (x.h < 44 || x.w < 44)));
  expect(small).toEqual([]);
});
