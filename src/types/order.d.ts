import type { Id } from './api';

export type RawOrderStatus =
  | 'NOT_DISPATCHED'
  | 'PAID'
  | 'RECIPIENT_REFUSED'
  | 'UNABLE_TO_CONTACT_RECIPIENT'
  | 'RECIPIENT_UNABLE_TO_PAY';

export interface RawOrderVO {
  id: Id;
  orderDate: string;
  brand: string;
  price: number;
  customerName: string;
  city: string;
  address: string;
  telephone: string;
  productName: string;
  productCode: string;
  quantity: number;
  status: RawOrderStatus;
  cod: number;
  freight: number;
  balance: number;
  createTime: string | null;
}

export interface RawOrderQuery {
  dateStart?: string;
  dateEnd?: string;
  status?: string;
  brand?: string;
  keyword?: string;
  current?: number;
  size?: number;
}

export interface RawOrderImportError {
  row: number;
  productCode: string;
  reason: string;
}

export interface RawOrderImportResult {
  total: number;
  success: number;
  failed: number;
  errors: RawOrderImportError[];
}

export interface RawOrderUpdateDTO {
  orderDate: string;
  brand: string;
  price: number;
  customerName: string;
  city: string;
  address: string;
  telephone: string;
  productName: string;
  productCode: string;
  quantity: number;
  status: RawOrderStatus;
  cod: number;
  freight: number;
  balance: number;
}
