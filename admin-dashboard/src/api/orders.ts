import api from './client';
import type { ApiResponse } from './client';
import type { Order, OrderStatus, OrderSource, Paginated, OrderStats } from '../types';

export interface OrderListParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  categorySlug?: string;
  source?: OrderSource;
}

export const listOrders = (params: OrderListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<Order>>('/admin/orders', { params, signal }).then((r) => r);

export const getOrderStats = (signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<OrderStats>>('/admin/orders/stats', { signal }).then((r) => r.data);

export const getOrder = (id: string, signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<Order>>(`/admin/orders/${id}`, { signal }).then((r) => r.data);

export const cancelOrder = (id: string, reason: string) =>
  api.patch<unknown, ApiResponse<Order>>(`/admin/orders/${id}/cancel`, { reason }).then((r) => r.data);

export const updateOrderStatus = (id: string, status: OrderStatus, reason?: string) =>
  api.patch<unknown, ApiResponse<Order>>(`/admin/orders/${id}/status`, { status, reason }).then((r) => r.data);
