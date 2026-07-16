import type { RouteRecordRaw } from 'vue-router';
import type { MenuVO } from '@/types/api';

const modules = import.meta.glob('/src/views/**/*.vue');

function resolveComp(component: string | null) {
  if (!component) return undefined;
  const path = `/src/views/${component}.vue`;
  return modules[path]; // 未命中返回 undefined（守卫兜底到 404）
}

/** 菜单树 → 路由：跳过按钮(type=3)与停用菜单；type=2 解析组件；visible=0 标记 hidden。 */
export function buildRoutes(menus: MenuVO[]): RouteRecordRaw[] {
  const walk = (nodes: MenuVO[]): RouteRecordRaw[] =>
    nodes
      .filter((n) => n.type !== 3 && n.status === 1)
      .map((n) => {
        const route = {
          path: n.routePath || `/_${n.id}`,
          name: `menu_${n.id}`,
          component: n.type === 2 ? resolveComp(n.component) : undefined,
          meta: {
            title: n.name,
            icon: n.icon,
            hidden: n.visible === 0,
            permCode: n.permCode,
          },
          children: n.children?.length ? walk(n.children) : undefined,
        } as RouteRecordRaw;
        // 目录(type=1)无组件：直接访问其路径时重定向到首个可见子菜单，
        // 否则会命中空 router-view（如 / → /dashboard 命中数据看板目录后白屏）。
        if (n.type === 1 && route.children?.length) {
          const first =
            route.children.find((c) => !(c.meta as { hidden?: boolean })?.hidden) ?? route.children[0];
          route.redirect = first.path;
        }
        return route;
      });
  return walk(menus);
}
