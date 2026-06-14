import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

let formValues: Record<string, any> = { quantity: 50, remark: '盘点修正' };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));
vi.mock('@/components/CascadeFilter.vue', () => ({
  default: defineComponent({ name: 'CascadeFilter', setup: () => () => null }),
}));

const apiStockPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiStockAdjust = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/inventory/stock', () => ({
  apiStockPage: (...a: any[]) => apiStockPage(...a),
  apiStockAdjust: (...a: any[]) => apiStockAdjust(...a),
}));

import StockPage from '@/views/inventory/stock/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(StockPage, { global: { directives: { perm } } });

describe('库存管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    formValues = { quantity: 50, remark: '盘点修正' };
  });

  it('无 inventory:edit 权限时「调整」入口不渲染（无数据行时整体无入口）', async () => {
    setUser({ permissions: ['inventory:list'] });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('[data-test="stock-adjust"]').exists()).toBe(false);
  });

  it('调整提交：按 supplierProductId 调用 adjust，载荷 {quantity, remark}', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openAdjust({ supplierProductId: 77, productName: 'P', quantity: 10 });
    await flushPromises();
    await vm.onSubmit();
    await flushPromises();
    expect(apiStockAdjust).toHaveBeenCalledWith(77, { quantity: 50, remark: '盘点修正' });
  });

  it('负数库存：前端拦截，不调用 adjust', async () => {
    setUser({ isSuper: 1 });
    formValues = { quantity: -1, remark: 'x' };
    const wrapper = mountPage();
    const vm = wrapper.vm as any;
    vm.openAdjust({ supplierProductId: 77, productName: 'P', quantity: 10 });
    await flushPromises();
    await vm.onSubmit();
    await flushPromises();
    expect(apiStockAdjust).not.toHaveBeenCalled();
  });
});
