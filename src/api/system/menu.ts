import { http } from '@/utils/request';
import type { MenuVO } from '@/types/api';
import type { MenuSaveDTO } from '@/types/system';

// 后端无平铺 list，读取统一走 /tree
export const apiMenuTree = () => http.get<MenuVO[]>('/system/menus/tree');
export const apiMenuCreate = (b: MenuSaveDTO) => http.post<number>('/system/menus', b);
export const apiMenuUpdate = (id: number, b: MenuSaveDTO) =>
  http.put<void>(`/system/menus/${id}`, b);
export const apiMenuDelete = (id: number) => http.del<void>(`/system/menus/${id}`);
