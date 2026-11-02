import api from './client';
import type { ApiResponse } from './client';
import type { RequestDetail, RequestRow } from '../types';

export interface RequestListParams {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface RequestListResult {
  items: RequestRow[];
  page: number;
  limit: number;
  total: number;
}

export const listRequests = (params: RequestListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<RequestListResult>>('/admin/requests', { params, signal }).then((r) => r.data);

export const getRequest = (id: string, signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<RequestDetail>>(`/admin/requests/${id}`, { signal }).then((r) => r.data);

export const deleteRequest = (id: string) =>
  api.delete<unknown, ApiResponse<{ id: string; deleted: boolean }>>(`/admin/requests/${id}`).then((r) => r.data);
