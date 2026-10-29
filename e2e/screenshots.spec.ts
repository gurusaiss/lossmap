import { test } from '@playwright/test';
import { mockBackend } from './mockBackend.ts';
import { loginAs, fillLotDetails } from './helpers.ts';

// Produces docs/screenshots. Run with: SHOTS=1 npx playwright test e2e/screenshots.spec.ts
// The browser talks to a mocked backend (e2e/mockBackend.ts); the loss figures are the output of the real SQL views over the SIMULATED demo scenario.
test.skip(!process.env.SHOTS, 'set SHOTS=1 to regenerate screenshots');
const out = (n: string) => `docs/screenshots/${n}.png`;

test('phone: field app', async ({ page }) => {
  await mockBackend(page, { ai: 'ok' });
  await page.goto('/login'); await page.screenshot({ path: out('01-login-phone') });
  await loginAs(page, 1); await page.getByTestId('home-new-lot').waitFor(); await page.screenshot({ path: out('02-field-home-phone') });
  await page.getByTestId('home-new-lot').click(); await fillLotDetails(page);
  await page.getByTestId('scale-open').click(); await page.getByTestId('scale-snap').click(); await page.getByTestId('produce-open').click(); await page.getByTestId('produce-snap').click();
  await page.getByTestId('quality-ai').waitFor(); await page.screenshot({ path: out('03-capture-ai-reading-phone'), fullPage: true });
  await page.getByTestId('save-checkpoint').click(); await page.getByTestId('lot-created').waitFor(); await page.screenshot({ path: out('04-lot-qr-phone'), fullPage: true });
  await page.getByTestId('lang-toggle').click(); await page.getByRole('link', { name: 'పూర్తయింది' }).click(); await page.screenshot({ path: out('05-field-home-telugu-phone') });
});
test('phone: offline queue and farmer report', async ({ page, context }) => {
  await mockBackend(page, { ai: 'fail' }); await loginAs(page, 1); await page.getByTestId('home-new-lot').click(); await page.getByLabel('Farmer').waitFor();
  await context.setOffline(true); await fillLotDetails(page); await page.getByTestId('weight-input').fill('120'); await page.getByTestId('save-checkpoint').click(); await page.getByTestId('lot-created').waitFor();
  await page.goto('/queue').catch(() => undefined);
  await page.screenshot({ path: out('06-saved-offline-phone') });
  await context.setOffline(false);
  await page.goto(`/r/${'a'.repeat(64)}`); await page.getByTestId('report-weight').waitFor(); await page.screenshot({ path: out('07-farmer-report-phone') });
});
test.describe('desktop: manager', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });
  test('dashboard', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0); await page.getByTestId('stage-chart').waitFor(); await page.getByTestId('map-marker').first().waitFor({ timeout: 15000 }).catch(() => undefined);
    await page.screenshot({ path: out('08-manager-overview-desktop'), fullPage: true });
    await page.getByTestId('stage-table').getByText('Waiting at centre').click(); await page.getByTestId('drill-panel').waitFor(); await page.getByTestId('drill-panel').screenshot({ path: out('09-drill-down-desktop') });
    await page.goto('/m/lot/T-1043'); await page.getByTestId('waterfall').waitFor(); await page.screenshot({ path: out('10-lot-detail-waterfall-desktop'), fullPage: true });
    await page.goto('/m/alerts'); await page.getByTestId('alerts-list').waitFor(); await page.screenshot({ path: out('11-alerts-desktop') });
  });
  test('team and settings', async ({ page }) => {
    await mockBackend(page, { realOrg: true }); await loginAs(page, 0); await page.goto('/m/settings');
    const team = page.getByTestId('team-section'); await team.getByTestId('team-member').first().waitFor();
    await team.getByTestId('member-name').fill('Lakshmi Devi'); await team.getByTestId('member-email').fill('lakshmi@example.test'); await team.getByTestId('member-add').click();
    await team.getByTestId('temp-credential').waitFor(); await team.screenshot({ path: out('12-team-desktop') });
  });
  test('dark mode', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0); await page.getByTestId('theme-toggle').click(); await page.getByTestId('theme-toggle').click(); await page.getByTestId('stage-chart').waitFor();
    await page.screenshot({ path: out('13-manager-overview-dark-desktop'), fullPage: true });
  });
});
