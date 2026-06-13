// 与后端统一响应/分页/鉴权契约对齐（字段名 camelCase）。
export interface ApiResult<T = any> {
  code: number;
  msg: string;
  data: T;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  current: number;
  size: number;
}

export interface PageQuery {
  current?: number;
  size?: number;
  [k: string]: any;
}

export interface MenuVO {
  id: number;
  parentId: number;
  name: string;
  type: number; // 1 目录 / 2 菜单(页面) / 3 按钮(仅权限)
  permCode: string | null;
  routePath: string | null;
  component: string | null;
  icon: string | null;
  sort: number;
  visible: number; // 0 隐藏 / 1 显示
  status: number; // 0 停用 / 1 启用
  children: MenuVO[];
}

export interface LoginUserVO {
  id: number;
  username: string;
  nickname: string | null;
  isSuper: number; // 1 = 超级管理员
  roles: string[];
  permissions: string[];
  menus: MenuVO[];
}

export interface LoginVO {
  token: string;
  user: LoginUserVO;
}
