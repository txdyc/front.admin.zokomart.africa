import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import WcSyncModal from '@/views/product/supplier-product/SupplierProductWcSyncModal.vue';

const syncMock = vi.fn();
const brandsMock = vi.fn();

vi.mock('@/api/wcSync', () => ({ apiWcSync: (p: any) => syncMock(p) }));
vi.mock('@/api/basedata/supplierBrand', () => ({ apiAuthorizedBrands: (id: any) => brandsMock(id) }));
vi.mock('ant-design-vue', () => ({ message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const stubs = {
  'a-modal': true, 'a-form': true, 'a-form-item': true, 'a-select': true, 'a-button': true,
  'a-space': true, 'a-descriptions': true, 'a-descriptions-item': true, 'a-table': true,
};

describe('SupplierProductWcSyncModal', () => {
  beforeEach(() => {
    syncMock.mockReset();
    brandsMock.mockReset();
    brandsMock.mockResolvedValue([{ brandId: '10', brandName: 'Morgan' }]);
  });

  it('loads authorized brands on open', async () => {
    const wrapper = mount(WcSyncModal, {
      props: { open: false, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
      global: { stubs },
    });
    await wrapper.setProps({ open: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(brandsMock).toHaveBeenCalledWith('1');
    expect(wrapper.vm.brandOptions).toEqual([{ label: 'Morgan', value: '10' }]);
  });

  it('submits supplierId + brandIds and renders result', async () => {
    syncMock.mockResolvedValue({ total: 2, created: 2, updated: 0, drafted: 0, skipped: 0, failed: 0, errors: [] });
    const wrapper = mount(WcSyncModal, {
      props: { open: true, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
      global: { stubs },
    });
    await new Promise((r) => setTimeout(r, 0));
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandIds = ['10'];
    await wrapper.vm.onSync();
    expect(syncMock).toHaveBeenCalledTimes(1);
    const payload = syncMock.mock.calls[0][0];
    expect(payload.supplierId).toBe('1');
    expect(payload.brandIds).toEqual(['10']);
    expect(wrapper.vm.result?.created).toBe(2);
  });
});
