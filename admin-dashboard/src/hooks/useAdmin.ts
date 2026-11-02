import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getRevenueAnalytics, getOrderAnalytics, getCustomerAnalytics } from '../api/admin';

export const useDashboardStats = () =>
  useQuery({ queryKey: ['admin', 'dashboard'], queryFn: ({ signal }) => getDashboardStats(signal) });

export const useRevenueAnalytics = (params?: { startDate?: string; endDate?: string }) =>
  useQuery({
    queryKey: ['admin', 'analytics', 'revenue', params],
    queryFn: ({ signal }) => getRevenueAnalytics({ ...params, signal }),
    staleTime: 5 * 60 * 1000,
  });

export const useOrderAnalytics = (params?: { startDate?: string; endDate?: string }) =>
  useQuery({
    queryKey: ['admin', 'analytics', 'orders', params],
    queryFn: ({ signal }) => getOrderAnalytics({ ...params, signal }),
    staleTime: 5 * 60 * 1000,
  });

export const useCustomerAnalytics = (params?: { startDate?: string; endDate?: string }) =>
  useQuery({
    queryKey: ['admin', 'analytics', 'customers', params],
    queryFn: ({ signal }) => getCustomerAnalytics({ ...params, signal }),
    staleTime: 5 * 60 * 1000,
  });
