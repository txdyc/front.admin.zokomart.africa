import type { Id } from '@/types/api';

export interface AdAiModelVO {
  id: Id;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  modelCode: string;
  enabled: number;
  sort: number;
  remark?: string;
}

export interface AdAiModelSaveDTO {
  id?: Id;
  name: string;
  baseUrl: string;
  /** 新建必填；编辑留空 = 不修改 */
  apiKey?: string;
  modelCode: string;
  enabled: number;
  sort?: number;
  remark?: string;
}

export interface AdGenerateDTO {
  modelId: Id;
  prompt: string;
  sourceImageUrls: string[];
  count: number;
}

export interface AdGenerateVO {
  tempUrls: string[];
  errors: string[];
}

export interface AdKeepItem {
  tempUrl: string;
  prompt?: string;
  modelId?: Id;
}

export interface AdKeepDTO {
  supplierProductId: Id;
  items: AdKeepItem[];
}

export interface AdProductImageVO {
  id: Id;
  supplierProductId: Id;
  fileUrl: string;
  prompt?: string;
  modelId?: Id;
  sort: number;
}
