import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Upload } from 'ant-design-vue';
import SalesOrderImportModal from '@/views/sales/order/SalesOrderImportModal.vue';
import type { SalesOrderImportResult } from '@/types/sales';

const importRes: SalesOrderImportResult = {
  totalRows: 14,
  orderCount: 9,
  success: 8,
  skipped: 0,
  failed: 1,
  errors: [
    {
      rows: '4,5,6,7',
      externalOrderIds: 'SSK202609151503',
      customerName: 'Baaba Maison',
      productCode: 'BD-55',
      reason: '产品编码不存在: BD-55',
    },
  ],
};

const apiSalesOrderImport = vi.fn(async (..._a: any[]) => importRes);
vi.mock('@/api/sales/order', () => ({
  apiSalesOrderImport: (...a: any[]) => apiSalesOrderImport(...a),
}));

const stubs = {
  'a-modal': true, 'a-upload': true, 'a-button': true, 'a-table': true,
  'a-tag': true, 'a-space': true, 'a-alert': true, 'a-descriptions': true,
  'a-descriptions-item': true,
};
const mountModal = () =>
  mount(SalesOrderImportModal, { props: { visible: true }, global: { stubs } });

const xlsxFile = () =>
  new File(['x'], 'orders.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

describe('销售订单导入弹窗', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiSalesOrderImport.mockClear();
  });

  it('未选文件时提交不调接口', async () => {
    const w = mountModal();
    await flushPromises();
    await w.vm.onSubmit();
    expect(apiSalesOrderImport).not.toHaveBeenCalled();
  });

  it('beforeUpload 接受 .xlsx 并填入 file', async () => {
    const w = mountModal();
    await flushPromises();
    const f = xlsxFile();
    expect(w.vm.beforeUpload(f)).toBe(false); // 阻止自动上传
    expect(w.vm.file).toBe(f);
  });

  it('beforeUpload 拒绝非 .xlsx，不填入 file', async () => {
    const w = mountModal();
    await flushPromises();
    const csv = new File(['x'], 'orders.csv', { type: 'text/csv' });
    // LIST_IGNORE 而不是 false：false 只是阻止自动上传，仍会把被拒绝的文件塞进 a-upload
    // 的文件列表，看起来像已选中；LIST_IGNORE 才会让 Ant 真正忽略这个文件。
    expect(w.vm.beforeUpload(csv)).toBe(Upload.LIST_IGNORE);
    expect(w.vm.file).toBe(null);
  });

  it('提交后调接口、回填 result、emit ok 并清空 file', async () => {
    const w = mountModal();
    await flushPromises();
    w.vm.beforeUpload(xlsxFile());
    await w.vm.onSubmit();
    await flushPromises();
    expect(apiSalesOrderImport).toHaveBeenCalledTimes(1);
    expect(w.vm.result).toEqual(importRes);
    expect(w.emitted('ok')).toBeTruthy();
    expect(w.vm.file).toBe(null);
  });

  it('提交携带 FormData，字段名为 file', async () => {
    const w = mountModal();
    await flushPromises();
    const f = xlsxFile();
    w.vm.beforeUpload(f);
    await w.vm.onSubmit();
    await flushPromises();
    const form = apiSalesOrderImport.mock.calls[0][0] as FormData;
    expect(form.get('file')).toBe(f);
  });
});
