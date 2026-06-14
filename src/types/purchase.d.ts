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
