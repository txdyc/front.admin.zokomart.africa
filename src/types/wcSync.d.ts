import type { Id } from './api';

export interface WcSyncRowError {
  supplierProductId: Id;
  productCode: string | null;
  reason: string;
}

export interface WcSyncResult {
  total: number;
  created: number;
  updated: number;
  drafted: number;
  skipped: number;
  failed: number;
  errors: WcSyncRowError[];
}
