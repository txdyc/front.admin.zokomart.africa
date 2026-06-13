import { test, expect } from '@playwright/test';

// 前置：本地后端在 :8080 运行（连本地 MySQL+Redis），dev server 代理 /api → :8080。
test('超管登录后进入工作台并看到菜单', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('superadmin').fill('superadmin');
  await page.getByPlaceholder('密码').fill('Admin@123');
  // Ant Design Vue 会在两个汉字间插入空格，可访问名为 "登 录"
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page).toHaveURL(/\/(dashboard)?$/);
  await expect(page.getByText('系统管理')).toBeVisible();
});
