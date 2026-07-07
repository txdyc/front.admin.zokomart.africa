import { test, expect, type Page } from '@playwright/test';

// i18n E2E：登录后从右上角「语言」下拉切换中/英，界面（菜单/工作台）随之切换，
// 且刷新后仍保持所选语言（localStorage 记忆）。
//
// 前置：本地后端运行（连本地 MySQL+Redis），dev server 代理 /api → 后端。

const SUPER = { username: 'superadmin', password: 'Admin@123' };

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  // 默认中文：用户名占位为 superadmin，密码占位为「密码」，按钮为「登录」
  await page.getByPlaceholder('superadmin').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/(dashboard)?$/);
}

async function switchLanguage(page: Page, locale: 'zh-CN' | 'en-US') {
  await page.locator('[data-test="lang-switch"]').hover();
  await page.locator(`[data-test="lang-${locale}"]`).click();
}

test('language switch updates the UI and persists across reload', async ({ page }) => {
  await login(page, SUPER.username, SUPER.password);

  // 默认中文
  await expect(page.getByText('系统管理')).toBeVisible();
  await expect(page.getByText('工作台')).toBeVisible();

  // 切到英文：菜单与工作台标题变英文，中文消失
  await switchLanguage(page, 'en-US');
  await expect(page.getByText('System', { exact: true })).toBeVisible();
  await expect(page.getByText('Dashboard', { exact: true })).toBeVisible();
  await expect(page.getByText('系统管理')).toHaveCount(0);

  // 刷新后仍为英文（localStorage 记忆）
  await page.reload();
  await expect(page.getByText('System', { exact: true })).toBeVisible();
  await expect(page.getByText('系统管理')).toHaveCount(0);

  // 切回中文，恢复默认，避免污染其他用例的浏览器上下文
  await switchLanguage(page, 'zh-CN');
  await expect(page.getByText('系统管理')).toBeVisible();
});
