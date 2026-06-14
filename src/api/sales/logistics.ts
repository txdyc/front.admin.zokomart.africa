import { http } from '@/utils/request';
import type { Id } from '@/types/api';
import type { LogisticsDispatchDTO, RejectItemDTO, SalesStatus } from '@/types/sales';

// 物流动作均挂在 /api/sales-orders/{id} 下
export const apiLogisticsDispatch = (id: Id, dto: LogisticsDispatchDTO) =>
  http.post<void>(`/sales-orders/${id}/dispatch`, dto);
export const apiLogisticsUpdateStatus = (id: Id, status: SalesStatus) =>
  http.put<void>(`/sales-orders/${id}/status`, { status });
export const apiLogisticsReject = (id: Id, dto: RejectItemDTO) =>
  http.put<void>(`/sales-orders/${id}/items/reject`, dto);
export const apiLogisticsComplete = (id: Id) => http.post<void>(`/sales-orders/${id}/complete`);
