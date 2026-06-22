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

export interface WcSyncJobItem {
  supplierProductId?: number | string;
  productCode: string;
  reason: string;
}

export interface WcSyncJob {
  jobId: number | string;
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'INTERRUPTED';
  total: number;
  processed: number;
  created: number;
  updated: number;
  drafted: number;
  failed: number;
  failedItems: WcSyncJobItem[];
  startTime?: string;
  endTime?: string;
}
