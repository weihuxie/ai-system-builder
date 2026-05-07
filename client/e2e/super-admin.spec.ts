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

test('super_admin sees filter tabs (all / mine / platform) and platform products show "平台" badge', async ({
  page,
}) => {
  // 2026-05: 「无主（孤儿池）」 → 「平台」 重命名 — owner_id IS NULL 在系统里
  // 实际语义就是"平台模板"，跟 editor 视角的 badge 一致。spec 锁住 super_admin
  // 视角看到的也是 "平台"，不是 "无主（孤儿池）"。
  const boss = await seedE2EUser('boss-platform', 'super_admin');
  await seedE2EProduct({ id: 'platform-a', ownerId: null });
  await seedE2EProduct({ id: 'mine-a', ownerId: boss.userId });

  await signInAs(page, boss.email, boss.password);
  await expect(page.locator('text=platform-a').first()).toBeVisible();
  await expect(page.locator('text=mine-a').first()).toBeVisible();

  // ownerless 行的 owner badge 必须是「平台」，不能是「无主（孤儿池）」
  const platformRow = page.locator('li').filter({ hasText: 'platform-a' });
  await expect(platformRow.getByText('平台', { exact: true })).toBeVisible();
  await expect(platformRow.getByText(/无主|孤儿/)).toHaveCount(0);

  // filter chip 不能再叫「无主（孤儿池）」
  await expect(page.getByRole('button', { name: /无主|孤儿/ })).toHaveCount(0);
});

test('super_admin can invite a new editor via the Users panel', async ({ page }) => {
  const boss = await seedE2EUser('boss-invite', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  // Users panel 默认折叠，先展开
  await page.getByRole('button', { expanded: false, name: /授权用户/ }).click();

  // Fill the invite form (email input + submit).
  const email = `invitee-${Date.now()}+asbtest-e2e@example.com`;
  await page.getByPlaceholder('name@gmail.com').fill(email);
  await page.getByRole('button', { name: /邀请|Invite/ }).click();

  // The invitee email now appears in TWO places after a successful invite:
  //   1. the success toast ("invite link ready for {email}")
  //   2. the new row in the user list (the canonical assertion)
  // Use the user-list <span> directly to avoid Playwright's strict-mode
  // ambiguity. The list entries wrap each email in a <span>, the toast does
  // not, so an `exact: true` getByText pinpoints the row only.
  await expect(page.getByText(email, { exact: true })).toBeVisible({ timeout: 10_000 });
});

test('users panel is collapsed by default and force-expands after a successful invite', async ({
  page,
}) => {
  // 2026-05: 跟 LlmChain / QuickScenarios 一起做的折叠 — 邀请频次低。
  // 邀请成功后 inviteResult 不为 null → 强制展开，避免 super_admin
  // 看不到那条一次性 URL 卡片就丢了链接。
  const boss = await seedE2EUser('boss-users-fold', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  // 标题始终可见，body 不可见
  await expect(page.getByRole('heading', { name: /授权用户/ })).toBeVisible();
  await expect(page.getByPlaceholder('name@gmail.com')).toHaveCount(0);

  // 点 chevron 展开
  await page.getByRole('button', { expanded: false, name: /授权用户/ }).click();
  await expect(page.getByPlaceholder('name@gmail.com')).toBeVisible();
});

test('quick scenarios panel is collapsed by default and expands on chevron click', async ({
  page,
}) => {
  // 2026-05: super_admin 反映 admin 主页 panels 太满，QuickScenariosPanel
  // 默认折叠（编辑频次低，Summit 4 站只改一两次）。dirty 状态会强制展开
  // 已在组件层处理（这里不测，避免依赖编辑流程的 schema 细节）。
  const boss = await seedE2EUser('boss-collapse', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  // 标题始终可见
  await expect(page.getByRole('heading', { name: /快速场景/ })).toBeVisible();

  // body 标识：hint 文案 + Reset 按钮 — 这俩只在展开态出现
  const hint = page.getByText(/首页底部展示给观众的预设场景/);
  const resetBtn = page.getByRole('button', { name: /恢复默认/ });

  // 默认态：折叠（hint 和 Reset 都不可见）
  await expect(hint).toHaveCount(0);
  await expect(resetBtn).toHaveCount(0);

  // 点 chevron toggle（aria-controls 锁定到正确的按钮）
  await page.getByRole('button', { expanded: false, name: /快速场景/ }).click();

  // 展开后 body 应该出现
  await expect(hint).toBeVisible();
  await expect(resetBtn).toBeVisible();
});

test('super_admin can switch brand', async ({ page }) => {
  const boss = await seedE2EUser('boss-brand', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  // The BrandSwitch component renders a toggle with "Google" / "AWS" options.
  // Click AWS; the click fires a PUT /api/brand mutation, but the click
  // promise resolves on UI event-loop tick — *before* the network roundtrip.
  // We have to wait for the actual response to land before asserting on the
  // server state, otherwise the GET below races the PUT and reads the stale
  // value.
  const awsButton = page.getByRole('button', { name: /aws/i }).first();
  const putResponse = page.waitForResponse(
    (r) => /\/api\/brand$/.test(r.url()) && r.request().method() === 'PUT' && r.ok(),
  );
  await awsButton.click();
  await putResponse;

  // Confirm the PUT landed by re-reading brand from GET /api/brand
  const res = await page.request.get('/api/brand');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.brand).toBe('aws');
});
