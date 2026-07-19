import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { useAuthStore } from '@/store/auth';
import { perm } from '@/directives/perm';
import type { LoginUserVO } from '@/types/api';

const formValues = { name: 'NB Pro', baseUrl: 'https://agg/v1', apiKey: 'sk-1', modelCode: 'nano', enabled: 1 };
vi.mock('@/components/SchemaForm.vue', () => ({
  default: defineComponent({
    name: 'SchemaForm',
    setup(_, { expose }) {
      expose({ validate: async () => true, getValues: () => ({ ...formValues }) });
      return () => null;
    },
  }),
}));

const apiAdModelPage = vi.fn(async (..._a: any[]) => ({ records: [], total: 0, current: 1, size: 10 }));
const apiAdModelCreate = vi.fn(async (..._a: any[]) => '1');
const apiAdModelUpdate = vi.fn(async (..._a: any[]) => undefined);
const apiAdModelDelete = vi.fn(async (..._a: any[]) => undefined);
vi.mock('@/api/ad', () => ({
  apiAdModelPage: (...a: any[]) => apiAdModelPage(...a),
  apiAdModelCreate: (...a: any[]) => apiAdModelCreate(...a),
  apiAdModelUpdate: (...a: any[]) => apiAdModelUpdate(...a),
  apiAdModelDelete: (...a: any[]) => apiAdModelDelete(...a),
}));

import ModelPage from '@/views/ad/model/index.vue';

function setUser(u: Partial<LoginUserVO>) {
  useAuthStore().applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...u,
  });
}
const mountPage = () => mount(ModelPage, { global: { directives: { perm } } });

describe('模型管理页', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('无 ad:model:create 权限时「新增模型」不渲染', () => {
    setUser({ permissions: ['ad:model:list'] });
    expect(mountPage().find('[data-test="ad-model-create"]').exists()).toBe(false);
  });

  it('新增提交调 create；编辑提交调 update(id) 且空 apiKey 不阻塞', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiAdModelCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'NB Pro' }));

    (wrapper.vm as any).openEdit({ id: '9', name: 'NB Pro', baseUrl: 'https://agg/v1', modelCode: 'nano', enabled: 1 });
    await flushPromises();
    await (wrapper.vm as any).onSubmit();
    await flushPromises();
    expect(apiAdModelUpdate).toHaveBeenCalledWith('9', expect.objectContaining({ name: 'NB Pro' }));
  });

  it('删除调 apiAdModelDelete(id)', async () => {
    setUser({ isSuper: 1 });
    const wrapper = mountPage();
    await (wrapper.vm as any).onDelete({ id: '5' });
    await flushPromises();
    expect(apiAdModelDelete).toHaveBeenCalledWith('5');
  });
});
