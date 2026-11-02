import api from './client';
import type {
  DashboardStats,
  RevenueAnalytics,
  RawRevenueAnalytics,
  OrderAnalytics,
  RawOrderAnalytics,
  CustomerAnalytics,
  RawCustomerAnalytics,
} from '../types';

const mapRevenue = (raw: RawRevenueAnalytics): RevenueAnalytics => ({
  totalRevenue: raw.totalRevenue,
  totalOrders: raw.totalOrders,
  topVendors: raw.topVendors.map((v) => ({
    id: v.vendorId,
    name: '-',
    revenue: v._sum.total ?? 0,
    orders: v._count ?? 0,
  })),
  revenueTrend: raw.revenueTrend,
});

const mapOrders = (raw: RawOrderAnalytics): OrderAnalytics => ({
  totalOrders: raw.totalOrders,
  ordersByStatus: raw.ordersByStatus.map((s) => ({
    status: s.status,
    count: s._count.status,
  })),
  cancellationRate: Number(raw.cancellationRate.toFixed(2)),
});

const mapCustomers = (raw: RawCustomerAnalytics): CustomerAnalytics => ({
  totalCustomers: raw.totalCustomers,
  newCustomers: raw.newCustomers,
  topCustomers: raw.topCustomers.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    orders: c.orderCount,
  })),
});

export interface AnalyticsParams {
  startDate?: string;
  endDate?: string;
  signal?: AbortSignal;
}

export const getDashboardStats = (signal?: AbortSignal) =>
  api
    .get<DashboardStats>('/admin/dashboard', { signal })
    .then((r) => r.data);

export const getRevenueAnalytics = ({ startDate, endDate, signal }: AnalyticsParams = {}) =>
  api
    .get<RawRevenueAnalytics>('/admin/analytics/revenue', { params: { startDate, endDate }, signal })
    .then((r) => mapRevenue(r.data));

export const getOrderAnalytics = ({ startDate, endDate, signal }: AnalyticsParams = {}) =>
  api
    .get<RawOrderAnalytics>('/admin/analytics/orders', { params: { startDate, endDate }, signal })
    .then((r) => mapOrders(r.data));

export const getCustomerAnalytics = ({ startDate, endDate, signal }: AnalyticsParams = {}) =>
  api
    .get<RawCustomerAnalytics>('/admin/analytics/customers', { params: { startDate, endDate }, signal })
    .then((r) => mapCustomers(r.data));
