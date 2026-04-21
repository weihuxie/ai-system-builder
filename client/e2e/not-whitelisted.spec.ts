import { test, expect } from '@playwright/test';

import { resetTestDb, testAdminClient } from './helpers/supabase-admin';
import { signInAs } from './helpers/session';

test.beforeEach(async () => {
  await resetTestDb();
});

test('session without admin_users row → NotWhitelistedPanel with sign-out', async ({ page }) => {
  // Create auth user WITHOUT a whitelist entry.
  const db = testAdminClient();
  const email = `outsider+asbtest-e2e@example.com`;
  const password = 'NotWL-abc123!';
  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;

  await signInAs(page, email, password);

  // Shows "not whitelisted" state. Copy-key lookup: adminNotWhitelistedTitle.
  await expect(page.locator('h2')).toContainText(
    /not authorized|未授权|未授權|未認可/,
  );
  // Switch-account button is visible.
  await expect(
    page.locator('button', { hasText: /switch|切换|切換|アカウント切替/ }),
  ).toBeVisible();
});
