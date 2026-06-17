import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SupplierProductScrapeModal from '@/views/product/supplier-product/SupplierProductScrapeModal.vue';

const scrapeMock = vi.fn();
const importMock = vi.fn();
const brandsMock = vi.fn();

vi.mock('@/api/product/supplierProduct', () => ({
  apiScrapeProducts: (url: string) => scrapeMock(url),
  apiImportScraped: (p: any) => importMock(p),
}));
vi.mock('@/api/basedata/supplierBrand', () => ({
  apiAuthorizedBrands: (id: any) => brandsMock(id),
}));
vi.mock('ant-design-vue', () => ({ message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const stubs = {
  'a-modal': true, 'a-form': true, 'a-form-item': true, 'a-select': true, 'a-radio-group': true,
  'a-radio-button': true, 'a-input': true, 'a-button': true, 'a-space': true, 'a-table': true,
  'a-image': true, 'a-descriptions': true, 'a-descriptions-item': true,
};

describe('SupplierProductScrapeModal', () => {
  beforeEach(() => {
    scrapeMock.mockReset();
    importMock.mockReset();
    brandsMock.mockReset();
    brandsMock.mockResolvedValue([{ brandId: '10', brandName: 'Morgan' }]);
  });

  it('scrapes and stores rows', async () => {
    scrapeMock.mockResolvedValue([
      { productName: 'Juicer', productCode: 'A1', qtyPerBox: 6, imageUrl: 'x', unitPrice: 220, boxPrice: 1320, stockStatus: 'Stock Sufficient' },
    ]);
    const wrapper = mount(SupplierProductScrapeModal, {
      props: { open: true, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
      global: { stubs },
    });
    await new Promise((r) => setTimeout(r, 0));
    wrapper.vm.form.url = 'https://morgan.dzncm.com/price81469/';
    await wrapper.vm.onScrape();
    expect(scrapeMock).toHaveBeenCalledWith('https://morgan.dzncm.com/price81469/');
    expect(wrapper.vm.rows.length).toBe(1);
  });

  it('imports scraped rows with supplierId/brandId/mode', async () => {
    importMock.mockResolvedValue({ total: 1, created: 1, updated: 0, skipped: 0, failed: 0, errors: [] });
    const wrapper = mount(SupplierProductScrapeModal, {
      props: { open: true, supplierOptions: [{ label: 'S1', value: '1' }], defaultSupplierId: '1' },
      global: { stubs },
    });
    await new Promise((r) => setTimeout(r, 0));
    wrapper.vm.form.supplierId = '1';
    wrapper.vm.form.brandId = '10';
    wrapper.vm.rows = [{ productName: 'Juicer', productCode: 'A1', qtyPerBox: 6, imageUrl: 'x', unitPrice: 220, boxPrice: 1320, stockStatus: 'Stock Sufficient' }];
    await wrapper.vm.onImport();
    expect(importMock).toHaveBeenCalledTimes(1);
    const payload = importMock.mock.calls[0][0];
    expect(payload.supplierId).toBe('1');
    expect(payload.brandId).toBe('10');
    expect(payload.mode).toBe('skip');
    expect(payload.rows.length).toBe(1);
    expect(wrapper.vm.result?.created).toBe(1);
  });
});
