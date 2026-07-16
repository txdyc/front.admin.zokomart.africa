import { test, expect } from '@playwright/test';

// 前置：本地后端在 :8081 运行（连本地 MySQL+Redis），dev server 代理 /api → :8081。
// 验证 CEO 经营概览：登录后 /dashboard 拉取 overview + sales-trend 并渲染各板块。
test('超管登录后经营概览加载真实数据', async ({ page }) => {
  // 捕获两个仪表盘接口的真实响应，断言业务码成功
  const overviewResp = page.waitForResponse((r) => r.url().includes('/api/dashboard/overview'));
  const trendResp = page.waitForResponse((r) => r.url().includes('/api/dashboard/sales-trend'));

  await page.goto('/login');
  await page.getByPlaceholder('superadmin').fill('superadmin');
  await page.getByPlaceholder('密码').fill('Admin@123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  // 目录 /dashboard 重定向到首个子菜单 /dashboard/overview
  await expect(page).toHaveURL(/\/dashboard(\/overview)?$/);

  const overview = await (await overviewResp).json();
  const trend = await (await trendResp).json();
  expect(overview.code).toBe(0);
  expect(trend.code).toBe(0);
  expect(overview.data.financial).toBeTruthy();
  expect(overview.data.fulfillment).toBeTruthy();

  // KPI：净收入卡片渲染为 ₵ 金额（非空占位）
  await expect(page.getByText('净收入', { exact: true })).toBeVisible();
  const hero = page.locator('.kpi-value.hero');
  await expect(hero).toHaveText(/₵[\d,.]+[KM]?/);

  // 漏斗与交付结果
  await expect(page.getByText('订单履约漏斗')).toBeVisible();
  await expect(page.locator('.fn-label', { hasText: '原始下单' })).toBeVisible();
  await expect(page.getByText('交付结果')).toBeVisible();

  // 销售拆解与热销产品表格（至少一行数据）
  await expect(page.getByText('按分类收入')).toBeVisible();
  await expect(page.locator('.ant-table-tbody tr').first()).toBeVisible();

  // 切换时间范围触发重新拉取
  const refetch = page.waitForResponse((r) => r.url().includes('/api/dashboard/overview'));
  await page.locator('.ant-radio-button-wrapper', { hasText: '近7天' }).click();
  expect((await (await refetch).json()).code).toBe(0);
});
