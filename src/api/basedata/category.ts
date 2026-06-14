import { http } from '@/utils/request';
import type { Id } from '@/types/api';
import type { CategoryVO, CategorySaveDTO } from '@/types/basedata';

// 分类为树形，读取统一走 /tree（无平铺分页）
export const apiCategoryTree = () => http.get<CategoryVO[]>('/categories/tree');
export const apiCategoryCreate = (b: CategorySaveDTO) => http.post<Id>('/categories', b);
export const apiCategoryUpdate = (id: Id, b: CategorySaveDTO) =>
  http.put<void>(`/categories/${id}`, b);
export const apiCategoryDelete = (id: Id) => http.del<void>(`/categories/${id}`);
