import { http } from '@/utils/request';
import type { Id } from '@/types/api';
import type { ProductSkuVO, ProductSkuSaveDTO } from '@/types/product';

// SKU 列表按 SPU 维度读取（见 spu.ts 的 apiSpuSkus），此处仅明细与增删改。
export const apiSkuGet = (id: Id) => http.get<ProductSkuVO>(`/product-skus/${id}`);
export const apiSkuCreate = (b: ProductSkuSaveDTO) => http.post<Id>('/product-skus', b);
export const apiSkuUpdate = (id: Id, b: ProductSkuSaveDTO) =>
  http.put<void>(`/product-skus/${id}`, b);
export const apiSkuDelete = (id: Id) => http.del<void>(`/product-skus/${id}`);
