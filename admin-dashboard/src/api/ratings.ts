import api from './client';
import type { ApiResponse } from './client';
import type { Paginated, Rating } from '../types';

export interface RatingListParams {
  page?: number;
  limit?: number;
  search?: string;
  score?: number;
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
}

export const listRatings = (params: RatingListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<Rating>>('/admin/ratings', { params, signal }).then((r) => r);

export const deleteRating = (id: string) =>
  api.delete<unknown, ApiResponse<{ success: boolean }>>(`/admin/ratings/${id}`).then((r) => r.data);