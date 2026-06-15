import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';

const formValues = { name: 'BUYER', code: 'BUYER', sort: 1, status: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiRoleCreate = vi.fn(async (..._a: any[]) => 1);
const apiRoleUpdate = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/system/role', () => ({
  apiRolePage: vi.fn(async () => ({ records: [], total: 0, current: 1, size: 10 })),
  apiRoleCreate: (...a: any[]) => apiRoleCreate(...a),
  apiRoleUpdate: (...a: any[]) => apiRoleUpdate(...a),
  apiRoleDelete: vi.fn(),
}));
vi.mock('@/api/system/menu', () => ({
  apiMenuTree: vi.fn(async () => [
    {
      id: 1001, parentId: 0, name: '系统管理', type: 1, children: [
        { id: 101, parentId: 1001, name: '用户管理', type: 2, children: [] },
      ],
    },
  ]),
}));

import RolePage from '@/views/system/role/index.vue';

beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 1, roles: [], permissions: [], menus: [],
  });
  vi.clearAllMocks();
});

describe('角色管理页', () => {
  it('勾选叶子菜单后提交：menuIds 含叶子与其半选父目录', async () => {
    const wrapper = mount(RolePage, { global: { directives: { perm } } });
    await flushPromises();

    (wrapper.vm as any).openCreate();
    await flushPromises();
    // 模拟 a-tree @check：选中叶子 101，父目录 1001 半选
    (wrapper.vm as any).onTreeCheck([101], { halfCheckedKeys: [1001] });
    await (wrapper.vm as any).onSubmit();
    await flushPromises();

    expect(apiRoleCreate).toHaveBeenCalledTimes(1);
    const payload = apiRoleCreate.mock.calls[0][0];
    expect(payload.name).toBe('BUYER');
    expect(payload.menuIds).toEqual(expect.arrayContaining([101, 1001]));
  });
});
