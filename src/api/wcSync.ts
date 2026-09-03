import { http } from '@/utils/request';
import type { Id } from '@/types/api';
import type { WcSyncJob, WcSyncSite } from '@/types/wcSync';

/** 目标站点列表（未配置的站点置灰不可选）。 */
export const apiWcSyncSites = () => http.get<WcSyncSite[]>('/wc-sync/sites');

/** 启动同步（每站一个 job），返回 jobIds（与所选站点一一对应）；siteCodes 省略=全部已配置站点。 */
export const apiStartWcSync = (payload: { supplierId: Id; brandIds: Id[]; siteCodes?: string[] }) =>
  http.post<{ jobIds: Id[] }>('/wc-sync/supplier-brands', payload);

/** 查任务进度。 */
export const apiGetWcSyncJob = (jobId: Id) => http.get<WcSyncJob>(`/wc-sync/jobs/${jobId}`);
