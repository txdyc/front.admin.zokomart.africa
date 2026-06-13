import { describe, it, expect } from 'vitest';
import { buildRoutes } from '@/router/dynamic';
import type { MenuVO } from '@/types/api';

function m(p: Partial<MenuVO>): MenuVO {
  return {
    id: 0, parentId: 0, name: '', type: 2, permCode: null, routePath: null,
    component: null, icon: null, sort: 0, visible: 1, status: 1, children: [],
    ...p,
  };
}

describe('buildRoutes 菜单树→路由', () => {
  const menus: MenuVO[] = [
    m({
      id: 1, name: '系统管理', type: 1, routePath: '/system',
      children: [
        m({
          id: 11, name: '用户管理', type: 2, routePath: '/system/user', component: 'system/user/index',
          children: [m({ id: 111, name: '新增', type: 3, permCode: 'system:user:create' })],
        }),
        m({ id: 12, name: '隐藏页', type: 2, routePath: '/system/hidden', component: 'x/y', visible: 0 }),
      ],
    }),
    m({ id: 2, name: '停用目录', type: 1, status: 0 }),
  ];

  const routes = buildRoutes(menus);

  it('过滤停用目录(status=0)', () => {
    expect(routes).toHaveLength(1);
    expect(routes[0].name).toBe('menu_1');
  });

  it('目录保留页面子节点、过滤按钮(type=3)', () => {
    const children = routes[0].children!;
    expect(children).toHaveLength(2); // 用户管理 + 隐藏页，按钮被剔除
    const user = children.find((r) => r.name === 'menu_11')!;
    expect(user.meta?.title).toBe('用户管理');
    expect(user.children).toHaveLength(0); // 其下仅一个按钮，被过滤
  });

  it('visible=0 标记 meta.hidden', () => {
    const hidden = routes[0].children!.find((r) => r.name === 'menu_12')!;
    expect(hidden.meta?.hidden).toBe(true);
  });
});
