// 采购链类型（采购计划/订单/实际采购单），与后端 module/purchase 的 VO/DTO 对齐。
import type { Id } from './api';

// 采购计划状态（与后端 PurchaseConst 一致）
export type PlanStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PurchasePlanItemVO {
  id: Id;
  supplierProductId: Id;
  supplierId: Id;
  brandId: Id | null;
  categoryId: Id | null;
  productName: string;
  productCode: string;
  wholesalePrice: number | null;
  minPurchaseQty: number | null;
  purchaseQty: number;
  amount: number | null;
}

export interface PurchasePlanVO {
  id: Id;
  planNo: string;
  status: PlanStatus;
  totalQty: number | null;
  totalAmount: number | null;
  submitTime: string | null;
  approverId: Id | null;
  approveTime: string | null;
  approveRemark: string | null;
  remark: string | null;
  createTime: string | null;
  items: PurchasePlanItemVO[];
}

export interface PurchasePlanSaveItem {
  supplierProductId: Id;
  purchaseQty: number;
}
export interface PurchasePlanSaveDTO {
  id?: Id;
  remark?: string | null;
  items: PurchasePlanSaveItem[];
}

export interface PurchasePlanQuery {
  status?: PlanStatus;
  supplierId?: Id;
  current?: number;
  size?: number;
}

// ---- 采购订单 ----
export type OrderStatus = 'PENDING_PAYMENT' | 'CONFIRMED';
export type PaymentStatus = 'UNSET' | 'PAID' | 'UNPAID';

export interface PurchaseOrderItemVO {
  id: Id;
  orderId: Id;
  supplierProductId: Id;
  productName: string;
  productCode: string;
  wholesalePrice: number | null;
  qty: number;
  amount: number | null;
  paymentStatus: PaymentStatus;
}
export interface PurchaseOrderVO {
  id: Id;
  orderNo: string;
  planId: Id | null;
  supplierId: Id;
  status: OrderStatus;
  totalQty: number | null;
  totalAmount: number | null;
  paidAmount: number | null;
  remark: string | null;
  createTime: string | null;
  items: PurchaseOrderItemVO[];
}
export interface PurchaseOrderQuery {
  planId?: Id;
  supplierId?: Id;
  status?: OrderStatus;
  current?: number;
  size?: number;
}
export interface PaymentMarkDTO {
  itemIds: Id[];
  paymentStatus: PaymentStatus;
}

// ---- 实际采购单 ----
export type ActualStatus = 'PENDING_INBOUND' | 'INBOUND_DONE';
export type InboundStatus = 'PENDING' | 'DONE';

export interface ActualPurchaseOrderItemVO {
  id: Id;
  actualOrderId: Id;
  purchaseOrderItemId: Id;
  supplierProductId: Id;
  productName: string;
  qty: number;
  wholesalePrice: number | null;
  amount: number | null;
  inboundStatus: InboundStatus;
  inboundQty: number | null;
  inboundTime: string | null;
}
export interface ActualPurchaseOrderVO {
  id: Id;
  actualNo: string;
  purchaseOrderId: Id;
  supplierId: Id;
  totalQty: number | null;
  totalAmount: number | null;
  status: ActualStatus;
  remark: string | null;
  createTime: string | null;
  items: ActualPurchaseOrderItemVO[];
}
export interface ActualPurchaseOrderQuery {
  purchaseOrderId?: Id;
  status?: ActualStatus;
  current?: number;
  size?: number;
}
