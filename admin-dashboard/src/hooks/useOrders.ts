import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listOrders, getOrderStats, getOrder, cancelOrder, updateOrderStatus, type OrderListParams } from '../api/orders';
import type { ApiError } from '../api/client';
import type { OrderStatus } from '../types';

export const useOrders = (params: OrderListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: ({ signal }) => listOrders(params, signal),
    placeholderData: (prev) => prev,
  });

export const useOrderStats = () =>
  useQuery({ queryKey: ['admin', 'orders', 'stats'], queryFn: ({ signal }) => getOrderStats(signal) });

export const useOrder = (id: string) =>
  useQuery({ queryKey: ['admin', 'orders', id], queryFn: ({ signal }) => getOrder(id, signal), enabled: !!id });

export const useCancelOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelOrder(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Order cancelled');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: OrderStatus; reason?: string }) =>
      updateOrderStatus(id, status, reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success(`Order status updated to ${vars.status}`);
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
