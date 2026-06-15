// 基础数据（品牌/供应商/分类/物流服务商）类型，与后端 module/basedata 的 VO/DTO 对齐。
import type { Id } from './api';

// ---- 品牌 ----
export interface BrandVO {
  id: Id;
  name: string;
  code: string | null;
  logoUrl: string | null;
  sort: number | null;
  status: number;
  remark: string | null;
  createTime: string | null;
}
export interface BrandSaveDTO {
  id?: Id;
  name: string;
  code?: string | null;
  logoUrl?: string | null;
  sort?: number | null;
  status?: number;
  remark?: string | null;
}

// ---- 供应商 ----
export interface SupplierVO {
  id: Id;
  name: string;
  code: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  address: string | null;
  status: number;
  remark: string | null;
  createTime: string | null;
}
export interface SupplierSaveDTO {
  id?: Id;
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status?: number;
  remark?: string | null;
}

// ---- 供应商-品牌授权 ----
export interface SupplierBrandVO {
  id: Id;
  brandId: Id;
  brandName: string | null;
  brandLogoUrl: string | null;
  status: number;
  remark: string | null;
}

// ---- 分类（树）----
export interface CategoryVO {
  id: Id;
  parentId: Id;
  name: string;
  sort: number | null;
  status: number;
  createTime: string | null;
  children: CategoryVO[];
}
export interface CategorySaveDTO {
  id?: Id;
  parentId?: Id | null;
  name: string;
  sort?: number | null;
  status?: number;
}

// ---- 物流服务商 ----
export interface LogisticsProviderVO {
  id: Id;
  name: string;
  code: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  status: number;
  remark: string | null;
  createTime: string | null;
}
export interface LogisticsProviderSaveDTO {
  id?: Id;
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  status?: number;
  remark?: string | null;
}

// 列表筛选（品牌/供应商/物流商通用）
export interface BaseDataQuery {
  keyword?: string;
  status?: number;
  current?: number;
  size?: number;
}
