import { test, expect, type Page } from '@playwright/test';

// 权限边界 E2E：超管建「采购员」用户 → 赋 BUYER 角色 → 该用户登录后
// 仅见「采购管理」、不见「系统管理」，且直接访问 /system/user 不可达。
//
// 前置：本地后端运行（连本地 MySQL+Redis），dev server 代理 /api → 后端。
// 后端非默认 8080 时用 VITE_PROXY_TARGET 覆盖（见 README/实施计划）。

const SUPER = { username: 'superadmin', password: 'Admin@123' };
const buyer = { username: `buyer_${Date.now()}`, password: 'Buyer@123' };

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('superadmin').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/(dashboard(\/overview)?)?$/);
}

async function logout(page: Page) {
  // 顶栏用户名下拉（hover 触发）→ 退出登录
  await page.locator('header .cursor-pointer').first().hover();
  await page.getByText('退出登录').click();
  await expect(page).toHaveURL(/\/login/);
}

test('采购员只见采购管理、访问系统管理被拦', async ({ page }) => {
  // 1) 超管登录并创建采购员用户
  await login(page, SUPER.username, SUPER.password);
  await page.goto('/system/user');
  await expect(page.getByRole('button', { name: '新增用户' })).toBeVisible();
  await page.getByRole('button', { name: '新增用户' }).click();

  const createDialog = page.getByRole('dialog');
  await createDialog.getByPlaceholder('请输入初始密码').fill(buyer.password);
  // 用户名输入框（弹窗内第一个文本框）
  await createDialog.getByRole('textbox').first().fill(buyer.username);
  await createDialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(createDialog).toBeHidden(); // 保存成功后弹窗关闭

  // 2) 给该用户赋 BUYER(采购员) 角色
  const row = page.getByRole('row', { name: new RegExp(buyer.username) });
  await row.getByText('赋角色').click();
  const roleDialog = page.getByRole('dialog');
  await roleDialog.locator('.ant-select-selector').click();
  await page.locator('.ant-select-item-option[title="采购员"]').click();
  await roleDialog.getByText('分配角色').click(); // 点标题关闭下拉，避免遮挡确定按钮
  await roleDialog.getByRole('button', { name: /确\s*定/ }).click({ force: true });
  await expect(roleDialog).toBeHidden(); // 角色更新成功后弹窗关闭

  // 3) 退出、以采购员登录
  await logout(page);
  await login(page, buyer.username, buyer.password);

  // 4) 边界断言：见采购管理、不见系统管理
  await expect(page.getByText('采购管理')).toBeVisible();
  await expect(page.getByText('系统管理')).toHaveCount(0);

  // 5) 直接访问 /system/user 不可达（无该动态路由 → 落到 404）
  await page.goto('/system/user');
  await expect(page.getByText('新增用户')).toHaveCount(0);
});
