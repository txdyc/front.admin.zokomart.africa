import { http } from '@/utils/request';
import type { MenuVO, Id } from '@/types/api';
import type { MenuSaveDTO } from '@/types/system';

// 后端无平铺 list，读取统一走 /tree
export const apiMenuTree = () => http.get<MenuVO[]>('/system/menus/tree');
export const apiMenuCreate = (b: MenuSaveDTO) => http.post<Id>('/system/menus', b);
export const apiMenuUpdate = (id: Id, b: MenuSaveDTO) => http.put<void>(`/system/menus/${id}`, b);
export const apiMenuDelete = (id: Id) => http.del<void>(`/system/menus/${id}`);
