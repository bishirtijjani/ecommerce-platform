import api from './client';
import type { ApiResponse } from './client';

/** A global category annotated with its Home-grid state. */
export interface HomeCategory {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  featured: boolean;
  homePosition: number | null;
  _count?: { products: number; subcategories: number };
}

export interface HomeCategoriesResult {
  categories: HomeCategory[];
  featuredIds: string[];
}

export interface HomeCategoryItem {
  id: string;
  featured: boolean;
}

export const getHomeCategories = (signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<HomeCategoriesResult>>('/admin/home/categories', { signal }).then((r) => r.data);

export const updateHomeCategories = (items: HomeCategoryItem[]) =>
  api
    .put<unknown, ApiResponse<{ updated: number; items: HomeCategoryItem[] }>>('/admin/home/categories', { items })
    .then((r) => r.data);
