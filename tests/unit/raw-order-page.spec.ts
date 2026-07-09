import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RawOrderPage from '@/views/order/raw/index.vue';

const apiRawOrderPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
vi.mock('@/api/order/rawOrder', () => ({
  apiRawOrderPage: (...a: any[]) => apiRawOrderPage(...a),
  apiRawOrderImport: vi.fn(),
}));

const stubs = {
  'a-card': true, 'a-form': true, 'a-form-item': true, 'a-input': true,
  'a-select': true, 'a-range-picker': true, 'a-button': true, 'a-space': true,
  'a-tag': true, BasicTable: true, RawOrderImportModal: true,
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
});
