import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const apiAdModelEnabled = vi.fn(async () => [{ id: 'm1', name: 'NB Pro' }]);
const apiAdGenerate = vi.fn(async () => ({ tempUrls: ['/files/ad-temp/t1.png'], errors: [] }));
const apiAdKeep = vi.fn(async () => ['k1']);
const apiAdDiscard = vi.fn(async () => undefined);
const apiAdImageList = vi.fn(async () => [] as any[]);
const apiAdImageDelete = vi.fn(async () => undefined);
vi.mock('@/api/ad', () => ({
  apiAdModelEnabled: (...a: any[]) => apiAdModelEnabled(...a),
  apiAdGenerate: (...a: any[]) => apiAdGenerate(...a),
  apiAdKeep: (...a: any[]) => apiAdKeep(...a),
  apiAdDiscard: (...a: any[]) => apiAdDiscard(...a),
  apiAdImageList: (...a: any[]) => apiAdImageList(...a),
  apiAdImageDelete: (...a: any[]) => apiAdImageDelete(...a),
}));
vi.mock('@/api/basedata/supplier', () => ({
  apiSupplierPage: vi.fn(async () => ({ records: [{ id: 's1', name: 'Sup1' }], total: 1, current: 1, size: 1000 })),
}));
vi.mock('@/api/product/supplierProduct', () => ({
  apiSupplierProductPage: vi.fn(async () => ({
    records: [{ id: 'p1', name: 'Prod1', productCode: 'PC1' }], total: 1, current: 1, size: 1000,
  })),
}));
vi.mock('@/api/file', () => ({ apiUploadImage: vi.fn(async () => ({ url: '/files/ad-source/r1.png' })) }));

import GenPage from '@/views/ad/image-generation/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 1, roles: [], permissions: [], menus: [], ...u,
  });
}
const mountPage = () => mount(GenPage, { global: { directives: { perm } } });

describe('AI 生图页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    setUser({});
  });

  it('生成：调用 apiAdGenerate 并把结果放入待处理卡片', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const vm = wrapper.vm as any;
    vm.form.modelId = 'm1';
    vm.form.prompt = 'make ad';
    await vm.onGenerate();
    await flushPromises();
    expect(apiAdGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'm1', prompt: 'make ad', count: 1 }),
    );
    expect(vm.results.map((r: any) => r.tempUrl)).toEqual(['/files/ad-temp/t1.png']);
  });

  it('未选产品时保留被拒；选了产品保留调 apiAdKeep 并刷新缩略图墙', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const vm = wrapper.vm as any;
    vm.results.push({ tempUrl: '/files/ad-temp/t1.png' });

    await vm.onKeep(vm.results[0]);
    expect(apiAdKeep).not.toHaveBeenCalled();       // 未选产品 → 不发请求

    vm.selectedProductId = 'p1';
    vm.form.modelId = 'm1';
    await vm.onKeep(vm.results[0]);
    await flushPromises();
    expect(apiAdKeep).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierProductId: 'p1',
        items: [expect.objectContaining({ tempUrl: '/files/ad-temp/t1.png' })],
      }),
    );
    expect(vm.results.length).toBe(0);              // 卡片移除
    expect(apiAdImageList).toHaveBeenCalledWith('p1');
  });

  it('丢弃：调 apiAdDiscard 并移除卡片', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const vm = wrapper.vm as any;
    vm.results.push({ tempUrl: '/files/ad-temp/t2.png' });
    await vm.onDiscard(vm.results[0]);
    await flushPromises();
    expect(apiAdDiscard).toHaveBeenCalledWith(['/files/ad-temp/t2.png']);
    expect(vm.results.length).toBe(0);
  });

  it('删除已保留图：确认后调 apiAdImageDelete 并刷新', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const vm = wrapper.vm as any;
    vm.selectedProductId = 'p1';
    await vm.onDeleteKept({ id: 'k9' });
    await flushPromises();
    expect(apiAdImageDelete).toHaveBeenCalledWith('k9');
  });
});
