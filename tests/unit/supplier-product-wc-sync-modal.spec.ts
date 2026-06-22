import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import WcSyncModal from '@/views/product/supplier-product/SupplierProductWcSyncModal.vue';

const startMock = vi.fn();
const getJobMock = vi.fn();
const brandsMock = vi.fn();

vi.mock('@/api/wcSync', () => ({
  apiStartWcSync: (p: any) => startMock(p),
  apiGetWcSyncJob: (id: any) => getJobMock(id),
}));
vi.mock('@/api/basedata/supplierBrand', () => ({ apiAuthorizedBrands: (id: any) => brandsMock(id) }));
vi.mock('ant-design-vue', () => ({ message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const stubs = {
  'a-modal': true, 'a-form': true, 'a-form-item': true, 'a-select': true, 'a-button': true,
  'a-space': true, 'a-descriptions': true, 'a-descriptions-item': true, 'a-table': true, 'a-progress': true,
};

function mountOpen() {
  return mount(WcSyncModal, {
    props: { open: true, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
    global: { stubs },
  });
}

describe('SupplierProductWcSyncModal', () => {
  beforeEach(() => {
    startMock.mockReset();
    getJobMock.mockReset();
    brandsMock.mockReset();
    brandsMock.mockResolvedValue([{ brandId: '10', brandName: 'Morgan' }]);
  });

  it('loads authorized brands on open', async () => {
    const wrapper = mount(WcSyncModal, {
      props: { open: false, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
      global: { stubs },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(brandsMock).toHaveBeenCalledWith('1');
    expect(wrapper.vm.brandOptions).toEqual([{ label: 'Morgan', value: '10' }]);
  });

  it('starts a job with the right payload, polls, renders terminal SUCCESS and stops', async () => {
    startMock.mockResolvedValue({ jobId: 88 });
    getJobMock.mockResolvedValue({
      jobId: 88, status: 'SUCCESS', total: 2, processed: 2,
      created: 2, updated: 0, drafted: 0, failed: 0, failedItems: [],
    });
    const wrapper = mountOpen();
    await flushPromises();              // let the open-watch loadBrands settle (it resets brandIds)
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandIds = ['10'];

    await wrapper.vm.onSync();          // start + first poll
    await flushPromises();              // resolve start + getJob microtasks

    expect(startMock).toHaveBeenCalledWith({ supplierId: '1', brandIds: ['10'] });
    // terminal on the first poll → no further polls scheduled (proves polling stopped)
    expect(getJobMock).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.job?.status).toBe('SUCCESS');
    expect(wrapper.vm.job?.created).toBe(2);
  });

  it('renders failed items when a job ends PARTIAL', async () => {
    startMock.mockResolvedValue({ jobId: 99 });
    getJobMock.mockResolvedValue({
      jobId: 99, status: 'PARTIAL', total: 3, processed: 3,
      created: 2, updated: 0, drafted: 0, failed: 1,
      failedItems: [{ productCode: 'WCX', reason: 'WC 500' }],
    });
    const wrapper = mountOpen();
    await flushPromises();
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandIds = ['10'];

    await wrapper.vm.onSync();
    await flushPromises();

    expect(wrapper.vm.job?.status).toBe('PARTIAL');
    expect(wrapper.vm.job?.failed).toBe(1);
    expect(wrapper.vm.job?.failedItems).toEqual([{ productCode: 'WCX', reason: 'WC 500' }]);
  });

  it('warns and does not start when no brand is selected', async () => {
    const wrapper = mountOpen();
    await flushPromises();
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandIds = [];

    await wrapper.vm.onSync();

    expect(startMock).not.toHaveBeenCalled();
  });
});
