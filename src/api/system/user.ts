import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { UserVO, UserSaveDTO, UserQuery } from '@/types/system';

export const apiUserPage = (q: UserQuery) => http.get<PageResult<UserVO>>('/system/users', q);
export const apiUserGet = (id: Id) => http.get<UserVO>(`/system/users/${id}`);
export const apiUserCreate = (b: UserSaveDTO) => http.post<Id>('/system/users', b);
export const apiUserUpdate = (id: Id, b: UserSaveDTO) => http.put<void>(`/system/users/${id}`, b);
export const apiUserDelete = (id: Id) => http.del<void>(`/system/users/${id}`);
export const apiUserSetRoles = (id: Id, roleIds: Id[]) =>
  http.put<void>(`/system/users/${id}/roles`, { roleIds });
// 后端 ResetPwdDTO 字段为 newPassword
export const apiUserResetPwd = (id: Id, newPassword: string) =>
  http.put<void>(`/system/users/${id}/password`, { newPassword });
