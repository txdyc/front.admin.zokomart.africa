import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { PurchasePlanVO, PurchasePlanSaveDTO, PurchasePlanQuery } from '@/types/purchase';

export const apiPlanPage = (q: PurchasePlanQuery) =>
  http.get<PageResult<PurchasePlanVO>>('/purchase-plans', q);
export const apiPlanGet = (id: Id) => http.get<PurchasePlanVO>(`/purchase-plans/${id}`);
export const apiPlanCreate = (b: PurchasePlanSaveDTO) => http.post<Id>('/purchase-plans', b);
export const apiPlanUpdate = (id: Id, b: PurchasePlanSaveDTO) =>
  http.put<void>(`/purchase-plans/${id}`, b);
export const apiPlanDelete = (id: Id) => http.del<void>(`/purchase-plans/${id}`);
export const apiPlanSubmit = (id: Id) => http.post<void>(`/purchase-plans/${id}/submit`);
export const apiPlanApprove = (id: Id) => http.post<void>(`/purchase-plans/${id}/approve`);
export const apiPlanReject = (id: Id, reason: string) =>
  http.post<void>(`/purchase-plans/${id}/reject`, { reason });
