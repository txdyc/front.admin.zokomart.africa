import { test, expect, type Page } from '@playwright/test';

// 采购计划全链：超管登录 → 建供应商 → 建供应商产品 → 建计划(联动选品+录数量) →
// 保存草稿 → 提交 → 审批通过 → 断言计划状态变「已通过」（后端据此按供应商生成采购订单）。
// 前置：本地后端运行，dev proxy /api → 后端（VITE_PROXY_TARGET）。
// 注：通过后的计划为终态、且供应商产品被引用，故本用例不做清理（用时间戳名避免冲突）。

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

async function pickSelectOption(page: Page, selectorLocator: string, optionTitle: string) {
  await page.locator(selectorLocator).click();
  await page.locator(`.ant-select-item-option[title="${optionTitle}"]`).click();
}

test('采购计划：建计划→提交→审批通过', async ({ page }) => {
  await loginSuper(page);

  // 1) 建供应商
  await page.goto('/basedata/supplier');
  await page.getByRole('button', { name: '新增供应商' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill(supplierName);
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(dialog).toBeHidden();

  // 2) 建供应商产品（MOQ 默认 1）
  await page.goto('/product/supplier-product');
  await page.getByRole('button', { name: '新增供应商产品' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('.ant-select-selector').first().click();
  await page.locator(`.ant-select-item-option[title="${supplierName}"]`).click();
  await dialog.getByRole('textbox').nth(0).fill(productName);
  await dialog.getByRole('textbox').nth(1).fill(productCode);
  await dialog.getByRole('button', { name: /确\s*定/ }).click({ force: true });
  await expect(dialog).toBeHidden();

  // 3) 建采购计划
  await page.goto('/purchase/plan');
  await page.getByRole('button', { name: '新增采购计划' }).click();
  const drawer = page.getByRole('dialog');
  // 抽屉内 CascadeFilter 选供应商 → 列出该供应商产品
  await pickSelectOption(page, '[data-test="cascade-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="cascade-search"]').click();
  // 在产品行的采购数量输入框录入数量（>= MOQ=1）
  const qty = drawer.getByRole('spinbutton').first();
  await qty.fill('3');
  await expect(drawer.getByText('已选明细（1 项）')).toBeVisible();
  // 保存草稿
  await page.locator('[data-test="plan-save"]').click();
  await expect(drawer).toBeHidden();

  // 4) 列表按供应商过滤 → 提交 → 通过
  await pickSelectOption(page, '[data-test="plan-filter-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="plan-search"]').click();

  // 草稿 → 提交
  await expect(page.getByRole('row', { name: /草稿/ })).toBeVisible();
  await page.getByRole('row', { name: /草稿/ }).getByText('提交').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();

  // 待审批 → 通过
  await expect(page.getByRole('row', { name: /待审批/ })).toBeVisible();
  await page.getByRole('row', { name: /待审批/ }).getByText('通过').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();

  // 断言：已通过
  await expect(page.getByRole('row', { name: /已通过/ })).toBeVisible();
});
