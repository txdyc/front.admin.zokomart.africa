import type { RouteRecordRaw } from 'vue-router';
import BasicLayout from '@/layouts/BasicLayout.vue';

export const LAYOUT_NAME = 'root';

export const staticRoutes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/views/login/index.vue'), meta: { hidden: true } },
  { path: '/403', name: '403', component: () => import('@/views/error/403.vue'), meta: { hidden: true } },
  { path: '/:pathMatch(.*)*', name: '404', component: () => import('@/views/error/404.vue'), meta: { hidden: true } },
];

// 业务路由统一挂在此根布局下（动态 addRoute 时以它为 parent）。
export const rootRoute: RouteRecordRaw = {
  path: '/',
  name: LAYOUT_NAME,
  component: BasicLayout,
  redirect: '/dashboard',
  children: [],
};
