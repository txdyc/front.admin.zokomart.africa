// 库存类型，与后端 module/inventory 的 VO/DTO 对齐。
import type { Id } from './api';

export interface InventoryStockVO {
  id: Id;
  supplierProductId: Id;
  productName: string;
  productCode: string;
  supplierId: Id;
  supplierName: string;
  brandId: Id | null;
  brandName: string | null;
  categoryId: Id | null;
  categoryName: string | null;
  quantity: number;
  updateTime: string | null;
}

export interface StockAdjustDTO {
  quantity: number;
  remark?: string | null;
}

// 列表筛选（CascadeFilter 输出；status 后端忽略）
export interface InventoryStockQuery {
  supplierId?: Id;
  brandId?: Id;
  categoryId?: Id;
  keyword?: string;
  current?: number;
  size?: number;
}
