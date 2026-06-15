import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const formValues = { name: 'TestBrand', code: 'TB', sort: 1, status: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiBrandPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiBrandCreate = vi.fn(async (..._a: any[]) => 1);
const apiBrandUpdate = vi.fn(async (..._a: any[]) => undefined);
const apiBrandDelete = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/basedata/brand', () => ({
  apiBrandPage: (...a: any[]) => apiBrandPage(...a),
  apiBrandCreate: (...a: any[]) => apiBrandCreate(...a),
  apiBrandUpdate: (...a: any[]) => apiBrandUpdate(...a),
  apiBrandDelete: (...a: any[]) => apiBrandDelete(...a),
}));

import BrandPage from '@/views/basedata/brand/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(BrandPage, { global: { directives: { perm } } });

describe('品牌管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('无 brand:create 权限时「新增」按钮不渲染', () => {
    setUser({ permissions: ['brand:list'] });
    expect(mountPage().find('[data-test="brand-create"]').exists()).toBe(false);
  });

  it('新增提交：调用 apiBrandCreate，载荷来自表单', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiBrandCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'TestBrand' }));
    expect(apiBrandUpdate).not.toHaveBeenCalled();
  });

  it('编辑提交：调用 apiBrandUpdate(id, payload)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openEdit({ id: 9, name: 'TestBrand', status: 1 });
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiBrandUpdate).toHaveBeenCalledWith(9, expect.objectContaining({ name: 'TestBrand' }));
  });

  it('删除：调用 apiBrandDelete(id)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    await (wrapper.vm as any).onDelete({ id: 5, name: 'X' });
    await flushPromises();
    expect(apiBrandDelete).toHaveBeenCalledWith(5);
  });
});
