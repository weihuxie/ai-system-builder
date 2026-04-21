import { test, expect } from '@playwright/test';

import { resetTestDb } from './helpers/supabase-admin';

test.beforeEach(async () => {
  await resetTestDb();
});

test('landing page renders for anon visitor', async ({ page }) => {
  await page.goto('/');
  // The brand header text or the scenario picker should be present.
  await expect(page).toHaveURL(/\/$/);
  // The landing page body is not empty — a sanity check, not a deep assertion.
  await expect(page.locator('body')).not.toHaveText('');
});

test('/admin without session shows LoginForm (Google sign-in button)', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
});
