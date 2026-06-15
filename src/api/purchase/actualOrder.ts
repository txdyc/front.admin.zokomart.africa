import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { ActualPurchaseOrderVO, ActualPurchaseOrderQuery } from '@/types/purchase';

export const apiActualOrderPage = (q: ActualPurchaseOrderQuery) =>
  http.get<PageResult<ActualPurchaseOrderVO>>('/actual-purchase-orders', q);
export const apiActualOrderGet = (id: Id) =>
  http.get<ActualPurchaseOrderVO>(`/actual-purchase-orders/${id}`);
// 入库：itemIds 为空表示整单入库
export const apiActualOrderInbound = (id: Id, itemIds?: Id[]) =>
  http.post<void>(`/actual-purchase-orders/${id}/inbound`, itemIds ? { itemIds } : {});
