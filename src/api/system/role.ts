import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { RoleVO, RoleSaveDTO, RoleQuery } from '@/types/system';

export const apiRolePage = (q: RoleQuery) => http.get<PageResult<RoleVO>>('/system/roles', q);
export const apiRoleGet = (id: Id) => http.get<RoleVO>(`/system/roles/${id}`);
export const apiRoleCreate = (b: RoleSaveDTO) => http.post<Id>('/system/roles', b);
export const apiRoleUpdate = (id: Id, b: RoleSaveDTO) => http.put<void>(`/system/roles/${id}`, b);
export const apiRoleDelete = (id: Id) => http.del<void>(`/system/roles/${id}`);
