import { createRouter, createWebHistory } from 'vue-router';
import { staticRoutes, rootRoute, LAYOUT_NAME } from './static';
import { buildRoutes } from './dynamic';
import { useAuthStore } from '@/store/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [rootRoute, ...staticRoutes],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.path === '/login') return auth.token ? '/' : true;
  if (!auth.token) return { path: '/login', query: { redirect: to.fullPath } };

  if (!auth.routesBuilt) {
    if (!auth.user) await auth.loadUserInfo();
    buildRoutes(auth.menus).forEach((r) => router.addRoute(LAYOUT_NAME, r));
    router.addRoute(LAYOUT_NAME, {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/dashboard/index.vue'),
      meta: { title: '工作台' },
    });
    auth.routesBuilt = true;
    return to.fullPath; // 重新匹配新加入的路由
  }
  return true;
});

export default router;
