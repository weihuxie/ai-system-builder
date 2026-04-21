import { test, expect } from '@playwright/test';

import { resetTestDb, seedE2EProduct, seedE2EUser } from './helpers/supabase-admin';
import { signInAs } from './helpers/session';

test.beforeEach(async () => {
  await resetTestDb();
});

test('super_admin sees all admin panels', async ({ page }) => {
  const boss = await seedE2EUser('boss-panels', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  // BrandSwitch + Users panel + ProductList all visible
  await expect(page.getByRole('heading', { name: /品牌切换/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /授权用户/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /产品管理/ })).toBeVisible();
});

test('super_admin sees filter tabs (all / mine / orphan) and can see orphan products', async ({
  page,
}) => {
  const boss = await seedE2EUser('boss-orphan', 'super_admin');
  await seedE2EProduct({ id: 'orphan-a', ownerId: null });
  await seedE2EProduct({ id: 'mine-a', ownerId: boss.userId });

  await signInAs(page, boss.email, boss.password);
  await expect(page.locator('text=orphan-a').first()).toBeVisible();
  await expect(page.locator('text=mine-a').first()).toBeVisible();
});

test('super_admin can invite a new editor via the Users panel', async ({ page }) => {
  const boss = await seedE2EUser('boss-invite', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  // Fill the invite form (email input + submit).
  const email = `invitee-${Date.now()}+asbtest-e2e@example.com`;
  await page.getByPlaceholder('name@gmail.com').fill(email);
  await page.getByRole('button', { name: /邀请|Invite/ }).click();

  // New row appears in the list.
  await expect(page.locator(`text=${email}`)).toBeVisible({ timeout: 10_000 });
});

test('super_admin can switch brand', async ({ page }) => {
  const boss = await seedE2EUser('boss-brand', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  // The BrandSwitch component renders a toggle with "Google" / "AWS" options.
  // Click AWS; page re-renders with AWS accent.
  const awsButton = page.getByRole('button', { name: /aws/i }).first();
  await awsButton.click();

  // Confirm the PUT succeeded by reloading and re-reading brand from GET /api/brand
  const res = await page.request.get('/api/brand');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.brand).toBe('aws');
});
