import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { BrandVO, BrandSaveDTO, BaseDataQuery } from '@/types/basedata';

export const apiBrandPage = (q: BaseDataQuery) => http.get<PageResult<BrandVO>>('/brands', q);
export const apiBrandGet = (id: Id) => http.get<BrandVO>(`/brands/${id}`);
export const apiBrandCreate = (b: BrandSaveDTO) => http.post<Id>('/brands', b);
export const apiBrandUpdate = (id: Id, b: BrandSaveDTO) => http.put<void>(`/brands/${id}`, b);
export const apiBrandDelete = (id: Id) => http.del<void>(`/brands/${id}`);
