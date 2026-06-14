import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { SupplierVO, SupplierSaveDTO, BaseDataQuery } from '@/types/basedata';

export const apiSupplierPage = (q: BaseDataQuery) =>
  http.get<PageResult<SupplierVO>>('/suppliers', q);
export const apiSupplierGet = (id: Id) => http.get<SupplierVO>(`/suppliers/${id}`);
export const apiSupplierCreate = (b: SupplierSaveDTO) => http.post<Id>('/suppliers', b);
export const apiSupplierUpdate = (id: Id, b: SupplierSaveDTO) =>
  http.put<void>(`/suppliers/${id}`, b);
export const apiSupplierDelete = (id: Id) => http.del<void>(`/suppliers/${id}`);
