import { test, expect, type Page } from '@playwright/test';

// 采购入库全链（与后端 PurchaseFlowApiTest 同链路）：超管登录 →
// 建供应商 → 建供应商产品 → 建采购计划 → 提交 → 审批通过（生成采购订单）→
// 采购订单：标记明细已付 → 确认（生成实际采购单）→ 实际采购单整单入库 → 断言「已入库」。
// 前置：本地后端运行，dev proxy /api → 后端（VITE_PROXY_TARGET）。终态不清理（时间戳名避免冲突）。

const ts = Date.now();
const supplierName = `Sup_${ts}`;
const productName = `SP_${ts}`;
const productCode = `PC_${ts}`;

async function loginSuper(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('superadmin').fill('superadmin');
  await page.getByPlaceholder('密码').fill('Admin@123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/(dashboard(\/overview)?)?$/);
}
async function pickOption(page: Page, selector: string, title: string) {
  await page.locator(selector).click();
  await page.locator(`.ant-select-item-option[title="${title}"]`).click();
}

test('采购入库：付款→确认→入库→已入库', async ({ page }) => {
  await loginSuper(page);

  // 建供应商
  await page.goto('/basedata/supplier');
  await page.getByRole('button', { name: '新增供应商' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill(supplierName);
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(dialog).toBeHidden();

  // 建供应商产品
  await page.goto('/product/supplier-product');
  await page.getByRole('button', { name: '新增供应商产品' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('.ant-select-selector').first().click();
  await page.locator(`.ant-select-item-option[title="${supplierName}"]`).click();
  await dialog.getByRole('textbox').nth(0).fill(productName);
  await dialog.getByRole('textbox').nth(1).fill(productCode);
  await dialog.getByRole('button', { name: /确\s*定/ }).click({ force: true });
  await expect(dialog).toBeHidden();

  // 建计划 → 提交 → 通过
  await page.goto('/purchase/plan');
  await page.getByRole('button', { name: '新增采购计划' }).click();
  const drawer = page.getByRole('dialog');
  await pickOption(page, '[data-test="cascade-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="cascade-search"]').click();
  await drawer.getByRole('spinbutton').first().fill('3');
  await page.locator('[data-test="plan-save"]').click();
  await expect(drawer).toBeHidden();

  await pickOption(page, '[data-test="plan-filter-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="plan-search"]').click();
  await page.getByRole('row', { name: /草稿/ }).getByText('提交').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await page.getByRole('row', { name: /待审批/ }).getByText('通过').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByRole('row', { name: /已通过/ })).toBeVisible();

  // 采购订单：按供应商过滤 → 详情 → 全选明细 → 标记已付 → 确认
  await page.goto('/purchase/order');
  await pickOption(page, '[data-test="order-filter-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="order-search"]').click();
  await page.locator('[data-test="order-detail"]').first().click();
  const orderDrawer = page.locator('.ant-drawer');
  // 全选明细（表头复选框）
  await orderDrawer.locator('.ant-table-thead .ant-checkbox-input').first().check();
  await page.locator('[data-test="mark-paid"]').click();
  await expect(orderDrawer.getByText('已付').first()).toBeVisible();
  await page.locator('[data-test="order-confirm"]').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();

  // 自动切到实际采购单 Tab → 详情 → 整单入库 → 断言已入库
  await page.locator('[data-test="actual-detail"]').first().click();
  const actualDrawer = page.locator('.ant-drawer');
  await page.locator('[data-test="actual-inbound"]').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await expect(actualDrawer.getByText('已入库').first()).toBeVisible();
});
