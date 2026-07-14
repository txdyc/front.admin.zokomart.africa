import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RawOrderPage from '@/views/order/raw/index.vue';

const apiRawOrderPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiRawOrderUpdate = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/order/rawOrder', () => ({
  apiRawOrderPage: (...a: any[]) => apiRawOrderPage(...a),
  apiRawOrderImport: vi.fn(),
  apiRawOrderUpdate: (...a: any[]) => apiRawOrderUpdate(...a),
}));

const stubs = {
  'a-card': true, 'a-form': true, 'a-form-item': true, 'a-input': true,
  'a-select': true, 'a-range-picker': true, 'a-button': true, 'a-space': true,
  'a-tag': true, BasicTable: true, RawOrderImportModal: true,
  'a-modal': true, SchemaForm: true, 'a-table': true,
};
const mountPage = () => mount(RawOrderPage, {
  global: { stubs, directives: { perm: {} } },
});

describe('原始订单页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiRawOrderPage.mockClear();
  });

  it('首次挂载触发一次查询', async () => {
    const w = mountPage();
    await flushPromises();
    expect(apiRawOrderPage).toHaveBeenCalledTimes(1);
    expect(w.vm.query).toMatchObject({ current: 1, size: 10 });
  });

  it('searchForm 改变后 onSearch 把 keyword 重置到第 1 页', async () => {
    const w = mountPage();
    await flushPromises();
    apiRawOrderPage.mockClear();
    w.vm.searchForm.keyword = '0555000001';
    w.vm.searchForm.status = 'PAID';
    w.vm.onSearch();
    await flushPromises();
    expect(apiRawOrderPage).toHaveBeenCalledTimes(1);
    expect(apiRawOrderPage.mock.calls[0][0]).toMatchObject({
      keyword: '0555000001', status: 'PAID', current: 1,
    });
  });

  it('onReset 清空 searchForm 并重新查询', async () => {
    const w = mountPage();
    await flushPromises();
    w.vm.searchForm.keyword = 'abc';
    w.vm.searchForm.status = 'PAID';
    apiRawOrderPage.mockClear();
    w.vm.onReset();
    await flushPromises();
    expect(w.vm.searchForm.keyword).toBe('');
    expect(w.vm.searchForm.status).toBe(undefined);
    expect(apiRawOrderPage).toHaveBeenCalledTimes(1);
  });

  it('点击导入按钮打开 ImportModal', async () => {
    const w = mountPage();
    await flushPromises();
    expect(w.vm.importOpen).toBe(false);
    w.vm.openImport();
    expect(w.vm.importOpen).toBe(true);
  });

  const row = {
    id: '9007199254740993', orderDate: '2026-07-05', brand: 'Hisense', price: 899,
    customerName: 'Kwame', city: 'Accra', address: '1 Test Ave', telephone: '0599',
    productName: 'Washer W1', productCode: 'UI-A', quantity: 1, status: 'PAID' as const,
    cod: 899, freight: 30, balance: 0, createTime: null,
  };

  it('openEdit 预填 14 个业务字段并打开弹窗（不含 id）', async () => {
    const w = mountPage();
    await flushPromises();
    w.vm.openEdit(row);
    expect(w.vm.editOpen).toBe(true);
    expect(w.vm.editInitial).toMatchObject({ brand: 'Hisense', status: 'PAID', quantity: 1, orderDate: '2026-07-05' });
    expect(w.vm.editInitial.id).toBeUndefined();
  });

  it('onEditSubmit 校验通过后按行 id 调更新接口、关弹窗并刷新列表', async () => {
    const w = mountPage();
    await flushPromises();
    w.vm.openEdit(row);
    w.vm.editFormRef = {
      validate: async () => true,
      getValues: () => ({ ...w.vm.editInitial, brand: 'Nasco' }),
    } as any;
    apiRawOrderPage.mockClear();
    await w.vm.onEditSubmit();
    expect(apiRawOrderUpdate).toHaveBeenCalledTimes(1);
    expect(apiRawOrderUpdate.mock.calls[0][0]).toBe('9007199254740993');
    expect(apiRawOrderUpdate.mock.calls[0][1]).toMatchObject({ brand: 'Nasco' });
    expect(w.vm.editOpen).toBe(false);
    expect(apiRawOrderPage).toHaveBeenCalledTimes(1);
  });
});
