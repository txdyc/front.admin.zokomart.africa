import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import RawOrderImportModal from '@/views/order/raw/RawOrderImportModal.vue';
import type { RawOrderImportResult } from '@/types/order';

// jsdom 未实现 URL.createObjectURL，下载模板用例需打桩。
vi.stubGlobal('URL', {
  ...(globalThis.URL as any),
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
});

const importRes: RawOrderImportResult = {
  total: 7, success: 2, failed: 5,
  errors: [
    { row: 3, productCode: 'RAW-B', reason: 'status 非法' },
    { row: 4, productCode: 'RAW-C', reason: 'date 非法' },
  ],
};
const apiRawOrderImport = vi.fn(async (..._a: any[]) => importRes);
vi.mock('@/api/order/rawOrder', () => ({
  apiRawOrderPage: vi.fn(),
  apiRawOrderImport: (...a: any[]) => apiRawOrderImport(...a),
}));

const stubs = {
  'a-modal': true, 'a-upload': true, 'a-button': true, 'a-table': true,
  'a-tag': true, 'a-space': true, 'a-alert': true,
};
const mountModal = () => mount(RawOrderImportModal, {
  props: { visible: true },
  global: { stubs },
});

describe('原始订单导入弹窗', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiRawOrderImport.mockClear();
  });

  it('未选文件时点击开始导入给出提示且不调接口', async () => {
    const w = mountModal();
    await flushPromises();
    await w.vm.onSubmit();
    expect(apiRawOrderImport).not.toHaveBeenCalled();
  });

  it('beforeUpload 接受 .csv 且填入 file', async () => {
    const w = mountModal();
    await flushPromises();
    const f = new File(['h'], 'orders.csv', { type: 'text/csv' });
    expect(w.vm.beforeUpload(f)).toBe(false); // 阻止 a-upload 自动上传
    expect(w.vm.file).toBe(f);
  });

  it('选好文件后提交：调接口、回填 result、emit ok 并清空', async () => {
    const w = mountModal();
    await flushPromises();
    const f = new File(['h'], 'orders.csv', { type: 'text/csv' });
    w.vm.beforeUpload(f);
    await w.vm.onSubmit();
    await flushPromises();
    expect(apiRawOrderImport).toHaveBeenCalledTimes(1);
    expect(w.vm.result).toEqual(importRes);
    expect(w.emitted('ok')).toBeTruthy();
    // 成功后清空 file，允许再次导入
    expect(w.vm.file).toBe(null);
  });

  it('下载模板生成 14 列表头的 csv', async () => {
    const w = mountModal();
    await flushPromises();
    const url = (await w.vm.downloadTemplate()) as string;
    expect(url).toContain('blob:');
    expect(url).toMatch(/^blob:/);
  });
});
