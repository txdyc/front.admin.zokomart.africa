import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';

const formValues = { parentId: 0, name: '家用电器', sort: 1, status: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiCategoryCreate = vi.fn(async (..._a: any[]) => 1);
vi.mock('@/api/basedata/category', () => ({
  apiCategoryTree: vi.fn(async () => [
    { id: 10, parentId: 0, name: '根分类', sort: 1, status: 1, children: [] },
  ]),
  apiCategoryCreate: (...a: any[]) => apiCategoryCreate(...a),
  apiCategoryUpdate: vi.fn(),
  apiCategoryDelete: vi.fn(),
}));

import CategoryPage from '@/views/basedata/category/index.vue';

beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 1, roles: [], permissions: [], menus: [],
  });
  vi.clearAllMocks();
});

describe('分类管理页', () => {
  it('新增提交：调用 apiCategoryCreate，载荷含 name 与 parentId', async () => {
    const wrapper = mount(CategoryPage, { global: { directives: { perm } } });
    await flushPromises();

    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();

    expect(apiCategoryCreate).toHaveBeenCalledTimes(1);
    expect(apiCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: '家用电器', parentId: 0 }),
    );
  });
});
