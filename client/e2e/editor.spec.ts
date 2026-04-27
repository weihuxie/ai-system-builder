import { test, expect } from '@playwright/test';

import { resetTestDb, seedE2EProduct, seedE2EUser } from './helpers/supabase-admin';
import { signInAs } from './helpers/session';

test.beforeEach(async () => {
  await resetTestDb();
});

test('editor sees ProductList but NOT BrandSwitch / LlmChain / Users panel', async ({ page }) => {
  const ed = await seedE2EUser('editor-a', 'editor');
  await seedE2EProduct({ id: 'ed-a-prod', ownerId: ed.userId });
  await signInAs(page, ed.email, ed.password);

  // Products panel visible (zh-CN default: "产品管理")
  await expect(page.getByRole('heading', { name: /产品管理/ })).toBeVisible();
  // Editor-only role hides these:
  await expect(page.getByText(/品牌切换/)).toHaveCount(0);
  await expect(page.getByText(/授权用户/)).toHaveCount(0);
  // The editor can see their own product.
  await expect(page.locator('text=ed-a-prod').first()).toBeVisible();
});

test('editor cannot see another editor\'s product in the list (server filter via mine role)', async ({ page }) => {
  const ed1 = await seedE2EUser('ed-own', 'editor');
  const ed2 = await seedE2EUser('ed-other', 'editor');
  await seedE2EProduct({ id: 'ed1-only', ownerId: ed1.userId });
  await seedE2EProduct({ id: 'ed2-only', ownerId: ed2.userId });

  await signInAs(page, ed1.email, ed1.password);

  await expect(page.locator('text=ed1-only').first()).toBeVisible();
  // Client-side filter: editor role sees only products where ownerId === self.id
  await expect(page.locator('text=ed2-only')).toHaveCount(0);
});

test('editor can clone their own product', async ({ page }) => {
  const ed = await seedE2EUser('ed-clone', 'editor');
  await seedE2EProduct({ id: 'cloneme', ownerId: ed.userId });
  await signInAs(page, ed.email, ed.password);

  await expect(page.locator('text=cloneme').first()).toBeVisible();

  // Click the Clone button (aria-label contains the localized "克隆" string).
  const cloneButton = page.getByRole('button', { name: /克隆|Clone|複製/ }).first();
  await cloneButton.click();

  // New row appears with -copy suffix.
  await expect(page.locator('text=cloneme-copy').first()).toBeVisible({ timeout: 10_000 });
});

test('editor sees platform products (ownerId=null) as read-only reference', async ({ page }) => {
  const ed = await seedE2EUser('ed-platform', 'editor');
  await seedE2EProduct({ id: 'plat-ref', ownerId: null });
  await seedE2EProduct({ id: 'mine-x', ownerId: ed.userId });
  await signInAs(page, ed.email, ed.password);

  // Both visible: the editor's own + the platform-seeded reference.
  await expect(page.locator('text=plat-ref').first()).toBeVisible();
  await expect(page.locator('text=mine-x').first()).toBeVisible();

  // Editor's own row carries the "我的" badge; platform row carries "平台".
  const myRow = page.locator('li').filter({ hasText: 'mine-x' });
  const platRow = page.locator('li').filter({ hasText: 'plat-ref' });
  await expect(myRow.getByText('我的')).toBeVisible();
  await expect(platRow.getByText('平台')).toBeVisible();

  // Platform row's edit + delete buttons should be disabled (server-enforced
  // via canEditProduct, but UI also greys them so editor can't even attempt).
  // The buttons stay rendered for layout consistency, just disabled.
  await expect(platRow.getByRole('button', { name: /编辑|Edit|編輯/ })).toBeDisabled();
  await expect(platRow.getByRole('button', { name: /删除|Delete|刪除/ })).toBeDisabled();
});

test('editor sees their email + role badge in the header', async ({ page }) => {
  const ed = await seedE2EUser('ed-identity', 'editor');
  await signInAs(page, ed.email, ed.password);

  // Email is shown verbatim somewhere in the header strip.
  await expect(page.getByText(ed.email).first()).toBeVisible();
  // Role badge — zh-CN default.
  await expect(page.getByText(/编辑者/).first()).toBeVisible();
});
