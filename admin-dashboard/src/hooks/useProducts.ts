import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listProducts,
  toggleProductAvailability,
  deleteProduct,
  createProduct,
  updateProduct,
  type ProductListParams,
  type ProductCreateInput,
  type ProductUpdateInput,
} from '../api/products';
import type { ApiError } from '../api/client';
import type { Paginated, Product } from '../types';

export const useProducts = (params: ProductListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: ({ signal }) => listProducts(params, signal),
    placeholderData: (prev) => prev,
  });

export const useToggleProductAvailability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      vendorId,
      productId,
      isAvailable,
    }: {
      vendorId: string;
      productId: string;
      isAvailable: boolean;
    }) => toggleProductAvailability(vendorId, productId, isAvailable),
    onMutate: async ({ productId, isAvailable }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'products'] });
      const previous = qc.getQueriesData<Paginated<Product>>({ queryKey: ['admin', 'products'] });
      qc.setQueriesData<Paginated<Product>>({ queryKey: ['admin', 'products'] }, (old) =>
        old?.data
          ? { ...old, data: old.data.map((p) => (p.id === productId ? { ...p, isAvailable } : p)) }
          : old,
      );
      return { previous };
    },
    onError: (err: ApiError, _vars, ctx) => {
      ctx?.previous.forEach(([key, value]) => qc.setQueryData(key, value));
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
    },
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      vendorId,
      productId,
      data,
    }: {
      vendorId: string;
      productId: string;
      data: ProductUpdateInput;
    }) => updateProduct(vendorId, productId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Product updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vendorId, data }: { vendorId: string; data: ProductCreateInput }) =>
      createProduct(vendorId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Product created');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vendorId, productId }: { vendorId: string; productId: string }) => deleteProduct(vendorId, productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Product deleted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};