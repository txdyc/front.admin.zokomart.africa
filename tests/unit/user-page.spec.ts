import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

// 用可控的 SchemaForm 替身：getValues 返回固定值，validate 恒过
const formValues = { username: 'kofi', password: 'P@ss123', nickname: 'Kofi', status: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiUserPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiUserCreate = vi.fn(async (..._a: any[]) => 1);
const apiUserUpdate = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/system/user', () => ({
  apiUserPage: (...a: any[]) => apiUserPage(...a),
  apiUserCreate: (...a: any[]) => apiUserCreate(...a),
  apiUserUpdate: (...a: any[]) => apiUserUpdate(...a),
  apiUserDelete: vi.fn(),
  apiUserSetRoles: vi.fn(),
  apiUserResetPwd: vi.fn(),
}));
vi.mock('@/api/system/role', () => ({
  apiRolePage: vi.fn(async () => ({ records: [], total: 0, current: 1, size: 10 })),
}));

import UserPage from '@/views/system/user/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}

describe('用户管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('无 system:user:create 权限时「新增」按钮不渲染', () => {
    setUser({ permissions: ['system:user:list'] });
    const wrapper = mount(UserPage, { global: { directives: { perm } } });
    expect(wrapper.find('[data-test="user-create"]').exists()).toBe(false);
  });

  it('超管可见「新增」按钮', () => {
    setUser({ isSuper: 1 });
    const wrapper = mount(UserPage, { global: { directives: { perm } } });
    expect(wrapper.find('[data-test="user-create"]').exists()).toBe(true);
  });

  it('新增提交：调用 apiUserCreate 且载荷来自表单', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mount(UserPage, { global: { directives: { perm } } });
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();

    expect(apiUserCreate).toHaveBeenCalledTimes(1);
    expect(apiUserCreate).toHaveBeenCalledWith(expect.objectContaining({ username: 'kofi' }));
    expect(apiUserUpdate).not.toHaveBeenCalled();
  });

  it('编辑提交：调用 apiUserUpdate(id, payload)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mount(UserPage, { global: { directives: { perm } } });
    (wrapper.vm as any).openEdit({ id: 7, username: 'kofi', status: 1, roleIds: [] });
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();

    expect(apiUserUpdate).toHaveBeenCalledWith(7, expect.objectContaining({ username: 'kofi' }));
    expect(apiUserCreate).not.toHaveBeenCalled();
  });
});
