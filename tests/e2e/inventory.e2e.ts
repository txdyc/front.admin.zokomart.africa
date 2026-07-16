import { test, expect, type Page } from '@playwright/test';

// 库存全链：超管登录 → 建供应商/产品 → 计划→提交→通过 → 订单付款→确认 → 实际单入库 →
// 库存页按供应商筛选可见（数量=入库量 3）→ 手工调整到 99 → 列表回显 99。
// 前置：本地后端运行，dev proxy /api → 后端（VITE_PROXY_TARGET）。终态不清理（时间戳名）。

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

test('库存：入库后可见并可手工调整', async ({ page }) => {
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

  // 计划 → 提交 → 通过
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

  // 订单付款 → 确认
  await page.goto('/purchase/order');
  await pickOption(page, '[data-test="order-filter-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="order-search"]').click();
  await page.locator('[data-test="order-detail"]').first().click();
  await page.locator('.ant-drawer .ant-table-thead .ant-checkbox-input').first().check();
  await page.locator('[data-test="mark-paid"]').click();
  await page.locator('[data-test="order-confirm"]').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();

  // 实际单入库
  await page.locator('[data-test="actual-detail"]').first().click();
  await page.locator('[data-test="actual-inbound"]').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.locator('.ant-drawer').getByText('已入库').first()).toBeVisible();

  // 库存页：筛选 → 可见(数量 3) → 调整为 99 → 回显
  await page.goto('/inventory/stock');
  await pickOption(page, '[data-test="cascade-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="cascade-search"]').click();
  const row = page.getByRole('row', { name: new RegExp(productName) });
  await expect(row).toBeVisible();
  await row.locator('[data-test="stock-adjust"]').click();
  const adjustDialog = page.getByRole('dialog');
  const qtyInput = adjustDialog.getByRole('spinbutton').first();
  await qtyInput.fill('99');
  await adjustDialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(`${productName}.*99`) })).toBeVisible();
});
