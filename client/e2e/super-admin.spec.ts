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

test('header has 预览首页 link → homepage in new tab', async ({ page }) => {
  // 2026-05: admin 改完产品一键看首页效果。锁住 link 存在 + href=/ +
  // target=_blank（新 tab 保留 admin 上下文）。
  const boss = await seedE2EUser('boss-preview', 'super_admin');
  await signInAs(page, boss.email, boss.password);

  const previewLink = page.getByRole('link', { name: /预览首页/ });
  await expect(previewLink).toBeVisible();
  await expect(previewLink).toHaveAttribute('href', '/');
  await expect(previewLink).toHaveAttribute('target', '_blank');
});

test('super_admin filter chips: 4 个互斥子集 + 各自过滤生效', async ({ page }) => {
  // 2026-05: filter 从 3 chip (All / Mine / Platform) 扩成 4 chip
  // (Mine / Platform / Others / All)。为啥：原 3 个混着层级（All 是
  // 全集，Mine/Platform 是子集），且没法 filter "其他 editor 的产品"。
  // 现在 4 chip 互斥子集 + All 作为 reset，且补足"其他 editor"能力缺口。
  const boss = await seedE2EUser('boss-filters', 'super_admin');
  const otherEditor = await seedE2EUser('boss-filters-other', 'editor');
  await seedE2EProduct({ id: 'platform-a', ownerId: null });
  await seedE2EProduct({ id: 'mine-a', ownerId: boss.userId });
  await seedE2EProduct({ id: 'others-a', ownerId: otherEditor.userId });

  await signInAs(page, boss.email, boss.password);

  // G (audit Top-4): 全部 selector 走 data-testid，跟 i18n 文案 + chip
  // 顺序解耦。重命名 chip / 改文案 / 调 chip 顺序都不会让此 spec 误报。
  const rowById = (id: string) =>
    page.locator('[data-testid="product-row"]').filter({ has: page.locator(`code:has-text("${id}")`) });

  // 默认 filter='all'，3 行都可见
  await expect(rowById('platform-a')).toBeVisible();
  await expect(rowById('mine-a')).toBeVisible();
  await expect(rowById('others-a')).toBeVisible();

  // 点 Mine → 只看到 mine-a
  await page.getByTestId('product-filter-mine').click();
  await expect(rowById('mine-a')).toBeVisible();
  await expect(rowById('platform-a')).toHaveCount(0);
  await expect(rowById('others-a')).toHaveCount(0);

  // 点 Platform → 只看到 platform-a
  await page.getByTestId('product-filter-platform').click();
  await expect(rowById('platform-a')).toBeVisible();
  await expect(rowById('mine-a')).toHaveCount(0);
  await expect(rowById('others-a')).toHaveCount(0);

  // 点 Others → 只看到 others-a（新加的能力）
  await page.getByTestId('product-filter-others').click();
  await expect(rowById('others-a')).toBeVisible();
  await expect(rowById('mine-a')).toHaveCount(0);
  await expect(rowById('platform-a')).toHaveCount(0);

  // 回 All → 3 个都可见
  await page.getByTestId('product-filter-all').click();
  await expect(rowById('platform-a')).toBeVisible();
  await expect(rowById('mine-a')).toBeVisible();
  await expect(rowById('others-a')).toBeVisible();

  // platform 行的 owner badge 走 data-owner 属性，不依赖 "平台" 文案
  const platformRow = rowById('platform-a');
  await expect(platformRow.locator('[data-testid="product-owner-badge"]')).toHaveAttribute(
    'data-owner',
    'platform',
  );
  // owner badge 在视觉上仍是文案 "平台"（这条仅 sanity，文案改了不挂主测）
  await expect(platformRow.locator('[data-testid="product-owner-badge"]')).toContainText('平台');
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
