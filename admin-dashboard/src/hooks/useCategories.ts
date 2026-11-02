import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryAttributeSchema,
  reorderCategories,
  reorderSubcategories,
  listSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  type CategoryListParams,
  type SubcategoryListParams,
  type ReorderItem,
} from '../api/categories';
import type { ApiError } from '../api/client';
import type { CategoryAttributeSchema, Paginated, VendorCategory } from '../types';

export const useCategories = (params: CategoryListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'categories', params],
    queryFn: ({ signal }) => listCategories(params, signal),
    placeholderData: (prev) => prev,
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Category created');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCategory>[1] }) => updateCategory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Category updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success(
        result.soft
          ? `Category deactivated${result.productCount ? ` · ${result.productCount} products kept` : ''}`
          : 'Category deleted',
      );
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useReorderCategories = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) => reorderCategories(items),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ['admin', 'categories'] });
      const previous = qc.getQueriesData<Paginated<VendorCategory>>({ queryKey: ['admin', 'categories'] });
      const order = new Map(items.map((item, index) => [item.id, item.sortOrder ?? index]));
      qc.setQueriesData<Paginated<VendorCategory>>({ queryKey: ['admin', 'categories'] }, (old) => {
        if (!old?.data) return old;
        const data = old.data
          .map((c) => (order.has(c.id) ? { ...c, sortOrder: order.get(c.id) as number } : c))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        return { ...old, data };
      });
      return { previous };
    },
    onError: (err: ApiError, _items, ctx) => {
      ctx?.previous.forEach(([key, value]) => qc.setQueryData(key, value));
      toast.error(err.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
};

export const useReorderSubcategories = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, items }: { categoryId: string; items: ReorderItem[] }) =>
      reorderSubcategories(categoryId, items),
    onMutate: async ({ categoryId, items }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'categories'] });
      const previous = qc.getQueriesData<Paginated<VendorCategory>>({ queryKey: ['admin', 'categories'] });
      const order = new Map(items.map((item, index) => [item.id, item.sortOrder ?? index]));
      qc.setQueriesData<Paginated<VendorCategory>>({ queryKey: ['admin', 'categories'] }, (old) => {
        if (!old?.data) return old;
        const data = old.data.map((c) => {
          if (c.id !== categoryId || !c.subcategories) return c;
          const subcategories = c.subcategories
            .map((s) => (order.has(s.id) ? { ...s, sortOrder: order.get(s.id) as number } : s))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
          return { ...c, subcategories };
        });
        return { ...old, data };
      });
      return { previous };
    },
    onError: (err: ApiError, _vars, ctx) => {
      ctx?.previous.forEach(([key, value]) => qc.setQueryData(key, value));
      toast.error(err.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
};

export const useUpdateCategoryAttributeSchema = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, attributeSchema }: { id: string; attributeSchema: CategoryAttributeSchema | null }) =>
      updateCategoryAttributeSchema(id, attributeSchema),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      qc.invalidateQueries({ queryKey: ['admin', 'categories', vars.id] });
      toast.success('Attribute schema updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useSubcategories = (categoryId: string, params: SubcategoryListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'categories', categoryId, 'subcategories', params],
    queryFn: ({ signal }) => listSubcategories(categoryId, params, signal),
    enabled: !!categoryId,
    placeholderData: (prev) => prev,
  });

export const useCreateSubcategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: Parameters<typeof createSubcategory>[1] }) =>
      createSubcategory(categoryId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories', vars.categoryId, 'subcategories'] });
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Subcategory created');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateSubcategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, subcategoryId, data }: { categoryId: string; subcategoryId: string; data: Parameters<typeof updateSubcategory>[2] }) =>
      updateSubcategory(categoryId, subcategoryId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories', vars.categoryId, 'subcategories'] });
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Subcategory updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeleteSubcategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, subcategoryId, unfile }: { categoryId: string; subcategoryId: string; unfile?: boolean }) =>
      deleteSubcategory(categoryId, subcategoryId, { unfile }),
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories', vars.categoryId, 'subcategories'] });
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success(
        result.unfiledProducts
          ? `Subcategory deleted · ${result.unfiledProducts} product${result.unfiledProducts === 1 ? '' : 's'} unfiled`
          : 'Subcategory deleted',
      );
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
