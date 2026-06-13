import { http } from '@/utils/request';
import type { LoginVO, LoginUserVO } from '@/types/api';

export const apiLogin = (body: { username: string; password: string }) =>
  http.post<LoginVO>('/auth/login', body);

export const apiLogout = () => http.post<void>('/auth/logout');

export const apiUserInfo = () => http.get<LoginUserVO>('/auth/user-info');
