import { expect, test } from '@playwright/test';
import { mockBackend } from './mockBackend.ts';
import { loginAs } from './helpers.ts';

test.describe('team management (manager, real organisation)', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  test('add a person: the temporary password is shown once, the list updates, a duplicate email is refused', async ({ page }) => {
    const rec = await mockBackend(page, { realOrg: true }); await loginAs(page, 0); await page.goto('/m/settings');
    const team = page.getByTestId('team-section');
    await expect(team.getByTestId('team-member')).toHaveCount(2);
    await expect(team.getByTestId('team-member').first()).toContainText('(you)');
    await expect(team.getByTestId('team-member').first().getByTestId('member-toggle')).toHaveCount(0); // no buttons for yourself
    await team.getByTestId('member-add').click();
    await expect(team.getByTestId('team-error')).toContainText('Check the name, email address and role'); expect(rec.staffCalls).toHaveLength(0);
    await team.getByTestId('member-name').fill('Lakshmi Devi'); await team.getByTestId('member-email').fill('Lakshmi@Staff.Test');
    await team.getByTestId('member-phone').fill('+91 98765 43210'); await team.getByTestId('member-add').click();
    await expect(team.getByTestId('temp-credential')).toContainText('Lakshmi Devi was added.');
    await expect(team.getByTestId('temp-email')).toHaveText('lakshmi@staff.test'); await expect(team.getByTestId('temp-password')).toHaveText('Xk7mQ2vRp9Tz');
    expect(rec.staffCalls[0]).toMatchObject({ action: 'create', name: 'Lakshmi Devi', role: 'field_agent', phone: '+91 98765 43210' });
    await expect(team.getByTestId('team-member')).toHaveCount(3); await expect(team.getByTestId('member-name')).toHaveValue('');
    await team.getByTestId('temp-dismiss').click(); await expect(team.getByTestId('temp-credential')).toHaveCount(0);
    await team.getByTestId('member-name').fill('Someone Else'); await team.getByTestId('member-email').fill('lakshmi@staff.test'); await team.getByTestId('member-add').click();
    await expect(team.getByTestId('team-error')).toHaveText('That email already has an account.'); await expect(team.getByTestId('team-member')).toHaveCount(3);
  });

  test('reset a password and disable / enable a person, each after a confirmation', async ({ page }) => {
    const rec = await mockBackend(page, { realOrg: true }); await loginAs(page, 0); await page.goto('/m/settings');
    const team = page.getByTestId('team-section'), ravi = team.getByTestId('team-member').filter({ hasText: 'Ravi Kumar' });
    page.once('dialog', (d) => { expect(d.message()).toContain('Reset the password for Ravi Kumar?'); void d.dismiss(); });
    await ravi.getByTestId('member-reset').click(); expect(rec.staffCalls).toHaveLength(0);
    page.once('dialog', (d) => void d.accept()); await ravi.getByTestId('member-reset').click();
    await expect(team.getByTestId('temp-password')).toHaveText('Ab3dEf6Hj8Kn'); expect(rec.staffCalls[0]).toMatchObject({ action: 'reset_password' });
    page.once('dialog', (d) => { expect(d.message()).toContain('Disable Ravi Kumar?'); void d.accept(); });
    await ravi.getByTestId('member-toggle').click();
    await expect(ravi.getByTestId('disabled-badge')).toBeVisible(); await expect(ravi.getByTestId('member-toggle')).toHaveText('Enable');
    await ravi.getByTestId('member-toggle').click(); await expect(ravi.getByTestId('disabled-badge')).toHaveCount(0);
    expect(rec.staffCalls.map((c) => c.active)).toEqual([undefined, false, true]);
  });

  test('the Team section is not offered in the shared demo organisation', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 0); await page.goto('/m/settings');
    await expect(page.getByTestId('demo-controls')).toBeVisible(); await expect(page.getByTestId('team-section')).toHaveCount(0);
  });

  test('offline: adding a person says so instead of failing silently', async ({ page, context }) => {
    const rec = await mockBackend(page, { realOrg: true }); await loginAs(page, 0); await page.goto('/m/settings');
    await expect(page.getByTestId('team-member')).toHaveCount(2); await context.setOffline(true);
    await page.getByTestId('member-name').fill('Offline Person'); await page.getByTestId('member-email').fill('offline@staff.test'); await page.getByTestId('member-add').click();
    await expect(page.getByTestId('team-error')).toContainText('You are offline'); expect(rec.staffCalls).toHaveLength(0);
  });

  test('an empty organisation is guided to add a crop and centres; invalid crops are refused', async ({ page }) => {
    const rec = await mockBackend(page, { realOrg: true, emptyMaster: true }); await loginAs(page, 0); await page.goto('/m/settings');
    await expect(page.getByTestId('no-crops')).toContainText('Add your first crop'); await expect(page.getByTestId('no-centres')).toContainText('collection centre and the factory');
    const crop = page.getByTestId('add-crop');
    await crop.getByLabel('Name', { exact: true }).fill('Mango'); await crop.getByLabel('Name in Telugu (optional)').fill('మామిడి'); await crop.getByLabel('Lot code letter (A–Z)').fill('mx');
    await page.getByTestId('crop-add').click(); await expect(page.getByTestId('add-msg')).toHaveText('Something went wrong.'); expect(rec.inserts).toHaveLength(0); // blank price is invalid, not zero
    await crop.getByLabel('Price ₹/kg').fill('32'); await crop.getByLabel('Heat threshold °C').fill('34'); await crop.getByLabel('Safe wait (h)').fill('6');
    await page.getByTestId('crop-add').click(); await expect(page.getByTestId('add-msg')).toHaveText('Saved.');
    expect(rec.inserts[0]).toMatchObject({ path: '/rest/v1/crops', body: { name: 'Mango', code_prefix: 'M', price_per_kg: 32, heat_threshold_c: 34, max_safe_wait_hours: 6 } });
    await page.getByTestId('new-centre-type').selectOption('factory');
    const form = page.getByTestId('new-centre-type').locator('xpath=ancestor::div[contains(@class,"card")]');
    await form.getByLabel('Centre name').fill('Main factory'); await form.getByLabel('Latitude').fill('13.2172'); await form.getByLabel('Longitude').fill('79.1003');
    await form.getByRole('button', { name: 'Add centre' }).click();
    await expect.poll(() => rec.inserts.length).toBe(2);
    expect(rec.inserts[1]).toMatchObject({ path: '/rest/v1/centres', body: { name: 'Main factory', type: 'factory', lat: 13.2172 } });
  });

  test('the Team section is available in Telugu', async ({ page }) => {
    await mockBackend(page, { realOrg: true }); await loginAs(page, 0); await page.goto('/m/settings');
    await page.getByRole('button', { name: 'Language' }).click();
    await expect(page.getByTestId('team-section').getByRole('heading', { level: 2 })).toHaveText('బృందం');
  });
});

