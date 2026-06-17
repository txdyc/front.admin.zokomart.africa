import { http, request } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type {
  SupplierProductVO,
  SupplierProductSaveDTO,
  SupplierProductQuery,
  SupplierProductImportResult,
  ScrapedProductRow,
} from '@/types/product';
import type { BrandVO, CategoryVO } from '@/types/basedata';

export const apiSupplierProductPage = (q: SupplierProductQuery) =>
  http.get<PageResult<SupplierProductVO>>('/supplier-products', q);
export const apiSupplierProductGet = (id: Id) =>
  http.get<SupplierProductVO>(`/supplier-products/${id}`);
export const apiSupplierProductCreate = (b: SupplierProductSaveDTO) =>
  http.post<Id>('/supplier-products', b);
export const apiSupplierProductUpdate = (id: Id, b: SupplierProductSaveDTO) =>
  http.put<void>(`/supplier-products/${id}`, b);
export const apiSupplierProductDelete = (id: Id) =>
  http.del<void>(`/supplier-products/${id}`);

// 联动筛选：基于该供应商已有产品 distinct 的品牌 / 分类
export const apiSupplierBrands = (supplierId: Id) =>
  http.get<BrandVO[]>(`/suppliers/${supplierId}/brands`);
export const apiSupplierCategories = (supplierId: Id) =>
  http.get<CategoryVO[]>(`/suppliers/${supplierId}/categories`);

// CSV 批量导入：multipart（file + supplierId + brandId + mode）
export const apiSupplierProductImport = (form: FormData) =>
  request.post('/supplier-products/import', form) as unknown as Promise<SupplierProductImportResult>;

// 从 URL 抓取产品（仅解析，不入库）
export const apiScrapeProducts = (url: string) =>
  http.post<ScrapedProductRow[]>('/supplier-products/scrape', { url });

// 导入抓取到的行
export const apiImportScraped = (payload: {
  supplierId: Id;
  brandId: Id;
  mode: 'skip' | 'overwrite';
  rows: ScrapedProductRow[];
}) => http.post<SupplierProductImportResult>('/supplier-products/import-scraped', payload);
