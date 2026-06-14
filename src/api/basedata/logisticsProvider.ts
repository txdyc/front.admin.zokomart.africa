import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { LogisticsProviderVO, LogisticsProviderSaveDTO, BaseDataQuery } from '@/types/basedata';

export const apiLogisticsProviderPage = (q: BaseDataQuery) =>
  http.get<PageResult<LogisticsProviderVO>>('/logistics-providers', q);
export const apiLogisticsProviderGet = (id: Id) =>
  http.get<LogisticsProviderVO>(`/logistics-providers/${id}`);
export const apiLogisticsProviderCreate = (b: LogisticsProviderSaveDTO) =>
  http.post<Id>('/logistics-providers', b);
export const apiLogisticsProviderUpdate = (id: Id, b: LogisticsProviderSaveDTO) =>
  http.put<void>(`/logistics-providers/${id}`, b);
export const apiLogisticsProviderDelete = (id: Id) =>
  http.del<void>(`/logistics-providers/${id}`);
