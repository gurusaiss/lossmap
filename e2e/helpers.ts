import { expect, type Page } from '@playwright/test';
/** 0 = manager, 1 = field agent (the demo logins on the login page). */
export async function loginAs(page: Page, index: 0 | 1) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use' }).nth(index).click();
  await page.getByTestId('login-submit').click();
}
export async function fillLotDetails(page: Page) {
  await page.getByLabel('Farmer').selectOption({ label: 'Ravi · Kothapalli' });
  await page.getByLabel('Crop').selectOption({ label: 'Tomato' });
  await page.getByLabel('Crates').fill('10');
  await page.getByTestId('details-next').click();
}
export async function snapBoth(page: Page) {
  await page.getByTestId('scale-open').click(); await page.getByTestId('scale-snap').click();
  await page.getByTestId('produce-open').click(); await page.getByTestId('produce-snap').click();
}
export const expectHome = (page: Page) => expect(page.getByTestId('home-new-lot')).toBeVisible();
