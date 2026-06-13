import { http } from '@/utils/request';
import type { PageResult } from '@/types/api';
import type { UserVO, UserSaveDTO, UserQuery } from '@/types/system';

export const apiUserPage = (q: UserQuery) => http.get<PageResult<UserVO>>('/system/users', q);
export const apiUserGet = (id: number) => http.get<UserVO>(`/system/users/${id}`);
export const apiUserCreate = (b: UserSaveDTO) => http.post<number>('/system/users', b);
export const apiUserUpdate = (id: number, b: UserSaveDTO) =>
  http.put<void>(`/system/users/${id}`, b);
export const apiUserDelete = (id: number) => http.del<void>(`/system/users/${id}`);
export const apiUserSetRoles = (id: number, roleIds: number[]) =>
  http.put<void>(`/system/users/${id}/roles`, { roleIds });
// 后端 ResetPwdDTO 字段为 newPassword
export const apiUserResetPwd = (id: number, newPassword: string) =>
  http.put<void>(`/system/users/${id}/password`, { newPassword });
