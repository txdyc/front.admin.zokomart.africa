// 系统管理（用户/角色/菜单）类型，与后端 module/system 的 VO/DTO 字段对齐（camelCase）。
import type { MenuVO } from './api';

export type { MenuVO };

// ---- 用户 ----
export interface UserVO {
  id: number;
  username: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  status: number; // 0 停用 / 1 启用
  isSuper: number; // 1 = 超级管理员
  remark: string | null;
  createTime: string | null;
  roleIds: number[];
}

export interface UserSaveDTO {
  id?: number;
  username: string;
  /** 新增必填；编辑留空表示不改密码 */
  password?: string;
  nickname?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: number;
  remark?: string | null;
  roleIds?: number[];
}

export interface UserQuery {
  username?: string;
  status?: number;
  current?: number;
  size?: number;
}

// ---- 角色 ----
export interface RoleVO {
  id: number;
  name: string;
  code: string;
  sort: number | null;
  status: number;
  remark: string | null;
  createTime: string | null;
  menuIds: number[];
}

export interface RoleSaveDTO {
  id?: number;
  name: string;
  code: string;
  sort?: number | null;
  status?: number;
  remark?: string | null;
  menuIds?: number[];
}

export interface RoleQuery {
  keyword?: string;
  current?: number;
  size?: number;
}

// ---- 菜单 ----
export interface MenuSaveDTO {
  id?: number;
  parentId?: number | null;
  name: string;
  type: number; // 1 目录 / 2 菜单 / 3 按钮
  permCode?: string | null;
  routePath?: string | null;
  component?: string | null;
  icon?: string | null;
  sort?: number | null;
  visible?: number;
  status?: number;
}
