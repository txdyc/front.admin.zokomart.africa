import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const formValues = { name: 'DHL GH', code: 'DHL', contactPerson: 'Ama', contactPhone: '055', status: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiLogisticsProviderCreate = vi.fn(async (..._a: any[]) => 1);
vi.mock('@/api/basedata/logisticsProvider', () => ({
  apiLogisticsProviderPage: vi.fn(async () => ({ records: [], total: 0, current: 1, size: 10 })),
  apiLogisticsProviderCreate: (...a: any[]) => apiLogisticsProviderCreate(...a),
  apiLogisticsProviderUpdate: vi.fn(),
  apiLogisticsProviderDelete: vi.fn(),
}));

import LogisticsProviderPage from '@/views/basedata/logistics-provider/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(LogisticsProviderPage, { global: { directives: { perm } } });

describe('物流服务商管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('无 logisticsProvider:create 权限时「新增」按钮不渲染', () => {
    setUser({ permissions: ['logisticsProvider:list'] });
    expect(mountPage().find('[data-test="logistics-provider-create"]').exists()).toBe(false);
  });

  it('新增提交：载荷含联系人/电话', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiLogisticsProviderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'DHL GH', contactPerson: 'Ama', contactPhone: '055' }),
    );
  });
});
