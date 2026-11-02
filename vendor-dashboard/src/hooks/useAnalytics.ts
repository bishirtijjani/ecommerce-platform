import { useQuery } from '@tanstack/react-query';
import { getSalesSummary, getOrderHistory } from '../api/vendor';
import { useAuthStore } from '../store/authStore';

const useVendorId = () => useAuthStore((s) => s.user?.vendorId) as string;

export const useSalesSummary = (period: '7d' | '30d' | '90d') => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ['sales-summary', vendorId, period],
    queryFn: () => getSalesSummary(vendorId, period),
    enabled: !!vendorId,
  });
};

export const useOrderHistory = (params: { page?: number; limit?: number; startDate?: string; endDate?: string }) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ['order-history', vendorId, params],
    queryFn: () => getOrderHistory(vendorId, params),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};
