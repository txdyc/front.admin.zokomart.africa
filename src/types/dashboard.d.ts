// 数据仪表盘契约（与后端 module/dashboard 的 VO 对齐，字段 camelCase）。
// 金额为数字（BigDecimal 由 Jackson 序列化为 number）；比率为 0~1 的小数。

export interface FinancialSummaryVO {
  gmv: number;
  netRevenue: number;
  codCollected: number;
  codOutstanding: number;
  cogs: number;
  deliveryFeeTotal: number;
  rejectionCost: number;
  grossProfit: number;
  grossMargin: number; // 0~1
  aov: number;
  completedOrders: number;
}

export interface FulfillmentVO {
  placed: number; // raw_order 顶端下单量
  pendingDispatch: number;
  dispatching: number;
  signed: number;
  signedPaid: number;
  unreachable: number;
  rejected: number;
  delivered: number;
  dispatchedTotal: number;
  deliverySuccessRate: number; // 0~1
  rejectionRate: number; // 0~1
  returnRate: number; // 0~1
  avgDeliveryHours: number | null;
}

export interface InventorySummaryVO {
  inventoryValue: number;
  skuCount: number;
  totalUnits: number;
  openPoCount: number;
  openPoAmount: number;
}

export interface NamedAmountVO {
  name: string;
  amount: number;
}

export interface TopProductVO {
  name: string;
  code: string;
  qty: number;
  revenue: number;
  rejectQty: number;
}

export interface DashboardOverviewVO {
  from: string;
  to: string;
  financial: FinancialSummaryVO;
  fulfillment: FulfillmentVO;
  inventory: InventorySummaryVO;
  revenueByCategory: NamedAmountVO[];
  revenueByBrand: NamedAmountVO[];
  topSuppliers: NamedAmountVO[];
  topProducts: TopProductVO[];
}

export interface DailyTrendVO {
  day: string;
  revenue: number;
  orders: number;
}
