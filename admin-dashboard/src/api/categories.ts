import api from './client';
import type { ApiResponse } from './client';
import type { VendorCategory, Paginated, CategoryAttributeSchema, Subcategory } from '../types';

export interface CategoryListParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
}

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  imageUrl?: string | null;
  sortOrder?: number;
  hasPreparation?: boolean;
  attributeSchema?: CategoryAttributeSchema;
}

export const listCategories = (params: CategoryListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<VendorCategory>>('/admin/categories', { params, signal }).then((r) => r);

export const createCategory = (data: CategoryInput) =>
  api.post<unknown, ApiResponse<VendorCategory>>('/admin/categories', data).then((r) => r.data);

export const updateCategory = (id: string, data: Partial<CategoryInput> & { isActive?: boolean }) =>
  api.put<unknown, ApiResponse<VendorCategory>>(`/admin/categories/${id}`, data).then((r) => r.data);

export const deleteCategory = (id: string) =>
  api.delete<unknown, ApiResponse<DeleteCategoryResult>>(`/admin/categories/${id}`).then((r) => r.data);

export interface DeleteCategoryResult {
  /** true = deactivated in place (still referenced); false = permanently deleted. */
  soft: boolean;
  vendorCount: number;
  productCount: number;
  category?: VendorCategory;
}

export interface ReorderItem {
  id: string;
  sortOrder: number;
}

export const reorderCategories = (items: ReorderItem[]) =>
  api.patch<unknown, ApiResponse<{ updated: number }>>('/admin/categories/reorder', { items }).then((r) => r.data);

export const reorderSubcategories = (categoryId: string, items: ReorderItem[]) =>
  api
    .patch<unknown, ApiResponse<{ updated: number }>>(`/admin/categories/${categoryId}/subcategories/reorder`, { items })
    .then((r) => r.data);

export const updateCategoryAttributeSchema = (id: string, attributeSchema: CategoryAttributeSchema | null) =>
  api
    .patch<unknown, ApiResponse<VendorCategory>>(`/admin/categories/${id}/attribute-schema`, { attributeSchema })
    .then((r) => r.data);

export interface SubcategoryListParams {
  page?: number;
  limit?: number;
  scope?: 'global' | 'all';
}

export interface SubcategoryInput {
  name: string;
  imageUrl?: string | null;
  sortOrder?: number;
}

export const listSubcategories = (categoryId: string, params: SubcategoryListParams = {}, signal?: AbortSignal) =>
  api
    .get<unknown, Paginated<Subcategory>>(`/admin/categories/${categoryId}/subcategories`, { params, signal })
    .then((r) => r);

export const createSubcategory = (categoryId: string, data: SubcategoryInput) =>
  api
    .post<unknown, ApiResponse<Subcategory>>(`/admin/categories/${categoryId}/subcategories`, data)
    .then((r) => r.data);

export const updateSubcategory = (categoryId: string, subcategoryId: string, data: Partial<SubcategoryInput> & { isActive?: boolean }) =>
  api
    .put<unknown, ApiResponse<Subcategory>>(`/admin/categories/${categoryId}/subcategories/${subcategoryId}`, data)
    .then((r) => r.data);

export const deleteSubcategory = (categoryId: string, subcategoryId: string, options: { unfile?: boolean } = {}) =>
  api
    .delete<unknown, ApiResponse<{ success: boolean; unfiledProducts?: number }>>(
      `/admin/categories/${categoryId}/subcategories/${subcategoryId}`,
      { params: options.unfile ? { unfile: true } : undefined },
    )
    .then((r) => r.data);
