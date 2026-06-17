import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SupplierProductImportModal from '@/views/product/supplier-product/SupplierProductImportModal.vue';

const importMock = vi.fn();
const brandsMock = vi.fn();

vi.mock('@/api/product/supplierProduct', () => ({
  apiSupplierProductImport: (form: FormData) => importMock(form),
}));
vi.mock('@/api/basedata/supplierBrand', () => ({
  apiAuthorizedBrands: (id: any) => brandsMock(id),
}));
vi.mock('ant-design-vue', () => ({
  message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

describe('SupplierProductImportModal', () => {
  beforeEach(() => {
    importMock.mockReset();
    brandsMock.mockReset();
    brandsMock.mockResolvedValue([{ brandId: '10', brandName: 'Morgan' }]);
  });

  it('loads authorized brands when opened with default supplier', async () => {
    const wrapper = mount(SupplierProductImportModal, {
      props: { open: false, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
      global: { stubs: { 'a-modal': true, 'a-form': true, 'a-form-item': true, 'a-select': true,
        'a-radio-group': true, 'a-radio-button': true, 'a-upload': true, 'a-button': true,
        'a-space': true, 'a-descriptions': true, 'a-descriptions-item': true, 'a-table': true } },
    });
    await wrapper.setProps({ open: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(brandsMock).toHaveBeenCalledWith('1');
    expect(wrapper.vm.brandOptions).toEqual([{ label: 'Morgan', value: '10' }]);
  });

  it('submits a FormData with supplierId/brandId/mode and renders result', async () => {
    importMock.mockResolvedValue({ total: 2, created: 1, updated: 0, skipped: 0, failed: 1,
      errors: [{ row: 3, productCode: 'X', reason: '产品名称为空' }] });
    const wrapper = mount(SupplierProductImportModal, {
      props: { open: true, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
      global: { stubs: { 'a-modal': true, 'a-form': true, 'a-form-item': true, 'a-select': true,
        'a-radio-group': true, 'a-radio-button': true, 'a-upload': true, 'a-button': true,
        'a-space': true, 'a-descriptions': true, 'a-descriptions-item': true, 'a-table': true } },
    });
    await new Promise((r) => setTimeout(r, 0));
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandId = '10';
    // 暂存一个文件
    (wrapper.vm as any).beforeUpload({ name: 'a.csv' });
    await wrapper.vm.onSubmit();
    expect(importMock).toHaveBeenCalledTimes(1);
    const fd = importMock.mock.calls[0][0] as FormData;
    expect(fd.get('supplierId')).toBe('1');
    expect(fd.get('brandId')).toBe('10');
    expect(fd.get('mode')).toBe('skip');
    expect(wrapper.vm.result?.failed).toBe(1);
  });
});
