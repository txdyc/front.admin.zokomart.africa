import { http, request } from '@/utils/request';
import type { Id, PageResult } from '@/types/api';
import type {
  AdAiModelVO,
  AdAiModelSaveDTO,
  AdGenerateDTO,
  AdGenerateVO,
  AdKeepDTO,
  AdProductImageVO,
} from '@/types/ad';

// ---- 模型管理 ----
export const apiAdModelPage = (q: { keyword?: string; enabled?: number; current?: number; size?: number }) =>
  http.get<PageResult<AdAiModelVO>>('/ad/models', q);
export const apiAdModelEnabled = () => http.get<AdAiModelVO[]>('/ad/models/enabled');
export const apiAdModelCreate = (d: AdAiModelSaveDTO) => http.post<Id>('/ad/models', d);
export const apiAdModelUpdate = (id: Id, d: AdAiModelSaveDTO) => http.put<void>(`/ad/models/${id}`, d);
export const apiAdModelDelete = (id: Id) => http.del<void>(`/ad/models/${id}`);

// ---- AI 生图 ----
// 生成耗时 10-60s：绕过默认 15s 超时，单独放宽到 120s
export const apiAdGenerate = (d: AdGenerateDTO) =>
  request.post('/ad/images/generate', d, { timeout: 120_000 }) as unknown as Promise<AdGenerateVO>;
export const apiAdKeep = (d: AdKeepDTO) => http.post<Id[]>('/ad/images/keep', d);
export const apiAdDiscard = (tempUrls: string[]) => http.post<void>('/ad/images/discard', { tempUrls });
export const apiAdImageList = (supplierProductId: Id) =>
  http.get<AdProductImageVO[]>('/ad/images', { supplierProductId });
export const apiAdImageDelete = (id: Id) => http.del<void>(`/ad/images/${id}`);
