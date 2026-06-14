import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const formValues = { name: 'TestSpu', brandId: 1, categoryId: 2, status: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiSpuPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiSpuCreate = vi.fn(async (..._a: any[]) => 1);
const apiSpuUpdate = vi.fn(async (..._a: any[]) => undefined);
const apiSpuDelete = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/product/spu', () => ({
  apiSpuPage: (...a: any[]) => apiSpuPage(...a),
  apiSpuCreate: (...a: any[]) => apiSpuCreate(...a),
  apiSpuUpdate: (...a: any[]) => apiSpuUpdate(...a),
  apiSpuDelete: (...a: any[]) => apiSpuDelete(...a),
}));
vi.mock('@/api/basedata/brand', () => ({
  apiBrandPage: vi.fn(async () => ({ records: [{ id: 1, name: 'BrandA' }], total: 1, current: 1, size: 1000 })),
}));
vi.mock('@/api/basedata/category', () => ({
  apiCategoryTree: vi.fn(async () => [{ id: 2, parentId: 0, name: 'CatA', status: 1, children: [] }]),
}));

import SpuPage from '@/views/product/spu/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(SpuPage, { global: { directives: { perm } } });

describe('SPU 管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('无 product:spu:create 权限时「新增」按钮不渲染', () => {
    setUser({ permissions: ['product:spu:list'] });
    expect(mountPage().find('[data-test="spu-create"]').exists()).toBe(false);
  });

  it('新增提交：调用 apiSpuCreate，载荷来自表单', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSpuCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'TestSpu', brandId: 1, categoryId: 2 }));
    expect(apiSpuUpdate).not.toHaveBeenCalled();
  });

  it('编辑提交：调用 apiSpuUpdate(id, payload)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openEdit({ id: 9, name: 'TestSpu', brandId: 1, categoryId: 2, status: 1 });
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSpuUpdate).toHaveBeenCalledWith(9, expect.objectContaining({ name: 'TestSpu' }));
  });

  it('删除：调用 apiSpuDelete(id)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    await (wrapper.vm as any).onDelete({ id: 5, name: 'X' });
    await flushPromises();
    expect(apiSpuDelete).toHaveBeenCalledWith(5);
  });
});
