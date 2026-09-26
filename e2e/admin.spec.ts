import { test, expect, type Page } from '@playwright/test';
import { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from './env';

const NEW_PASSWORD = 'e2e-new-password-1';

async function logIn(page: Page, password: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(SEED_ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('changing the password keeps this session and signs out the others', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // B logs in first, then we wait past the second boundary so its session is
  // strictly older than the password change (sessions are compared by second).
  await logIn(pageB, SEED_ADMIN_PASSWORD);
  await expect(pageB).toHaveURL('/admin');
  await pageB.waitForTimeout(1100);

  await logIn(pageA, SEED_ADMIN_PASSWORD);
  await expect(pageA).toHaveURL('/admin');
  await pageA.goto('/admin/settings');
  await pageA.getByLabel('Current password').fill(SEED_ADMIN_PASSWORD);
  await pageA.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await pageA.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await pageA.getByRole('button', { name: 'Change password' }).click();
  await expect(pageA.getByText('Password changed')).toBeVisible();

  // A stays logged in.
  await pageA.reload();
  await expect(pageA).toHaveURL('/admin/settings');
  await expect(pageA.getByLabel('Current password')).toBeVisible();

  // B's older session is rejected and bounced to login.
  await pageB.goto('/admin');
  await expect(pageB).toHaveURL('/admin/login');

  // Old password fails; new password works.
  const pageC = await (await browser.newContext()).newPage();
  await logIn(pageC, SEED_ADMIN_PASSWORD);
  await expect(pageC.getByText(/invalid credentials/i)).toBeVisible();
  await logIn(pageC, NEW_PASSWORD);
  await expect(pageC).toHaveURL('/admin');

  await contextA.close();
  await contextB.close();
});
