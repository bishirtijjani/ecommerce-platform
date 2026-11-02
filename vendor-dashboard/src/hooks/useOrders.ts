import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import {
  getVendorOrders, getOrderById, acceptOrder, rejectOrder, updateOrderStatus,
  listOrderMessages, postOrderMessage, logVendorOrder, type LogOrderInput,
} from '../api/vendor';
import { useAuthStore } from '../store/authStore';
import type { ApiError } from '../api/client';

const useVendorId = () => useAuthStore((s) => s.user?.vendorId) as string;

export const useVendorOrders = (params: { status?: string; page?: number; limit?: number }) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ['orders', vendorId, params],
    queryFn: () => getVendorOrders(vendorId, params),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useOrder = (orderId: string | undefined) =>
  useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrderById(orderId as string),
    enabled: !!orderId,
  });

const invalidateOrders = (qc: ReturnType<typeof useQueryClient>, orderId?: string) => {
  qc.invalidateQueries({ queryKey: ['orders'] });
  qc.invalidateQueries({ queryKey: ['sales-summary'] });
  if (orderId) qc.invalidateQueries({ queryKey: ['order', orderId] });
};

export const useAcceptOrder = (orderId: string) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => acceptOrder(vendorId, orderId),
    onSuccess: () => {
      invalidateOrders(qc, orderId);
      toast.success(i18n.t('toasts.orderAccepted'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useRejectOrder = (orderId: string) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => rejectOrder(vendorId, orderId, reason),
    onSuccess: () => {
      invalidateOrders(qc, orderId);
      toast.success(i18n.t('toasts.orderRejected'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateOrderStatus = (orderId: string) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, trackingNumber }: { status: 'SHIPPED' | 'DELIVERED'; trackingNumber?: string }) =>
      updateOrderStatus(vendorId, orderId, status, trackingNumber),
    onSuccess: (_data, vars) => {
      invalidateOrders(qc, orderId);
      toast.success(i18n.t(vars.status === 'SHIPPED' ? 'toasts.orderShipped' : 'toasts.orderDelivered'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useOrderMessages = (orderId: string | undefined) =>
  useQuery({
    queryKey: ['order-messages', orderId],
    queryFn: () => listOrderMessages(orderId as string),
    enabled: !!orderId,
    refetchInterval: 8000,
  });

export const usePostOrderMessage = (orderId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => postOrderMessage(orderId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order-messages', orderId] }),
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useLogOrder = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogOrderInput) => logVendorOrder(vendorId, input),
    onSuccess: () => {
      invalidateOrders(qc);
      toast.success(i18n.t('toasts.orderLogged'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
