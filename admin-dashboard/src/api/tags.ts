import api from './client';
import type { ApiResponse } from './client';
import type { Tag, Paginated } from '../types';

export interface TagListParams {
  page?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
}

export interface TagInput {
  name: string;
  category?: string;
  color?: string;
  icon?: string;
}

export const listTags = (params: TagListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<Tag>>('/admin/tags', { params, signal }).then((r) => r);

export const createTag = (data: TagInput) =>
  api.post<unknown, ApiResponse<Tag>>('/admin/tags', data).then((r) => r.data);

export const updateTag = (id: string, data: Partial<TagInput> & { isActive?: boolean }) =>
  api.put<unknown, ApiResponse<Tag>>(`/admin/tags/${id}`, data).then((r) => r.data);

export const deleteTag = (id: string) =>
  api.delete<unknown, ApiResponse<Tag>>(`/admin/tags/${id}`).then((r) => r.data);
