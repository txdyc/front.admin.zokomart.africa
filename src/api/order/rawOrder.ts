import { http } from '@/utils/request';
import type { PageResult } from '@/types/api';
import type { RawOrderVO, RawOrderQuery, RawOrderImportResult } from '@/types/order';

export const apiRawOrderPage = (q: RawOrderQuery) =>
  http.get<PageResult<RawOrderVO>>('/raw-orders', q);

export const apiRawOrderImport = (form: FormData) =>
  http.post<RawOrderImportResult>('/raw-orders/import', form);
