import { test, expect } from '@playwright/test';

import { resetTestDb, seedE2EProduct, seedE2EUser } from './helpers/supabase-admin';
import { signInAs } from './helpers/session';

// 用户 2026-05 在生产 admin 截图问"editor 进来能看到新建产品么？"。
//
// 实际行为：能看到 + 能点 + 能成功创建（owner 自动 = 自己）。这是契约 by
// design（CLAUDE.md §2.3："editor 写自己；super_admin 写全部"），
// server side 已有完整测试（server/tests/routes/products.test.ts:61
// "forces ownerId = req.user.id for editors"）。本 spec 锁住前端 UI 这一层 ——
// editor 视角的 ProductList 必须保留这个入口；如果未来谁不小心给按钮加了
// `me.role === 'super_admin'` gate，这个测试在 Summit 之前先红。
//
// 不测的部分：表单完整 save 流程已被 server/tests/routes/products.test.ts
// 覆盖，e2e 这里只验 UI 入口可达即可（避免 schema 漂移让 e2e 跟着碎）。

test.beforeEach(async () => {
  await resetTestDb();
});

test('editor sees the "+ 新增产品" button + can open the editor modal', async ({ page }) => {
  const ed = await seedE2EUser('editor-create', 'editor');
  await seedE2EProduct({ id: 'mine-existing', ownerId: ed.userId });
  await signInAs(page, ed.email, ed.password);

  // 进入 admin 后产品管理 panel 应当可见
  await expect(page.getByRole('heading', { name: /产品管理/ })).toBeVisible();

  // 截图 1: 落地态（带按钮的整页快照，作为视觉证据归档）
  await page.screenshot({
    path: 'test-results/editor-admin-landing.png',
    fullPage: false,
  });

  // 「+ 新增产品」按钮：必须存在 + 必须 enabled
  // i18n 默认是 zh-CN，所以匹配中文文案。如果 i18n 改了把这里同步。
  const addBtn = page.getByRole('button', { name: /新增产品/ });
  await expect(addBtn, 'editor must see the add-product button per §2.3 contract').toBeVisible();
  await expect(addBtn).toBeEnabled();

  // 点击 → ProductEditor modal 弹出
  await addBtn.click();

  // ProductEditor modal 标识：用「保存」+「取消」两个按钮组合识别（modal-only 控件）
  await expect(page.getByRole('button', { name: /保存/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /取消/ })).toBeVisible();

  // 截图 2: editor modal 弹出态
  await page.screenshot({
    path: 'test-results/editor-add-product-modal.png',
    fullPage: false,
  });

  // 用 Cancel 收尾，避免污染 DB（Save 由 server-side products.test.ts 覆盖）
  await page.getByRole('button', { name: /取消/ }).click();
});

test('super_admin also sees the "+ 新增产品" button (regression — not editor-only)', async ({ page }) => {
  // 反向锁：super_admin 也必须看到。如果有人给按钮加了「editor only」错误条件，
  // super_admin 就看不到了 —— 这个 spec 同时保护两个方向。
  const sa = await seedE2EUser('sa-create', 'super_admin');
  await signInAs(page, sa.email, sa.password);

  await expect(page.getByRole('heading', { name: /产品管理/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /新增产品/ })).toBeVisible();
});
