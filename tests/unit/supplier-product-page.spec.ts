import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

// 默认表单值：合法（MOQ>=1, 价格>=0）
let formValues: Record<string, any> = {
  supplierId: 1, name: 'ProdA', productCode: 'PC-1',
  brandId: 11, categoryId: 21, wholesalePrice: 10, retailPrice: 20, minPurchaseQty: 5, status: 1,
};
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));
// CascadeFilter 桩：避免触发供应商/品牌/分类网络
vi.mock('@/components/CascadeFilter.vue', () => ({
  default: defineComponent({ name: 'CascadeFilter', setup: () => () => null }),
}));

const apiSupplierProductPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiSupplierProductCreate = vi.fn(async (..._a: any[]) => 1);
const apiSupplierProductUpdate = vi.fn(async (..._a: any[]) => undefined);
const apiSupplierProductDelete = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/product/supplierProduct', () => ({
  apiSupplierProductPage: (...a: any[]) => apiSupplierProductPage(...a),
  apiSupplierProductCreate: (...a: any[]) => apiSupplierProductCreate(...a),
  apiSupplierProductUpdate: (...a: any[]) => apiSupplierProductUpdate(...a),
  apiSupplierProductDelete: (...a: any[]) => apiSupplierProductDelete(...a),
}));
vi.mock('@/api/basedata/supplier', () => ({
  apiSupplierPage: vi.fn(async () => ({ records: [{ id: 1, name: 'SupA' }], total: 1, current: 1, size: 1000 })),
}));
vi.mock('@/api/basedata/brand', () => ({
  apiBrandPage: vi.fn(async () => ({ records: [{ id: 11, name: 'BrandA' }], total: 1, current: 1, size: 1000 })),
}));
vi.mock('@/api/basedata/category', () => ({
  apiCategoryTree: vi.fn(async () => [{ id: 21, parentId: 0, name: 'CatA', status: 1, children: [] }]),
}));

import SupplierProductPage from '@/views/product/supplier-product/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(SupplierProductPage, { global: { directives: { perm } } });

describe('供应商产品管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    formValues = {
      supplierId: 1, name: 'ProdA', productCode: 'PC-1',
      brandId: 11, categoryId: 21, wholesalePrice: 10, retailPrice: 20, minPurchaseQty: 5, status: 1,
    };
  });

  it('无 supplierProduct:create 权限时「新增」按钮不渲染', () => {
    setUser({ permissions: ['supplierProduct:list'] });
    expect(mountPage().find('[data-test="supplier-product-create"]').exists()).toBe(false);
  });

  it('新增提交：载荷字段齐全', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSupplierProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1, name: 'ProdA', productCode: 'PC-1',
        wholesalePrice: 10, retailPrice: 20, minPurchaseQty: 5,
      }),
    );
  });

  it('MOQ<1：前端拦截，不调用 create', async () => {
    setUser({ isSuper: 1 });
    formValues.minPurchaseQty = 0;
    const wrapper = mountPage();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSupplierProductCreate).not.toHaveBeenCalled();
  });

  it('编辑提交：调用 update(id, payload)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openEdit({ id: 9, supplierId: 1, name: 'ProdA', productCode: 'PC-1', status: 1 });
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSupplierProductUpdate).toHaveBeenCalledWith(9, expect.objectContaining({ name: 'ProdA' }));
  });

  it('删除：调用 delete(id)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    await (wrapper.vm as any).onDelete({ id: 5, name: 'X' });
    await flushPromises();
    expect(apiSupplierProductDelete).toHaveBeenCalledWith(5);
  });
});
