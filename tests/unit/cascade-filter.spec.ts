import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const apiSupplierPage = vi.fn(async (..._a: any[]) => ({
  records: [{ id: 1, name: 'SupA' }, { id: 2, name: 'SupB' }], total: 2, current: 1, size: 1000,
}));
vi.mock('@/api/basedata/supplier', () => ({
  apiSupplierPage: (...a: any[]) => apiSupplierPage(...a),
}));

const apiSupplierBrands = vi.fn(async (..._a: any[]) => [{ id: 11, name: 'BrandA' }]);
const apiSupplierCategories = vi.fn(async (..._a: any[]) => [
  { id: 21, parentId: 0, name: 'CatA', status: 1, children: [{ id: 22, parentId: 21, name: 'CatA-1', status: 1, children: [] }] },
]);
vi.mock('@/api/product/supplierProduct', () => ({
  apiSupplierBrands: (...a: any[]) => apiSupplierBrands(...a),
  apiSupplierCategories: (...a: any[]) => apiSupplierCategories(...a),
}));

import CascadeFilter from '@/components/CascadeFilter.vue';

describe('CascadeFilter 联动筛选器', () => {
  beforeEach(() => vi.clearAllMocks());

  it('挂载即加载供应商列表', async () => {
    mount(CascadeFilter);
    await flushPromises();
    expect(apiSupplierPage).toHaveBeenCalled();
  });

  it('选供应商：加载其品牌与分类（分类扁平化含子级）', async () => {
    const wrapper = mount(CascadeFilter);
    await flushPromises();
    (wrapper.vm as any).model.supplierId = 1;
    await (wrapper.vm as any).onSupplierChange();
    await flushPromises();
    expect(apiSupplierBrands).toHaveBeenCalledWith(1);
    expect(apiSupplierCategories).toHaveBeenCalledWith(1);
    expect((wrapper.vm as any).brandOptions).toHaveLength(1);
    // CatA + CatA-1 扁平为 2 项
    expect((wrapper.vm as any).categoryOptions).toHaveLength(2);
  });

  it('切换供应商：清空下游 brandId/categoryId 选择并 emit', async () => {
    const wrapper = mount(CascadeFilter);
    await flushPromises();
    const vm = wrapper.vm as any;
    vm.model.supplierId = 1;
    vm.model.brandId = 11;
    vm.model.categoryId = 21;
    await vm.onSupplierChange();
    await flushPromises();
    expect(vm.model.brandId).toBeUndefined();
    expect(vm.model.categoryId).toBeUndefined();
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    const last = emitted![emitted!.length - 1][0] as any;
    expect(last.supplierId).toBe(1);
    expect(last.brandId).toBeUndefined();
  });

  it('清空供应商：不再请求品牌/分类，下游禁用', async () => {
    const wrapper = mount(CascadeFilter);
    await flushPromises();
    const vm = wrapper.vm as any;
    vm.model.supplierId = undefined;
    await vm.onSupplierChange();
    await flushPromises();
    expect(apiSupplierBrands).not.toHaveBeenCalled();
    expect(vm.brandOptions).toHaveLength(0);
  });
});
