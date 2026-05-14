import { test, expect } from '@playwright/test';

import { resetTestDb, seedE2EUser } from './helpers/supabase-admin';
import { signInAs } from './helpers/session';

// Translate-product feature (决策 A1+B1+B3+C2+D2+E2+F1):
//   - ✨ 一键翻译 button in ProductEditor lang tab row
//   - Source = zh-CN (固定 F1), targets = zh-HK / en / ja
//   - C2: 只填空 fields，不覆盖已编辑的
//   - B3: 空 tab 浮 inline 气泡引导翻译
//
// 这层 e2e 验 UI 流程，不验真 LLM —— /api/admin/translate/product 在测
// 环境 NODE_ENV=test 下，server 仍会真打 LLM chain (没 mock)。所以这条
// spec 用 route fulfilling 拦截 API call 直接返 stub 响应。

test.beforeEach(async () => {
  await resetTestDb();
});

test('translate button: disabled when zh-CN name empty, fills 3 langs when clicked', async ({
  page,
}) => {
  const ed = await seedE2EUser('ed-translate', 'editor');
  await signInAs(page, ed.email, ed.password);

  // 拦截 translate API → 返 stub 翻译（避免依赖真 LLM）
  await page.route('**/api/admin/translate/product', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        translations: {
          'zh-HK': { name: '繁中名稱', description: '繁中描述', audience: '繁中人群' },
          en: { name: 'EN-Name', description: 'EN desc', audience: 'EN aud' },
          ja: { name: 'JA-名前', description: 'JA 説明', audience: 'JA 対象' },
        },
        failed: [],
        provider: 'gemini',
        latencyMs: 1234,
      }),
    });
  });

  // 打开 新增产品 modal
  await page.getByRole('button', { name: /新增产品/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // B1: translate 按钮可见，但 zh-CN name 空时 disabled
  const translateBtn = page.getByTestId('translate-button');
  await expect(translateBtn).toBeVisible();
  await expect(translateBtn).toBeDisabled();

  // 切到 zh-CN tab 填 name
  await dialog.getByRole('button', { name: '简中' }).click();
  // name input (第一个非 placeholder input) — 这是 dialog 内的第一个 input
  const inputs = dialog.locator('input[type="text"]');
  await inputs.first().fill('客户关系管理 (CRM)');

  // 现在 zh-CN name 有了，按钮 enabled
  await expect(translateBtn).toBeEnabled();

  // 点击翻译
  await translateBtn.click();

  // 翻译完成后切到 EN tab 验证字段被填
  await dialog.getByRole('button', { name: 'EN' }).click();
  await expect(dialog.locator('input[type="text"]').first()).toHaveValue('EN-Name');

  // 切到 繁中 验
  await dialog.getByRole('button', { name: '繁中' }).click();
  await expect(dialog.locator('input[type="text"]').first()).toHaveValue('繁中名稱');

  // 切到 日本語 验
  await dialog.getByRole('button', { name: '日本語' }).click();
  await expect(dialog.locator('input[type="text"]').first()).toHaveValue('JA-名前');
});

test('C2 merge: translate does NOT overwrite already-edited fields', async ({ page }) => {
  const ed = await seedE2EUser('ed-translate-c2', 'editor');
  await signInAs(page, ed.email, ed.password);

  await page.route('**/api/admin/translate/product', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        translations: {
          'zh-HK': { name: 'STUB-繁中', description: 'STUB-繁中-desc', audience: 'STUB-繁中-aud' },
          en: { name: 'STUB-EN', description: 'STUB-EN-desc', audience: 'STUB-EN-aud' },
          ja: { name: 'STUB-JA', description: 'STUB-JA-desc', audience: 'STUB-JA-aud' },
        },
        failed: [],
        provider: 'gemini',
        latencyMs: 1,
      }),
    });
  });

  await page.getByRole('button', { name: /新增产品/ }).click();
  const dialog = page.getByRole('dialog');

  // 简中填了
  await dialog.getByRole('button', { name: '简中' }).click();
  await dialog.locator('input[type="text"]').first().fill('客户关系管理');

  // 用户已经手填了 EN name = "MY-MANUAL-EN" — 这个必须保留
  await dialog.getByRole('button', { name: 'EN' }).click();
  await dialog.locator('input[type="text"]').first().fill('MY-MANUAL-EN');

  // 点翻译
  await page.getByTestId('translate-button').click();

  // EN name 仍然是用户手填的，没被 STUB-EN 覆盖
  await dialog.getByRole('button', { name: 'EN' }).click();
  await expect(dialog.locator('input[type="text"]').first()).toHaveValue('MY-MANUAL-EN');

  // 但 EN description 是空的 → 应该被填上 STUB-EN-desc
  // description 是 textarea，不是 input
  await expect(dialog.locator('textarea').first()).toHaveValue('STUB-EN-desc');
});

test('B3 inline bubble: appears on empty non-zh-CN tab when zh-CN ready', async ({ page }) => {
  const ed = await seedE2EUser('ed-translate-b3', 'editor');
  await signInAs(page, ed.email, ed.password);

  await page.route('**/api/admin/translate/product', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        translations: {
          'zh-HK': { name: 'BBL-繁中', description: '', audience: '' },
          en: { name: 'BBL-EN', description: '', audience: '' },
          ja: { name: 'BBL-JA', description: '', audience: '' },
        },
        failed: [],
        provider: 'gemini',
        latencyMs: 1,
      }),
    });
  });

  await page.getByRole('button', { name: /新增产品/ }).click();
  const dialog = page.getByRole('dialog');

  // 简中填 name + 切到 EN tab → 此 tab 3 field 全空 → bubble 浮出
  await dialog.getByRole('button', { name: '简中' }).click();
  await dialog.locator('input[type="text"]').first().fill('客户关系管理');
  await dialog.getByRole('button', { name: 'EN' }).click();

  const bubble = page.getByTestId('translate-bubble');
  await expect(bubble).toBeVisible();

  // 点 bubble → 跟主按钮一样调 translate API
  await bubble.click();

  // EN name 被填上
  await expect(dialog.locator('input[type="text"]').first()).toHaveValue('BBL-EN');

  // bubble 应该消失（field 不再全空）
  await expect(bubble).toHaveCount(0);
});

test('translate button disabled while request in-flight', async ({ page }) => {
  const ed = await seedE2EUser('ed-translate-loading', 'editor');
  await signInAs(page, ed.email, ed.password);

  // 慢响应模拟 in-flight 状态
  await page.route('**/api/admin/translate/product', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        translations: {
          'zh-HK': { name: 'x', description: '', audience: '' },
          en: { name: 'x', description: '', audience: '' },
          ja: { name: 'x', description: '', audience: '' },
        },
        failed: [],
        provider: 'gemini',
        latencyMs: 1500,
      }),
    });
  });

  await page.getByRole('button', { name: /新增产品/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '简中' }).click();
  await dialog.locator('input[type="text"]').first().fill('客户关系管理');

  const btn = page.getByTestId('translate-button');
  await btn.click();
  // 立刻应该 disabled (translate.isPending)
  await expect(btn).toBeDisabled();
  // 等响应回来 → enabled (zh-CN name 仍在)
  await expect(btn).toBeEnabled({ timeout: 5000 });
});
