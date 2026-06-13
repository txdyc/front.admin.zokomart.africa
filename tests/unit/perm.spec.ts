import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { perm } from '@/directives/perm';
import { useAuthStore } from '@/store/auth';
import type { LoginUserVO } from '@/types/api';

const Comp = {
  template: `<div><button v-perm="'brand:create'" class="btn">新增</button></div>`,
};

function mountWith(user: Partial<LoginUserVO>) {
  const s = useAuthStore();
  s.applyUser({
    id: 1, username: 'u', nickname: null, isSuper: 0, roles: [], permissions: [], menus: [],
    ...user,
  });
  return mount(Comp, { global: { directives: { perm } } });
}

describe('v-perm 指令', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('无权限时移除元素', () => {
    const w = mountWith({ permissions: [] });
    expect(w.find('.btn').exists()).toBe(false);
  });

  it('有对应权限码时保留', () => {
    const w = mountWith({ permissions: ['brand:create'] });
    expect(w.find('.btn').exists()).toBe(true);
  });

  it('超管恒保留', () => {
    const w = mountWith({ isSuper: 1, permissions: [] });
    expect(w.find('.btn').exists()).toBe(true);
  });
});
