import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const formValues = {
  name: 'Sup A', code: 'S1', contactPerson: 'Kofi', contactPhone: '024', address: 'Accra', status: 1,
};
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiSupplierCreate = vi.fn(async (..._a: any[]) => 1);
const apiSupplierUpdate = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/basedata/supplier', () => ({
  apiSupplierPage: vi.fn(async () => ({ records: [], total: 0, current: 1, size: 10 })),
  apiSupplierCreate: (...a: any[]) => apiSupplierCreate(...a),
  apiSupplierUpdate: (...a: any[]) => apiSupplierUpdate(...a),
  apiSupplierDelete: vi.fn(),
}));

import SupplierPage from '@/views/basedata/supplier/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(SupplierPage, { global: { directives: { perm } } });

describe('供应商管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('无 supplier:create 权限时「新增」按钮不渲染', () => {
    setUser({ permissions: ['supplier:list'] });
    expect(mountPage().find('[data-test="supplier-create"]').exists()).toBe(false);
  });

  it('新增提交：载荷含供应商专有字段（联系人/电话/地址）', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiSupplierCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sup A', contactPerson: 'Kofi', contactPhone: '024', address: 'Accra' }),
    );
  });
});
