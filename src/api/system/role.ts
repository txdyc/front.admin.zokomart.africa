import { http } from '@/utils/request';
import type { PageResult } from '@/types/api';
import type { RoleVO, RoleSaveDTO, RoleQuery } from '@/types/system';

export const apiRolePage = (q: RoleQuery) => http.get<PageResult<RoleVO>>('/system/roles', q);
export const apiRoleGet = (id: number) => http.get<RoleVO>(`/system/roles/${id}`);
export const apiRoleCreate = (b: RoleSaveDTO) => http.post<number>('/system/roles', b);
export const apiRoleUpdate = (id: number, b: RoleSaveDTO) =>
  http.put<void>(`/system/roles/${id}`, b);
export const apiRoleDelete = (id: number) => http.del<void>(`/system/roles/${id}`);
