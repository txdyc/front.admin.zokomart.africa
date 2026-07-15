import { test, expect, type Page } from '@playwright/test';

// 角色权限走查（用 V7/V17 模板角色）：超管为每个角色建一个用户并赋角色，
// 然后以该用户登录，断言只见对应顶级菜单、不见他域菜单，且越权直达路由不可达（落 404）。
// 前置：本地后端运行（V17 已应用），dev proxy /api → 后端。

const SUPER = { username: 'superadmin', password: 'Admin@123' };

interface RoleCase {
  roleLabel: string; // 角色下拉中的中文名
  visibleMenu: string; // 应可见的顶级菜单
  hiddenMenu: string; // 不应可见的他域菜单
  forbiddenPath: string; // 越权直达路由
  forbiddenText: string; // 该路由页面的标志性文案（应不可见）
}

const CASES: RoleCase[] = [
  { roleLabel: '采购员', visibleMenu: '采购管理', hiddenMenu: '系统管理', forbiddenPath: '/system/user', forbiddenText: '新增用户' },
  { roleLabel: '仓库管理员', visibleMenu: '库存管理', hiddenMenu: '采购管理', forbiddenPath: '/purchase/plan', forbiddenText: '新增采购计划' },
  { roleLabel: '销售支持', visibleMenu: '销售管理', hiddenMenu: '采购管理', forbiddenPath: '/purchase/plan', forbiddenText: '新增采购计划' },
  { roleLabel: '物流支持', visibleMenu: '物流管理', hiddenMenu: '销售管理', forbiddenPath: '/sales/order', forbiddenText: '新增销售订单' },
];

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('superadmin').fill(username);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/(dashboard)?$/);
}
async function logout(page: Page) {
  // 越权直达可能落到无 BasicLayout 的 404 页，先回首页确保 header 存在。
  await page.goto('/');
  // header 含两个 .cursor-pointer：语言切换在前，用户下拉在后（含「退出登录」）。
  await page.locator('header .cursor-pointer').last().hover();
  await page.getByText('退出登录').click();
  await expect(page).toHaveURL(/\/login/);
}

for (const c of CASES) {
  test(`角色走查：${c.roleLabel} 只见 ${c.visibleMenu}，越权 ${c.forbiddenPath} 被拦`, async ({ page }) => {
    const user = { username: `role_${c.roleLabel}_${Date.now()}`, password: 'Role@1234' };

    // 1) 超管建用户
    await login(page, SUPER.username, SUPER.password);
    await page.goto('/system/user');
    await page.getByRole('button', { name: '新增用户' }).click();
    const createDialog = page.getByRole('dialog');
    await createDialog.getByPlaceholder('请输入初始密码').fill(user.password);
    await createDialog.getByRole('textbox').first().fill(user.username);
    await createDialog.getByRole('button', { name: /确\s*定/ }).click();
    await expect(createDialog).toBeHidden();

    // 2) 赋角色
    const row = page.getByRole('row', { name: new RegExp(user.username) });
    await row.getByText('赋角色').click();
    const roleDialog = page.getByRole('dialog');
    await roleDialog.locator('.ant-select-selector').click();
    await page.locator(`.ant-select-item-option[title="${c.roleLabel}"]`).click();
    await roleDialog.getByText('分配角色').click();
    await roleDialog.getByRole('button', { name: /确\s*定/ }).click({ force: true });
    await expect(roleDialog).toBeHidden();

    // 3) 以该用户登录
    await logout(page);
    await login(page, user.username, user.password);

    // 4) 菜单可见性
    await expect(page.getByText(c.visibleMenu).first()).toBeVisible();
    await expect(page.getByText(c.hiddenMenu)).toHaveCount(0);

    // 5) 越权直达路由不可达（无该动态路由 → 落 404）
    await page.goto(c.forbiddenPath);
    await expect(page.getByText(c.forbiddenText)).toHaveCount(0);

    await logout(page);
  });
}
