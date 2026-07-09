// 销售类型，与后端 module/sales 的 VO/DTO 对齐。
import type { Id } from './api';

export type SalesStatus =
  | 'PENDING_DISPATCH'
  | 'DISPATCHING'
  | 'SIGNED'
  | 'SIGNED_PAID'
  | 'UNREACHABLE'
  | 'REJECTED';

export interface SalesOrderItemVO {
  id: Id;
  supplierProductId: Id;
  productName: string;
  productCode: string;
  unitPrice: number | null;
  qty: number;
  rejectQty: number | null;
  amount: number | null;
  actualAmount: number | null;
}

export interface SalesOrderVO {
  id: Id;
  orderNo: string;
  status: SalesStatus;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  salespersonId: Id | null;
  totalQty: number | null;
  totalAmount: number | null;
  actualAmount: number | null;
  logisticsProviderId: Id | null;
  deliveryFee: number | null;
  dispatchTime: string | null;
  signTime: string | null;
  completeTime: string | null;
  completed: number; // 0/1
  remark: string | null;
  createTime: string | null;
  items: SalesOrderItemVO[];
}

export interface SalesOrderLabelVO {
  id: Id;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  totalQty: number | null;
  totalAmount: number | null;
}

export interface SalesOrderCreateItem {
  supplierProductId: Id;
  qty: number;
  unitPrice?: number | null; // 可空：后端默认带出零售价
}
export interface SalesOrderCreateDTO {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  remark?: string | null;
  items: SalesOrderCreateItem[];
}

export interface SalesOrderQuery {
  completed?: boolean;
  current?: number;
  size?: number;
}

// ---- 物流动作 ----
export interface LogisticsDispatchDTO {
  logisticsProviderId: Id;
  /** null = 未知（送达后再补录），区别于 0 = 免费 */
  deliveryFee: number | null;
}
export interface LogisticsStatusUpdateDTO {
  status: SalesStatus;
  deliveryFee?: number | null;
}
export interface RejectItemDTO {
  itemId: Id;
  rejectQty: number;
}
