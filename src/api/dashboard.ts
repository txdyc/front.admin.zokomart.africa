import { http } from '@/utils/request';
import type { DashboardOverviewVO, DailyTrendVO } from '@/types/dashboard';

export interface DashboardRangeQuery {
  from?: string; // ISO date, e.g. 2026-07-01
  to?: string;
}

// CEO 经营概览：区间缺省为最近 30 天（后端计算）。
export const apiDashboardOverview = (params: DashboardRangeQuery = {}) =>
  http.get<DashboardOverviewVO>('/dashboard/overview', params);

// 每日销售趋势。
export const apiDashboardSalesTrend = (params: DashboardRangeQuery = {}) =>
  http.get<DailyTrendVO[]>('/dashboard/sales-trend', params);
