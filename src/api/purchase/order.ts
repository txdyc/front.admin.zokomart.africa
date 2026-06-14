import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type {
  PurchaseOrderVO,
  PurchaseOrderQuery,
  PaymentMarkDTO,
} from '@/types/purchase';

export const apiOrderPage = (q: PurchaseOrderQuery) =>
  http.get<PageResult<PurchaseOrderVO>>('/purchase-orders', q);
export const apiOrderGet = (id: Id) => http.get<PurchaseOrderVO>(`/purchase-orders/${id}`);
// 标记明细付款状态（itemIds + paymentStatus）
export const apiOrderMarkPayment = (id: Id, dto: PaymentMarkDTO) =>
  http.put<void>(`/purchase-orders/${id}/items/payment`, dto);
// 确认生成实际采购单（需至少一条 PAID），返回实际采购单 id
export const apiOrderConfirm = (id: Id) => http.post<Id>(`/purchase-orders/${id}/confirm`);
