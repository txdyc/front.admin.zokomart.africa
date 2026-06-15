import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { InventoryStockVO, StockAdjustDTO, InventoryStockQuery } from '@/types/inventory';

export const apiStockPage = (q: InventoryStockQuery) =>
  http.get<PageResult<InventoryStockVO>>('/inventory/stocks', q);
// 手工调整到目标数量（按 supplierProductId），库存流水由后端处理
export const apiStockAdjust = (supplierProductId: Id, dto: StockAdjustDTO) =>
  http.put<void>(`/inventory/stocks/${supplierProductId}`, dto);
