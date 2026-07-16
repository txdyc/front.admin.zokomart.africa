import { test, expect, type Page } from '@playwright/test';

// 供应商产品全链：超管登录 → 建供应商 → 建供应商产品 → CascadeFilter 按供应商筛选可见 → 清理。
// 前置：本地后端运行，dev proxy /api → 后端（VITE_PROXY_TARGET）。

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

test('供应商产品：建供应商→建产品→联动筛选可见', async ({ page }) => {
  await loginSuper(page);

  // 1) 建供应商
  await page.goto('/basedata/supplier');
  await page.getByRole('button', { name: '新增供应商' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill(supplierName);
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(dialog).toBeHidden();

  // 2) 建供应商产品
  await page.goto('/product/supplier-product');
  await page.getByRole('button', { name: '新增供应商产品' }).click();
  dialog = page.getByRole('dialog');
  // 表单首个下拉为供应商
  await dialog.locator('.ant-select-selector').first().click();
  await page.locator(`.ant-select-item-option[title="${supplierName}"]`).click();
  // 名称、产品编码为前两个文本框
  await dialog.getByRole('textbox').nth(0).fill(productName);
  await dialog.getByRole('textbox').nth(1).fill(productCode);
  await dialog.getByRole('button', { name: /确\s*定/ }).click({ force: true });
  await expect(dialog).toBeHidden();

  // 3) CascadeFilter 选供应商 → 查询 → 产品可见
  await page.locator('[data-test="cascade-supplier"] .ant-select-selector').click();
  await page.locator(`.ant-select-item-option[title="${supplierName}"]`).click();
  await page.locator('[data-test="cascade-search"]').click();
  const row = page.getByRole('row', { name: new RegExp(productName) });
  await expect(row).toBeVisible();

  // 4) 清理：删产品 → 删供应商
  await row.getByText('删除').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(productName) })).toHaveCount(0);

  await page.goto('/basedata/supplier');
  await page.getByPlaceholder('供应商名/编码').fill(supplierName);
  await page.getByRole('button', { name: /查\s*询/ }).click();
  const supRow = page.getByRole('row', { name: new RegExp(supplierName) });
  await supRow.getByText('删除').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByRole('row', { name: new RegExp(supplierName) })).toHaveCount(0);
});
