import { test, expect, type Page } from '@playwright/test';

// 品牌模块全链：超管登录 → 新增（时间戳名）→ 列表可见 → 删除。
// 前置：本地后端运行，dev proxy /api → 后端（VITE_PROXY_TARGET）。

const brandName = `Brand_${Date.now()}`;

async function loginSuper(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('superadmin').fill('superadmin');
  await page.getByPlaceholder('密码').fill('Admin@123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/(dashboard)?$/);
}

test('品牌新增后可见并可删除', async ({ page }) => {
  await loginSuper(page);
  await page.goto('/basedata/brand');

  // 新增
  await page.getByRole('button', { name: '新增品牌' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill(brandName);
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(dialog).toBeHidden();

  // 按关键字查询后列表可见
  await page.getByPlaceholder('品牌名/编码').fill(brandName);
  await page.getByRole('button', { name: /查\s*询/ }).click();
  const row = page.getByRole('row', { name: new RegExp(brandName) });
  await expect(row).toBeVisible();

  // 删除
  await row.getByText('删除').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(brandName) })).toHaveCount(0);
});
