import { http } from '@/utils/request';
import type { Id, PageResult } from '@/types/api';
import type { RawOrderVO, RawOrderQuery, RawOrderImportResult, RawOrderUpdateDTO } from '@/types/order';

export const apiRawOrderPage = (q: RawOrderQuery) =>
  http.get<PageResult<RawOrderVO>>('/raw-orders', q);

export const apiRawOrderImport = (form: FormData) =>
  http.post<RawOrderImportResult>('/raw-orders/import', form);

export const apiRawOrderUpdate = (id: Id, dto: RawOrderUpdateDTO) =>
  http.put<void>(`/raw-orders/${id}`, dto);
