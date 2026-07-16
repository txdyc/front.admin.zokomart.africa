import { test, expect, type Page } from '@playwright/test';

// 面单批量打印流程 E2E：
// 1. 打桩 GET /api/sales-orders/labels（返回 1 单，totalQty=2 → 2 张面单）
// 2. 打桩 window.open + Blob URL（避免真弹窗；onload setter 立即调用，print() 计数）
// 3. 登录超管 → 销售订单列表 → 点击「打印今日面单」→ 抽屉出现，面单数 = 2 →
//    点击「打印（2 张）」→ window.__printed === 1
//
// 前置：本地后端运行，dev proxy /api → 后端（与其他 e2e 约定相同）。
// 注：如果后端未启动，Playwright webServer 超时后测试会以 infra 失败结束，
//     属已知限制（参见 README 测试章节），不是用例本身的问题。

async function loginSuper(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('superadmin').fill('superadmin');
  await page.getByPlaceholder('密码').fill('Admin@123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/(dashboard(\/overview)?)?$/);
}

test('面单批量打印：打开抽屉 → 确认面单数 → 打印', async ({ page }) => {
  // ── 打桩 Blob URL + window.open，让 onload setter 立刻触发 print() ──
  // print.ts 实现：
  //   const url = URL.createObjectURL(new Blob([html], {...}));
  //   const w   = window.open(url, '_blank', ...);
  //   w.onload  = () => { w.focus(); w.print(); URL.revokeObjectURL(url); };
  // 因此桩对象在 onload setter 赋值时立刻调用传入的函数即可驱动 print()。
  await page.addInitScript(() => {
    (window as any).__printed = 0;
    URL.createObjectURL = () => 'blob:stub';
    URL.revokeObjectURL = () => {};
    window.open = (() => {
      const fakeWin: any = {
        document: { open() {}, write() {}, close() {}, readyState: 'complete' },
        focus() {},
        print() {
          (window as any).__printed += 1;
        },
        set onload(fn: (() => void) | null) {
          if (fn) fn();
        },
      };
      return fakeWin;
    }) as any;
  });

  // ── 打桩 /api/sales-orders/labels → 1 单，totalQty=2（= 2 张面单）──
  await page.route('**/sales-orders/labels**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        msg: 'ok',
        data: [
          {
            id: 1,
            orderNo: 'SO001',
            customerName: 'A',
            customerPhone: '024',
            customerAddress: 'Accra',
            totalQty: 2,
            totalAmount: 100,
          },
        ],
      }),
    });
  });

  // ── 登录 & 导航到销售订单列表 ──
  await loginSuper(page);
  await page.goto('/sales/order');

  // ── 打开面单打印抽屉 ──
  await page.locator('[data-test="sales-print-labels"]').click();

  // 抽屉出现
  const drawer = page.locator('.ant-drawer');
  await expect(drawer).toBeVisible();

  // 等待数据加载完成（面单数出现）
  // 1 单 × totalQty 2 = 2 张面单
  await expect(drawer.getByText('2', { exact: false })).toBeVisible({ timeout: 10000 });

  // 确认摘要文本含 "2 张面单"
  const summary = drawer.locator('.mb-3');
  await expect(summary).toContainText('2');

  // ── 点击打印按钮 ──
  await page.locator('[data-test="label-print-go"]').click();

  // 等待打印完成（print() 调用在 onload 同步触发，应立即完成）
  await expect
    .poll(() => page.evaluate(() => (window as any).__printed), { timeout: 5000 })
    .toBe(1);
});
