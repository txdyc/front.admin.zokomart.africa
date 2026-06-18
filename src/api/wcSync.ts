import { http } from '@/utils/request';
import type { Id } from '@/types/api';
import type { WcSyncResult } from '@/types/wcSync';

export const apiWcSync = (payload: { supplierId: Id; brandIds: Id[] }) =>
  http.post<WcSyncResult>('/wc-sync/supplier-brands', payload);
