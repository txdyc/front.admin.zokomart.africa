import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';

const formValues = { parentId: 0, name: '商品管理', type: 1, sort: 1, visible: 1, status: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiMenuCreate = vi.fn(async (..._a: any[]) => 1);
vi.mock('@/api/system/menu', () => ({
  apiMenuTree: vi.fn(async () => [
    { id: 1001, parentId: 0, name: '系统管理', type: 1, children: [] },
  ]),
  apiMenuCreate: (...a: any[]) => apiMenuCreate(...a),
  apiMenuUpdate: vi.fn(),
  apiMenuDelete: vi.fn(),
}));

import MenuPage from '@/views/system/menu/index.vue';

beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 1, roles: [], permissions: [], menus: [],
  });
  vi.clearAllMocks();
});

describe('菜单管理页', () => {
  it('新增提交：调用 apiMenuCreate，载荷含 type', async () => {
    const wrapper = mount(MenuPage, { global: { directives: { perm } } });
    await flushPromises();

    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();

    expect(apiMenuCreate).toHaveBeenCalledTimes(1);
    expect(apiMenuCreate).toHaveBeenCalledWith(expect.objectContaining({ name: '商品管理', type: 1 }));
  });
});
