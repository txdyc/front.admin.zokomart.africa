import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const formValues = { skuCode: 'SK-1', spec: '红/XL', price: 9.9, status: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiSpuPage = vi.fn(async (..._a: any[]) => ({
  records: [{ id: 7, name: 'SpuA' }], total: 1, current: 1, size: 1000,
}));
const apiSpuSkus = vi.fn(async (..._a: any[]) => [] as any[]);
vi.mock('@/api/product/spu', () => ({
  apiSpuPage: (...a: any[]) => apiSpuPage(...a),
  apiSpuSkus: (...a: any[]) => apiSpuSkus(...a),
}));

const apiSkuCreate = vi.fn(async (..._a: any[]) => 1);
const apiSkuUpdate = vi.fn(async (..._a: any[]) => undefined);
const apiSkuDelete = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/product/sku', () => ({
  apiSkuCreate: (...a: any[]) => apiSkuCreate(...a),
  apiSkuUpdate: (...a: any[]) => apiSkuUpdate(...a),
  apiSkuDelete: (...a: any[]) => apiSkuDelete(...a),
}));

import SkuPage from '@/views/product/sku/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(SkuPage, { global: { directives: { perm } } });

describe('SKU 管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('挂载即加载 SPU 选项', async () => {
    setUser({ isSuper: 1 });
    mountPage();
    await flushPromises();
    expect(apiSpuPage).toHaveBeenCalled();
  });

  it('选定 SPU 后按其 id 拉取 SKU 列表', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).selectedSpuId = 7;
    await (wrapper.vm as any).loadSkus();
    await flushPromises();
    expect(apiSpuSkus).toHaveBeenCalledWith(7);
  });

  it('未选 SPU 时提交不调用 create', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSkuCreate).not.toHaveBeenCalled();
  });

  it('新增提交：载荷带选定 spuId', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).selectedSpuId = 7;
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSkuCreate).toHaveBeenCalledWith(expect.objectContaining({ skuCode: 'SK-1', spuId: 7 }));
    expect(apiSkuUpdate).not.toHaveBeenCalled();
  });

  it('编辑提交：调用 apiSkuUpdate(id, payload)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).selectedSpuId = 7;
    (wrapper.vm as any).openEdit({ id: 3, spuId: 7, skuCode: 'SK-1', status: 1 });
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSkuUpdate).toHaveBeenCalledWith(3, expect.objectContaining({ skuCode: 'SK-1', spuId: 7 }));
  });

  it('删除：调用 apiSkuDelete(id)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).selectedSpuId = 7;
    await (wrapper.vm as any).onDelete({ id: 5, spuId: 7, skuCode: 'X' });
    await flushPromises();
    expect(apiSkuDelete).toHaveBeenCalledWith(5);
  });
});
