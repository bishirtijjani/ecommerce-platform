import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listCustomers,
  getCustomerStats,
  getCustomer,
  getCustomerOrders,
  updateCustomerStatus,
  updateCustomer,
  wipeCustomerKyc,
  type CustomerListParams,
} from '../api/customers';
import type { ApiError } from '../api/client';
import type { CustomerStatus, OrderStatus } from '../types';

export const useCustomers = (params: CustomerListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'customers', params],
    queryFn: ({ signal }) => listCustomers(params, signal),
    placeholderData: (prev) => prev,
  });

export const useCustomerStats = () =>
  useQuery({ queryKey: ['admin', 'customers', 'stats'], queryFn: ({ signal }) => getCustomerStats(signal) });

export const useCustomer = (id: string) =>
  useQuery({ queryKey: ['admin', 'customers', id], queryFn: ({ signal }) => getCustomer(id, signal), enabled: !!id });

export const useCustomerOrders = (
  id: string,
  params: { page?: number; limit?: number; status?: OrderStatus } = {},
) =>
  useQuery({
    queryKey: ['admin', 'customers', id, 'orders', params],
    queryFn: ({ signal }) => getCustomerOrders(id, params, signal),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });

export const useUpdateCustomerStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: CustomerStatus; reason?: string }) =>
      updateCustomerStatus(id, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
      toast.success('Customer status updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCustomer>[1] }) =>
      updateCustomer(id, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'customers', vars.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
      toast.success('Customer updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useWipeCustomerKyc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => wipeCustomerKyc(id, reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'customers', vars.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
      toast.success('Customer KYC reset');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
