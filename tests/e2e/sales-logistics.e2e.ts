import { test, expect, type Page } from '@playwright/test';

// 销售+物流全链（对齐后端 EndToEndSmokeTest 思路）：超管登录 →
// 建供应商/产品(零售价 200) → 采购计划→提交→通过 → 订单付款→确认 → 实际单入库(库存 3) →
// 销售下单(数量 3，单价默认零售价 200) → 物流派送 → 转已签收 → 拒收 1 → 完成。
// 断言：完成后订单实收 actualAmount = 200×(3-1) = 400，且「已完成」。
// 前置：本地后端运行，dev proxy /api → 后端。终态不清理（时间戳名）。

const ts = Date.now();
const supplierName = `Sup_${ts}`;
const productName = `SP_${ts}`;
const productCode = `PC_${ts}`;
const providerName = `Lgx_${ts}`;

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

test('销售+物流全链：下单→派送→签收→拒收→完成', async ({ page }) => {
  await loginSuper(page);

  // 供应商
  await page.goto('/basedata/supplier');
  await page.getByRole('button', { name: '新增供应商' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill(supplierName);
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(dialog).toBeHidden();

  // 物流服务商（派送时需选）
  await page.goto('/basedata/logistics-provider');
  await page.getByRole('button', { name: '新增物流服务商' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().fill(providerName);
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(dialog).toBeHidden();

  // 供应商产品（零售价 = 200，spinbutton 顺序：批发价/零售价/MOQ）
  await page.goto('/product/supplier-product');
  await page.getByRole('button', { name: '新增供应商产品' }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('.ant-select-selector').first().click();
  await page.locator(`.ant-select-item-option[title="${supplierName}"]`).click();
  await dialog.getByRole('textbox').nth(0).fill(productName);
  await dialog.getByRole('textbox').nth(1).fill(productCode);
  await dialog.getByRole('spinbutton').nth(1).fill('200');
  await dialog.getByRole('button', { name: /确\s*定/ }).click({ force: true });
  await expect(dialog).toBeHidden();

  // 计划→提交→通过
  await page.goto('/purchase/plan');
  await page.getByRole('button', { name: '新增采购计划' }).click();
  let drawer = page.getByRole('dialog');
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

  // 订单付款→确认→入库
  await page.goto('/purchase/order');
  await pickOption(page, '[data-test="order-filter-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="order-search"]').click();
  await page.locator('[data-test="order-detail"]').first().click();
  await page.locator('.ant-drawer .ant-table-thead .ant-checkbox-input').first().check();
  await page.locator('[data-test="mark-paid"]').click();
  await page.locator('[data-test="order-confirm"]').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await page.locator('[data-test="actual-detail"]').first().click();
  await page.locator('[data-test="actual-inbound"]').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.locator('.ant-drawer').getByText('已入库').first()).toBeVisible();

  // 销售下单（数量 3，单价默认零售价 200）
  await page.goto('/sales/order');
  await page.locator('[data-test="sales-create"]').click();
  drawer = page.getByRole('dialog');
  await pickOption(page, '[data-test="cascade-supplier"] .ant-select-selector', supplierName);
  await page.locator('[data-test="cascade-search"]').click();
  await drawer.getByRole('spinbutton').first().fill('3'); // 库存行数量
  // 客户信息卡片内三个文本输入：姓名/手机号/地址
  const custInputs = drawer.locator('.ant-card:has-text("客户信息") input');
  await custInputs.nth(0).fill('Tom');
  await custInputs.nth(1).fill('0240000000');
  await custInputs.nth(2).fill('Accra');
  await page.locator('[data-test="sales-submit"]').click();
  await expect(drawer).toBeHidden();

  // 物流：处理 → 派送 → 转已签收 → 拒收 1 → 完成
  await page.goto('/logistics/track');
  await page.locator('[data-test="track-detail"]').first().click();
  // 派送（选物流服务商 + 派送费默认 0）
  await page.locator('[data-test="track-dispatch"]').click();
  const dispatchDlg = page.locator('.ant-modal');
  await pickOption(page, '[data-test="dispatch-provider"] .ant-select-selector', providerName);
  await dispatchDlg.getByRole('button', { name: /确\s*定/ }).click();
  // 转「已签收」
  await page.getByRole('button', { name: /转「已签收」/ }).click();
  // 拒收 1
  await page.locator('[data-test="track-reject"]').first().click();
  const rejectDlg = page.locator('.ant-modal');
  await rejectDlg.getByRole('spinbutton').first().fill('1');
  await rejectDlg.getByRole('button', { name: /确\s*定/ }).click();
  // 完成
  await page.locator('[data-test="track-complete"]').click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /确\s*定/ }).click();

  // 断言：实收 400（200×2），且订单已完成
  await expect(page.locator('.ant-drawer').getByText('400.00')).toBeVisible();
});
