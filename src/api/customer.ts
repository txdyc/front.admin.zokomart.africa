import { http } from '@/utils/request';
import type { PageResult } from '@/types/api';
import type { CustomerVO, CustomerQuery } from '@/types/customer';

export const apiCustomerPage = (q: CustomerQuery) =>
  http.get<PageResult<CustomerVO>>('/customers', q);
