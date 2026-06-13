import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const mockUser = {
  id: 1, username: 'buyer', nickname: null, isSuper: 0,
  roles: ['BUYER'], permissions: ['purchase:plan:create'], menus: [],
};

vi.mock('@/api/auth', () => ({
  apiLogin: vi.fn(async () => ({ token: 'tk', user: mockUser })),
  apiLogout: vi.fn(async () => undefined),
  apiUserInfo: vi.fn(async () => mockUser),
}));

import { useAuthStore } from '@/store/auth';

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('login 后 token/permissions 就位，hasPerm 精确', async () => {
    const s = useAuthStore();
    await s.login('buyer', 'p');
    expect(s.token).toBe('tk');
    expect(s.hasPerm('purchase:plan:create')).toBe(true);
    expect(s.hasPerm('inventory:edit')).toBe(false);
  });

  it('超管（isSuper=1）对任意权限码恒 true', () => {
    const s = useAuthStore();
    s.applyUser({ ...mockUser, isSuper: 1, permissions: [] });
    expect(s.hasPerm('anything:goes')).toBe(true);
    expect(s.isSuper).toBe(true);
  });

  it('permissions 含 "*" 视为全权限', () => {
    const s = useAuthStore();
    s.applyUser({ ...mockUser, isSuper: 0, permissions: ['*'] });
    expect(s.hasPerm('x:y')).toBe(true);
  });

  it('logout 清空状态', async () => {
    const s = useAuthStore();
    await s.login('buyer', 'p');
    await s.logout();
    expect(s.token).toBe('');
    expect(s.user).toBeNull();
    expect(s.permissions).toEqual([]);
  });
});
