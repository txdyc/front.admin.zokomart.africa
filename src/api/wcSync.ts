import { http } from '@/utils/request';
import type { Id } from '@/types/api';
import type { WcSyncJob } from '@/types/wcSync';

/** 启动同步，返回 jobId。 */
export const apiStartWcSync = (payload: { supplierId: Id; brandIds: Id[] }) =>
  http.post<{ jobId: Id }>('/wc-sync/supplier-brands', payload);

/** 查任务进度。 */
export const apiGetWcSyncJob = (jobId: Id) => http.get<WcSyncJob>(`/wc-sync/jobs/${jobId}`);
