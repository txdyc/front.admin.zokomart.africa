import { http } from '@/utils/request';
import type { Id } from '@/types/api';
import type { SupplierBrandVO } from '@/types/basedata';

export const apiAuthorizedBrands = (supplierId: Id) =>
  http.get<SupplierBrandVO[]>(`/suppliers/${supplierId}/authorized-brands`);

export const apiAssignBrands = (supplierId: Id, brandIds: Id[]) =>
  http.put<void>(`/suppliers/${supplierId}/authorized-brands`, { brandIds });
