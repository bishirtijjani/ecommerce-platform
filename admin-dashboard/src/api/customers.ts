import api from './client';
import type { ApiResponse } from './client';
import type {
  Customer,
  CustomerDetail,
  CustomerStatus,
  KycStatus,
  Order,
  OrderStatus,
  Paginated,
  CustomerStats,
} from '../types';

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CustomerStatus;
  kycStatus?: KycStatus;
}

export interface CustomerUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  lga?: string;
  dateOfBirth?: string;
  kycStatus?: KycStatus;
  status?: CustomerStatus;
  reason?: string;
}

export const listCustomers = (params: CustomerListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<Customer>>('/admin/customers', { params, signal }).then((r) => r);

export const getCustomerStats = (signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<CustomerStats>>('/admin/customers/stats', { signal }).then((r) => r.data);

export const getCustomer = (id: string, signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<CustomerDetail>>(`/admin/customers/${id}`, { signal }).then((r) => r.data);

export const getCustomerOrders = (
  id: string,
  params: { page?: number; limit?: number; status?: OrderStatus } = {},
  signal?: AbortSignal,
) => api.get<unknown, Paginated<Order>>(`/admin/customers/${id}/orders`, { params, signal }).then((r) => r);

export const updateCustomerStatus = (id: string, status: CustomerStatus, reason?: string) =>
  api
    .patch<unknown, ApiResponse<Customer>>(`/admin/customers/${id}/status`, {
      status,
      reason: reason?.trim() ? reason.trim() : undefined,
    })
    .then((r) => r.data);

export const updateCustomer = (id: string, input: CustomerUpdateInput) =>
  api.patch<unknown, ApiResponse<Customer>>(`/admin/customers/${id}`, input).then((r) => r.data);

export const wipeCustomerKyc = (id: string, reason: string) =>
  api.post<unknown, ApiResponse<Customer>>(`/admin/customers/${id}/wipe-kyc`, { reason }).then((r) => r.data);
