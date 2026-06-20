import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const apiSalesOrderLabels = vi.fn(async (..._a: any[]) => [
  { id: 1, orderNo: 'SO001', customerName: 'A', customerPhone: '024',
    customerAddress: 'Accra', totalQty: 2, totalAmount: 100 },
  { id: 2, orderNo: 'SO002', customerName: 'B', customerPhone: '025',
    customerAddress: 'Kumasi', totalQty: 1, totalAmount: 50 },
]);
vi.mock('@/api/sales/order', () => ({
  apiSalesOrderLabels: (...a: any[]) => apiSalesOrderLabels(...a),
}));

const printHtml = vi.fn((_html: string) => true);
vi.mock('@/utils/label/print', () => ({ printHtml: (html: string) => printHtml(html) }));

import LabelPrintDrawer from '@/views/sales/order/LabelPrintDrawer.vue';

describe('面单打印抽屉', () => {
  beforeEach(() => vi.clearAllMocks());

  it('打开时拉取今日待派送订单并默认全选', async () => {
    const wrapper = mount(LabelPrintDrawer);
    (wrapper.vm as any).openDrawer();
    await flushPromises();
    expect(apiSalesOrderLabels).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING_DISPATCH' }),
    );
    expect((wrapper.vm as any).labelCount).toBe(3);
  });

  it('打印：调用 printHtml，传入含 3 张 .label 的 HTML', async () => {
    const wrapper = mount(LabelPrintDrawer);
    (wrapper.vm as any).openDrawer();
    await flushPromises();
    await (wrapper.vm as any).doPrint();
    await flushPromises();
    expect(printHtml).toHaveBeenCalledTimes(1);
    const html = (printHtml.mock.calls[0] as [string])[0];
    expect((html.match(/class="label"/g) || []).length).toBe(3);
  });
});