test.describe('account and passwords', () => {
  test('a field agent changes their own password; weak, mismatched and unchanged passwords are refused', async ({ page }) => {
    const rec = await mockBackend(page, { realOrg: true }); await loginAs(page, 1);
    await page.getByRole('link', { name: 'Account' }).click(); await expect(page).toHaveURL(/\/account$/);
    const save = async (a: string, b: string) => { await page.getByTestId('new-password').fill(a); await page.getByTestId('repeat-password').fill(b); await page.getByTestId('password-save').click(); };
    await save('Abcdefghij1', 'Abcdefghij2'); await expect(page.getByTestId('password-msg')).toHaveText('The two passwords are not the same.');
    await save('Short1a', 'Short1a'); await expect(page.getByTestId('password-msg')).toHaveText('Use at least 10 characters.');
    await save('alllowercase99', 'alllowercase99'); await expect(page.getByTestId('password-msg')).toContainText('lower-case letter');
    expect(rec.passwordUpdates).toHaveLength(0); // nothing weak ever reaches the server
    await save('Same-Password-1', 'Same-Password-1'); await expect(page.getByTestId('password-msg')).toHaveText('Choose a password different from the current one.');
    await save('Fresh-Passw0rd-7', 'Fresh-Passw0rd-7'); await expect(page.getByTestId('password-msg')).toHaveText('Password changed.');
    expect(rec.passwordUpdates.at(-1)).toMatchObject({ password: 'Fresh-Passw0rd-7', data: { temp_password: false } });
  });
  test('demo accounts cannot change the shared password from the app', async ({ page }) => {
    await mockBackend(page); await loginAs(page, 1); await page.goto('/account');
    await expect(page.getByTestId('demo-password-note')).toBeVisible(); await expect(page.getByTestId('password-form')).toHaveCount(0);
  });
  test('after a manager sets a temporary password the person is reminded until they choose their own', async ({ page }) => {
    await mockBackend(page, { realOrg: true, tempPassword: true }); await loginAs(page, 1);
    const banner = page.getByTestId('temp-password-banner'); await expect(banner).toContainText('temporary password'); await banner.click();
    await expect(page).toHaveURL(/\/account$/); await expect(banner).toHaveCount(0);
    await page.getByTestId('new-password').fill('Fresh-Passw0rd-7'); await page.getByTestId('repeat-password').fill('Fresh-Passw0rd-7'); await page.getByTestId('password-save').click();
    await expect(page.getByTestId('password-msg')).toHaveText('Password changed.');
    await page.getByRole('link', { name: 'Back' }).click(); await expect(page.getByTestId('home-new-lot')).toBeVisible(); await expect(banner).toHaveCount(0);
  });
  test('a disabled person who still holds a session sees a clear message, not an endless spinner, and can sign out', async ({ page }) => {
    await mockBackend(page, { realOrg: true, disabledLogin: true }); await loginAs(page, 1);
    await expect(page.getByTestId('access-blocked')).toContainText('This login is not active');
    await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page).toHaveURL(/\/login$/);
  });
});
