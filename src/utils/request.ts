import axios, { type AxiosInstance } from 'axios';
import { message } from 'ant-design-vue';
import type { ApiResult } from '@/types/api';
import { getToken, clearToken } from './token';

export const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 15000,
});

request.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = t; // 原始 token，无 Bearer 前缀
  return config;
});

request.interceptors.response.use(
  (resp) => {
    const res = resp.data as ApiResult;
    if (res.code === 0) return res.data;
    if (res.code === 401) {
      clearToken();
      message.error('登录已失效，请重新登录');
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(new Error(res.msg || 'unauthorized'));
    }
    message.error(res.msg || '请求失败');
    return Promise.reject(new Error(res.msg || 'error'));
  },
  (err) => {
    message.error(err?.message || '网络错误');
    return Promise.reject(err);
  },
);

// 便捷泛型封装：拦截器已把 AxiosResponse 解包为后端 data，故运行时返回的是 data。
export const http = {
  get: <T>(url: string, params?: any) => request.get(url, { params }) as unknown as Promise<T>,
  post: <T>(url: string, data?: any) => request.post(url, data) as unknown as Promise<T>,
  put: <T>(url: string, data?: any) => request.put(url, data) as unknown as Promise<T>,
  del: <T>(url: string, params?: any) => request.delete(url, { params }) as unknown as Promise<T>,
};
