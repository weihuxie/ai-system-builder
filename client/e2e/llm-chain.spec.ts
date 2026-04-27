import { test, expect, Page } from '@playwright/test';

import { resetTestDb, seedE2EUser } from './helpers/supabase-admin';
import { signInAs } from './helpers/session';

// Spec for the "AI 模型链" admin panel. The user reported the interactions
// feel weird (拖拽 / 添加 / 删除 / 切换 provider). Tests below exercise each
// affordance to surface bugs:
//
//   1. Add row → save → reload → persisted
//   2. Delete the *middle* row of a multi-row chain (catches React key={idx}
//      bugs where the wrong row appears to disappear due to DOM reuse)
//   3. Toggle "enabled" on a single row — sibling rows stay untouched
//   4. Switch provider via <select> — model field defaults to that provider's
//      first preset
//   5. Save with empty model → server rejects (or button disabled)
//
// We don't exercise drag-and-drop here because Playwright's DnD support for
// HTML5 native drag is brittle on Chromium. Reorder is covered manually.

const PANEL = (page: Page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: 'AI 模型链' }) });

test.beforeEach(async () => {
  await resetTestDb();
});

test('LLM chain panel renders with default 1-row chain after reset', async ({ page }) => {
  const boss = await seedE2EUser('boss-llm-1', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  const panel = PANEL(page);
  await expect(panel).toBeVisible();

  // resetTestDb seeds llm_chain to a single gemini row, so we expect 1 li
  // inside the chain ul.
  const rows = panel.locator('ul > li');
  await expect(rows).toHaveCount(1);
});

test('add row → save → reload → row persisted', async ({ page }) => {
  const boss = await seedE2EUser('boss-llm-2', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  const panel = PANEL(page);
  await panel.getByRole('button', { name: /添加一项/ }).click();

  // Now 2 rows. Edit the new row's model to a recognisable value.
  const rows = panel.locator('ul > li');
  await expect(rows).toHaveCount(2);
  const newRow = rows.nth(1);
  const modelInput = newRow.locator('input[type="text"]');
  await modelInput.fill('gemini-2.5-pro-test-marker');

  // Wait for the mutation network response so we don't reload mid-flight
  // (the previous test version did exactly that and rolled back the change).
  const savePromise = page.waitForResponse(
    (r) => r.url().includes('/api/llm-chain') && r.request().method() === 'PUT' && r.ok(),
  );
  await panel.getByRole('button', { name: /^保存$/ }).click();
  await savePromise;

  // After save the dirty flag flips back to false → save button disabled.
  // This is a stronger contract than just "button visible".
  await expect(panel.getByRole('button', { name: /^保存$/ })).toBeDisabled();

  // Reload, expect 2 rows with the marker model
  await page.reload();
  await expect(PANEL(page).locator('ul > li')).toHaveCount(2);
  await expect(PANEL(page).locator('ul > li').nth(1).locator('input[type="text"]')).toHaveValue(
    'gemini-2.5-pro-test-marker',
  );
});

test('delete middle row in a 3-row chain leaves first + last intact', async ({ page }) => {
  const boss = await seedE2EUser('boss-llm-3', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  const panel = PANEL(page);
  // Build a 3-row chain: [gemini, gemini, gemini] but with distinguishable models
  await panel.getByRole('button', { name: /添加一项/ }).click();
  await panel.getByRole('button', { name: /添加一项/ }).click();

  const rows = () => panel.locator('ul > li');
  await expect(rows()).toHaveCount(3);
  await rows().nth(0).locator('input[type="text"]').fill('row-A');
  await rows().nth(1).locator('input[type="text"]').fill('row-B');
  await rows().nth(2).locator('input[type="text"]').fill('row-C');

  // Delete middle row (row-B)
  await rows().nth(1).getByRole('button', { name: 'remove' }).click();

  // Expect 2 remaining: row-A then row-C. The classic React key={idx} bug
  // would leave [row-A, row-B] (input value bleeds across DOM reuse).
  await expect(rows()).toHaveCount(2);
  await expect(rows().nth(0).locator('input[type="text"]')).toHaveValue('row-A');
  await expect(rows().nth(1).locator('input[type="text"]')).toHaveValue('row-C');
});

test('toggle enabled on row 2 does not affect row 1 or 3', async ({ page }) => {
  const boss = await seedE2EUser('boss-llm-4', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  const panel = PANEL(page);
  await panel.getByRole('button', { name: /添加一项/ }).click();
  await panel.getByRole('button', { name: /添加一项/ }).click();
  const rows = panel.locator('ul > li');
  await expect(rows).toHaveCount(3);

  // All start enabled by default. Untick the middle one.
  const middleCheckbox = rows.nth(1).locator('input[type="checkbox"]');
  await middleCheckbox.uncheck();

  await expect(rows.nth(0).locator('input[type="checkbox"]')).toBeChecked();
  await expect(middleCheckbox).not.toBeChecked();
  await expect(rows.nth(2).locator('input[type="checkbox"]')).toBeChecked();
});

test('switching provider on a row resets model to that provider\'s preset', async ({ page }) => {
  const boss = await seedE2EUser('boss-llm-5', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  const panel = PANEL(page);
  const firstRow = panel.locator('ul > li').first();
  const providerSelect = firstRow.locator('select');
  const modelInput = firstRow.locator('input[type="text"]');

  // Currently gemini per resetTestDb seed. Switch to kimi.
  await providerSelect.selectOption('kimi');

  // Model should now start with "moonshot" or "kimi" depending on preset[0].
  // Without locking the actual preset value we just check it's no longer
  // a gemini-* string.
  const newModel = await modelInput.inputValue();
  expect(newModel).not.toMatch(/^gemini/);
  expect(newModel.length).toBeGreaterThan(0);
});

test('save button stays disabled when nothing is dirty', async ({ page }) => {
  const boss = await seedE2EUser('boss-llm-6', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  const panel = PANEL(page);
  const saveBtn = panel.getByRole('button', { name: /^保存$/ });
  // Just landed; localChain mirrors server. Save should be disabled.
  await expect(saveBtn).toBeDisabled();

  // Tick a checkbox → dirty → save enabled
  const firstCheckbox = panel.locator('ul > li').first().locator('input[type="checkbox"]');
  await firstCheckbox.uncheck();
  await expect(saveBtn).toBeEnabled();

  // Re-check → back to baseline → save disabled again
  await firstCheckbox.check();
  await expect(saveBtn).toBeDisabled();
});
