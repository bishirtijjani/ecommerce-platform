import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import {
  getVendorTaxonomy,
  createOwnCategory,
  updateCategoryMeta,
  deleteOwnCategory,
  createOwnSubcategory,
  updateSubcategoryMeta,
  deleteOwnSubcategory,
} from '../api/vendor';
import { useAuthStore } from '../store/authStore';
import type { CreateCategoryInput, TaxonomyCategory, UpdateCategoryInput } from '../types';

export const SHOP_CATEGORIES_QUERY_KEY = ['vendor-taxonomy'];

export const useShopCategories = (vendorId?: string) => {
  const qc = useQueryClient();
  const myVendorId = useAuthStore((s) => s.user?.vendorId) as string | undefined;
  const id = vendorId ?? myVendorId;
  const enabled = !!id;

  const list = useQuery({
    queryKey: [...SHOP_CATEGORIES_QUERY_KEY, id],
    queryFn: () => getVendorTaxonomy(id as string),
    enabled,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [...SHOP_CATEGORIES_QUERY_KEY, id] });
  const invalidateShop = () => qc.invalidateQueries({ queryKey: ['vendor-profile'] });

  const add = useMutation({
    mutationFn: (input: CreateCategoryInput) => createOwnCategory(id as string, input),
    onSuccess: () => {
      invalidate();
      invalidateShop();
      toast.success(i18n.t('toasts.categoryCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const edit = useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: UpdateCategoryInput }) =>
      updateCategoryMeta(id as string, categoryId, input),
    onSuccess: () => {
      invalidate();
      invalidateShop();
      toast.success(i18n.t('toasts.categoryUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (categoryId: string) => deleteOwnCategory(id as string, categoryId),
    onSuccess: () => {
      invalidate();
      invalidateShop();
      toast.success(i18n.t('toasts.categoryRemoved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Subcategories (this vendor's own additions under any category) ────────
  // Subcategories come embedded in each category's `subcategories[]` from the
  // taxonomy list query; mutations just invalidate that list.

  const addSub = useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: CreateCategoryInput }) =>
      createOwnSubcategory(id as string, categoryId, input),
    onSuccess: () => {
      invalidate();
      invalidateShop();
      toast.success(i18n.t('toasts.subcategoryAdded'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editSub = useMutation({
    mutationFn: ({ categoryId, subcategoryId, input }: { categoryId: string; subcategoryId: string; input: UpdateCategoryInput }) =>
      updateSubcategoryMeta(id as string, categoryId, subcategoryId, input),
    onSuccess: () => {
      invalidate();
      invalidateShop();
      toast.success(i18n.t('toasts.subcategoryUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeSub = useMutation({
    mutationFn: ({ categoryId, subcategoryId }: { categoryId: string; subcategoryId: string }) =>
      deleteOwnSubcategory(id as string, categoryId, subcategoryId),
    onSuccess: () => {
      invalidate();
      invalidateShop();
      toast.success(i18n.t('toasts.subcategoryRemoved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    categories: list.data ?? new Array<TaxonomyCategory>(),
    isLoading: list.isLoading,
    refetch: list.refetch,
    add,
    edit,
    remove,
    addSub,
    editSub,
    removeSub,
  };
};