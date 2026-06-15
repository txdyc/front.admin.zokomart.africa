import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/api/basedata/brand', () => ({
  apiBrandPage: vi.fn(async () => ({
    records: [
      { id: '1', name: 'Midea' },
      { id: '2', name: 'Hisense' },
    ],
    total: 2, current: 1, size: 1000,
  })),
}));
vi.mock('@/api/basedata/supplierBrand', () => ({
  apiAuthorizedBrands: vi.fn(async () => [{ id: '10', brandId: '1', brandName: 'Midea', status: 1 }]),
  apiAssignBrands: vi.fn(async () => undefined),
}));

import { apiAssignBrands } from '@/api/basedata/supplierBrand';
import SupplierBrandDrawer from '@/components/SupplierBrandDrawer.vue';

const stubs = {
  'a-drawer': true, 'a-transfer': true, 'a-spin': true, 'a-space': true, 'a-button': true,
};

describe('SupplierBrandDrawer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('load 初始化候选品牌与已授权 targetKeys', async () => {
    const w = mount(SupplierBrandDrawer, { props: { supplierId: 's1', open: false }, global: { stubs } });
    await (w.vm as any).load();
    expect((w.vm as any).dataSource.map((i: any) => i.key)).toEqual(['1', '2']);
    expect((w.vm as any).targetKeys).toEqual(['1']);
  });

  it('onSave 调用 apiAssignBrands 携带 targetKeys 并 emit saved', async () => {
    const w = mount(SupplierBrandDrawer, { props: { supplierId: 's1', open: false }, global: { stubs } });
    (w.vm as any).targetKeys = ['1', '2'];
    await (w.vm as any).onSave();
    expect(apiAssignBrands).toHaveBeenCalledWith('s1', ['1', '2']);
    expect(w.emitted('saved')).toBeTruthy();
  });
});
