import api from './client';
import type { ApiResponse } from './client';
import type { Paginated, Product, ProductCondition } from '../types';

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  vendorId?: string;
  categoryId?: string;
  isAvailable?: boolean;
  condition?: ProductCondition;
}

export const listProducts = (params: ProductListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<Product>>('/admin/products', { params, signal }).then((r) => r);

export const toggleProductAvailability = (vendorId: string, productId: string, isAvailable: boolean) =>
  api
    .patch<unknown, ApiResponse<Product>>(`/vendors/vendor/${vendorId}/products/${productId}/availability`, {
      isAvailable,
    })
    .then((r) => r.data);

export const deleteProduct = (vendorId: string, productId: string) =>
  api.delete<unknown, ApiResponse<{ success: boolean }>>(`/vendors/vendor/${vendorId}/products/${productId}`).then((r) => r.data);

export interface ProductCreateInput {
  name: string;
  description?: string;
  basePrice: number;
  stock?: number;
  categoryId: string;
  subcategoryId?: string | null;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  isAvailable?: boolean;
  condition?: ProductCondition;
}

export const createProduct = (vendorId: string, data: ProductCreateInput) =>
  api.post<unknown, ApiResponse<Product>>(`/vendors/vendor/${vendorId}/products`, data).then((r) => r.data);

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  basePrice?: number;
  stock?: number;
  categoryId?: string;
  subcategoryId?: string | null;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  isAvailable?: boolean;
  condition?: ProductCondition;
}

export const updateProduct = (vendorId: string, productId: string, data: ProductUpdateInput) =>
  api.put<unknown, ApiResponse<Product>>(`/vendors/vendor/${vendorId}/products/${productId}`, data).then((r) => r.data);