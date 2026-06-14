// 平台商品目录（SPU/SKU）类型，与后端 module/product 的 VO/DTO 对齐。
import type { Id } from './api';

// ---- SPU ----
export interface ProductSpuVO {
  id: Id;
  name: string;
  brandId: Id | null;
  categoryId: Id | null;
  mainImage: string | null;
  description: string | null;
  status: number;
  createTime: string | null;
}
export interface ProductSpuSaveDTO {
  id?: Id;
  name: string;
  brandId?: Id | null;
  categoryId?: Id | null;
  mainImage?: string | null;
  description?: string | null;
  status?: number;
}

// SPU 列表筛选（支持品牌/分类过滤）
export interface ProductSpuQuery {
  keyword?: string;
  brandId?: Id;
  categoryId?: Id;
  status?: number;
  current?: number;
  size?: number;
}

// ---- SKU ----
export interface ProductSkuVO {
  id: Id;
  spuId: Id;
  skuCode: string;
  spec: string | null;
  image: string | null;
  price: number | null;
  status: number;
  createTime: string | null;
}
export interface ProductSkuSaveDTO {
  id?: Id;
  spuId: Id;
  skuCode: string;
  spec?: string | null;
  image?: string | null;
  price?: number | null;
  status?: number;
}
