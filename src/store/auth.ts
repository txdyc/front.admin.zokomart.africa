import { defineStore } from 'pinia';
import { apiLogin, apiLogout, apiUserInfo } from '@/api/auth';
import type { LoginUserVO, MenuVO } from '@/types/api';
import { getToken, setToken, clearToken } from '@/utils/token';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    user: null as LoginUserVO | null,
    menus: [] as MenuVO[],
    permissions: [] as string[],
    routesBuilt: false,
  }),
  getters: {
    isSuper: (s): boolean => s.user?.isSuper === 1 || s.permissions.includes('*'),
    hasPerm:
      (s) =>
      (code: string): boolean =>
        s.user?.isSuper === 1 || s.permissions.includes('*') || s.permissions.includes(code),
  },
  actions: {
    async login(username: string, password: string) {
      const vo = await apiLogin({ username, password });
      setToken(vo.token);
      this.token = vo.token;
      this.applyUser(vo.user);
    },
    async loadUserInfo() {
      const u = await apiUserInfo();
      this.applyUser(u);
    },
    applyUser(u: LoginUserVO) {
      this.user = u;
      this.menus = u.menus || [];
      this.permissions = u.permissions || [];
    },
    async logout() {
      try {
        await apiLogout();
      } catch {
        /* 忽略登出接口错误，仍清本地 */
      }
      this.reset();
    },
    reset() {
      clearToken();
      this.token = '';
      this.user = null;
      this.menus = [];
      this.permissions = [];
      this.routesBuilt = false;
    },
  },
});
