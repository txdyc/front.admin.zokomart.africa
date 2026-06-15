import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type { ProductSpuVO, ProductSpuSaveDTO, ProductSpuQuery, ProductSkuVO } from '@/types/product';

export const apiSpuPage = (q: ProductSpuQuery) =>
  http.get<PageResult<ProductSpuVO>>('/product-spus', q);
export const apiSpuGet = (id: Id) => http.get<ProductSpuVO>(`/product-spus/${id}`);
// 按 SPU 查其下 SKU 列表（无分页）
export const apiSpuSkus = (id: Id) => http.get<ProductSkuVO[]>(`/product-spus/${id}/skus`);
export const apiSpuCreate = (b: ProductSpuSaveDTO) => http.post<Id>('/product-spus', b);
export const apiSpuUpdate = (id: Id, b: ProductSpuSaveDTO) =>
  http.put<void>(`/product-spus/${id}`, b);
export const apiSpuDelete = (id: Id) => http.del<void>(`/product-spus/${id}`);
