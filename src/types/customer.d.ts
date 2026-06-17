export interface CustomerVO {
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  orderCount: number;
  totalAmount: number | null;
  lastOrderTime: string | null;
}

export interface CustomerQuery {
  keyword?: string;
  current?: number;
  size?: number;
}
