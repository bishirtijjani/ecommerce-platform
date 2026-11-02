import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import {
  getVendorProducts, getVendorProductById, createProduct, updateProduct, deleteProduct,
  toggleProductAvailability, type ProductInput,
} from '../api/vendor';
import { useAuthStore } from '../store/authStore';
import type { ApiError } from '../api/client';

const useVendorId = () => useAuthStore((s) => s.user?.vendorId) as string;

export const useVendorProducts = (params: { page?: number; limit?: number } = {}) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ['products', vendorId, params],
    queryFn: () => getVendorProducts(vendorId, { limit: 100, ...params }),
    enabled: !!vendorId,
    placeholderData: (prev) => prev,
  });
};

export const useProduct = (productId: string | undefined) => {
  const vendorId = useVendorId();
  return useQuery({
    queryKey: ['product', vendorId, productId],
    queryFn: () => getVendorProductById(vendorId, productId as string),
    enabled: !!vendorId && !!productId,
  });
};

export const useCreateProduct = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(vendorId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(i18n.t('toasts.productCreated'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateProduct = (productId: string) => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProductInput>) => updateProduct(vendorId, productId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product', vendorId, productId] });
      toast.success(i18n.t('toasts.productUpdated'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeleteProduct = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => deleteProduct(vendorId, productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(i18n.t('toasts.productDeleted'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useToggleProductAvailability = () => {
  const vendorId = useVendorId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isAvailable }: { productId: string; isAvailable: boolean }) =>
      toggleProductAvailability(vendorId, productId, isAvailable),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (err: ApiError) => toast.error(err.message),
  });
};
