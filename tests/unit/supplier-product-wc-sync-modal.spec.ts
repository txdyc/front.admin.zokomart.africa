import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import WcSyncModal from '@/views/product/supplier-product/SupplierProductWcSyncModal.vue';

const startMock = vi.fn();
const getJobMock = vi.fn();
const brandsMock = vi.fn();
const sitesMock = vi.fn();

vi.mock('@/api/wcSync', () => ({
  apiWcSyncSites: (..._a: any[]) => sitesMock(),
  apiStartWcSync: (p: any) => startMock(p),
  apiGetWcSyncJob: (id: any) => getJobMock(id),
}));
vi.mock('@/api/basedata/supplierBrand', () => ({ apiAuthorizedBrands: (id: any) => brandsMock(id) }));
vi.mock('ant-design-vue', () => ({ message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const stubs = {
  'a-modal': true, 'a-form': true, 'a-form-item': true, 'a-select': true, 'a-button': true,
  'a-space': true, 'a-descriptions': true, 'a-descriptions-item': true, 'a-table': true, 'a-progress': true,
};

const SITES = [
  { code: 'zokomart', name: 'ZokoMart', configured: true },
  { code: 'kianosmart', name: 'KianoSmart', configured: false },
];

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
    sitesMock.mockReset();
    brandsMock.mockResolvedValue([{ brandId: '10', brandName: 'Morgan' }]);
    sitesMock.mockResolvedValue(SITES);
  });

  it('loads authorized brands and sites on open; default selects configured sites only', async () => {
    const wrapper = mount(WcSyncModal, {
      props: { open: false, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
      global: { stubs },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(brandsMock).toHaveBeenCalledWith('1');
    expect(wrapper.vm.brandOptions).toEqual([{ label: 'Morgan', value: '10' }]);
    // 站点列表载入；默认全选已配置站点，未配置的不选且置灰
    expect(wrapper.vm.siteOptions).toEqual([
      { label: 'ZokoMart', value: 'zokomart', disabled: false },
      { label: 'KianoSmart', value: 'kianosmart', disabled: true },
    ]);
    expect(wrapper.vm.form.siteCodes).toEqual(['zokomart']);
  });

  it('starts jobs per site with siteCodes, polls both and renders per-site terminal states', async () => {
    startMock.mockResolvedValue({ jobIds: [88, 89] });
    getJobMock.mockImplementation((id: any) =>
      Promise.resolve(
        id === 88
          ? { jobId: 88, siteCode: 'zokomart', siteName: 'ZokoMart', status: 'SUCCESS', total: 2, processed: 2,
              created: 2, updated: 0, drafted: 0, failed: 0, failedItems: [] }
          : { jobId: 89, siteCode: 'kianosmart', siteName: 'KianoSmart', status: 'PARTIAL', total: 3, processed: 3,
              created: 2, updated: 0, drafted: 0, failed: 1,
              failedItems: [{ productCode: 'WCX', reason: 'WC 500' }] },
      ),
    );
    const wrapper = mountOpen();
    await flushPromises();              // let the open-watch loadBrands/loadSites settle
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandIds = ['10'];
    wrapper.vm.form.siteCodes = ['zokomart', 'kianosmart'];

    await wrapper.vm.onSync();          // start + first poll round
    await flushPromises();

    expect(startMock).toHaveBeenCalledWith({ supplierId: '1', brandIds: ['10'], siteCodes: ['zokomart', 'kianosmart'] });
    // 每个 job 各轮询一次即终态 → 停轮询（共 2 次调用）
    expect(getJobMock).toHaveBeenCalledTimes(2);
    // 按站点渲染：两块进度各含自己的终态
    expect(wrapper.vm.jobs).toHaveLength(2);
    expect(wrapper.vm.jobs[0].siteName).toBe('ZokoMart');
    expect(wrapper.vm.jobs[0].status).toBe('SUCCESS');
    expect(wrapper.vm.jobs[1].siteName).toBe('KianoSmart');
    expect(wrapper.vm.jobs[1].status).toBe('PARTIAL');
    expect(wrapper.vm.jobs[1].failedItems).toEqual([{ productCode: 'WCX', reason: 'WC 500' }]);
  });

  it('warns and does not start when no brand is selected', async () => {
    const wrapper = mountOpen();
    await flushPromises();
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandIds = [];

    await wrapper.vm.onSync();

    expect(startMock).not.toHaveBeenCalled();
  });

  it('warns and does not start when no site is selected', async () => {
    const wrapper = mountOpen();
    await flushPromises();
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandIds = ['10'];
    wrapper.vm.form.siteCodes = [];

    await wrapper.vm.onSync();

    expect(startMock).not.toHaveBeenCalled();
  });
});
