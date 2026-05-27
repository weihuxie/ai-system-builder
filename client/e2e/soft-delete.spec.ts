import { test, expect } from '@playwright/test';

import { resetTestDb, seedE2EProduct, seedE2EUser } from './helpers/supabase-admin';
import { signInAs } from './helpers/session';

// 软删除 + 回收站 + 撤销 toast (0006, A+B). 误删防护：删除走软删（标 deleted_at），
// 撤销 toast 或回收站都能恢复。
//
// data-testid 解耦文案：product-delete / product-restore / product-filter-trash /
// product-row（详见 ProductList.tsx）。

test.beforeEach(async () => {
  await resetTestDb();
});

const rowById = (page: import('@playwright/test').Page, id: string) =>
  page.locator('[data-testid="product-row"]').filter({ has: page.locator(`code:has-text("${id}")`) });

test('super_admin: delete → recycle bin → restore → back in list', async ({ page }) => {
  const boss = await seedE2EUser('boss-soft', 'super_admin');
  await seedE2EProduct({ id: 'delete-me', ownerId: null });
  await signInAs(page, boss.email, boss.password);

  // visible in default list
  await expect(rowById(page, 'delete-me')).toBeVisible();

  // delete (soft) — row leaves the live list
  await rowById(page, 'delete-me').getByTestId('product-delete').click();
  await expect(rowById(page, 'delete-me')).toHaveCount(0);

  // switch to 回收站 → product is there
  await page.getByTestId('product-filter-trash').click();
  await expect(rowById(page, 'delete-me')).toBeVisible();

  // restore → leaves bin
  await rowById(page, 'delete-me').getByTestId('product-restore').click();
  await expect(rowById(page, 'delete-me')).toHaveCount(0);

  // back in the live "全部" list
  await page.getByTestId('product-filter-all').click();
  await expect(rowById(page, 'delete-me')).toBeVisible();
});

test('super_admin: delete shows undo toast that restores', async ({ page }) => {
  const boss = await seedE2EUser('boss-undo', 'super_admin');
  await seedE2EProduct({ id: 'oops-del', ownerId: null });
  await signInAs(page, boss.email, boss.password);

  await rowById(page, 'oops-del').getByTestId('product-delete').click();
  await expect(rowById(page, 'oops-del')).toHaveCount(0);

  // sonner toast with undo action — click 撤销
  const undo = page.getByRole('button', { name: /撤销/ });
  await expect(undo).toBeVisible();
  await undo.click();

  // product restored to the list
  await expect(rowById(page, 'oops-del')).toBeVisible({ timeout: 10_000 });
});

test('editor: 回收站 toggle only appears when they have deleted products', async ({ page }) => {
  const ed = await seedE2EUser('ed-bin', 'editor');
  await seedE2EProduct({ id: 'ed-prod', ownerId: ed.userId });
  await signInAs(page, ed.email, ed.password);

  // no deleted products yet → no 回收站 toggle
  await expect(page.getByTestId('product-filter-trash')).toHaveCount(0);

  // delete own product
  await rowById(page, 'ed-prod').getByTestId('product-delete').click();
  await expect(rowById(page, 'ed-prod')).toHaveCount(0);

  // now 回收站 toggle appears
  await expect(page.getByTestId('product-filter-trash')).toBeVisible();

  // open bin → restore
  await page.getByTestId('product-filter-trash').click();
  await rowById(page, 'ed-prod').getByTestId('product-restore').click();
  await expect(rowById(page, 'ed-prod')).toHaveCount(0); // left the bin
});
