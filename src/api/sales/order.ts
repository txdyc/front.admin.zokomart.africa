import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { SalesOrderVO, SalesOrderCreateDTO, SalesOrderQuery } from '@/types/sales';

export const apiSalesOrderCreate = (dto: SalesOrderCreateDTO) =>
  http.post<Id>('/sales-orders', dto);
export const apiSalesOrderPage = (q: SalesOrderQuery) =>
  http.get<PageResult<SalesOrderVO>>('/sales-orders', q);
export const apiSalesOrderGet = (id: Id) => http.get<SalesOrderVO>(`/sales-orders/${id}`);
