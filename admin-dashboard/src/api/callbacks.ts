import api from './client';
import type { Paginated, CallbackRequest } from '../types';

export interface CallbackListParams {
  page?: number;
  limit?: number;
  search?: string;
  vendorId?: string;
}

export const listCallbacks = (params: CallbackListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<CallbackRequest>>('/admin/callbacks', { params, signal }).then((r) => r);