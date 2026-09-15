import { http } from '@/utils/request';
import type { PageResult, Id } from '@/types/api';
import type {
  SalesOrderVO,
  SalesOrderCreateDTO,
  SalesOrderQuery,
  SalesOrderLabelVO,
  OrderableProductVO,
  OrderableProductQuery,
  SalesOrderImportResult,
} from '@/types/sales';

export const apiSalesOrderCreate = (dto: SalesOrderCreateDTO) =>
  http.post<Id>('/sales-orders', dto);
export const apiSalesOrderPage = (q: SalesOrderQuery) =>
  http.get<PageResult<SalesOrderVO>>('/sales-orders', q);
export const apiSalesOrderGet = (id: Id) => http.get<SalesOrderVO>(`/sales-orders/${id}`);

export const apiSalesOrderLabels = (params: { status?: string; date?: string } = {}) =>
  http.get<SalesOrderLabelVO[]>('/sales-orders/labels', params);

// 可下单产品分页：supplier_product LEFT JOIN inventory_stock，库存为 0/负亦可下单（欠货）
export const apiOrderableProductsPage = (q: OrderableProductQuery) =>
  http.get<PageResult<OrderableProductVO>>('/sales-orders/orderable-products', q);

// 导入订单：multipart/form-data，字段名 file；后端按客户+日期归并成订单
export const apiSalesOrderImport = (form: FormData) =>
  http.post<SalesOrderImportResult>('/sales-orders/import', form);
