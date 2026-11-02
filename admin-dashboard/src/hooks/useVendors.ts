import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listVendors,
  getVendor,
  getVendorStatusCounts,
  approveVendor,
  rejectVendor,
  suspendVendor,
  unsuspendVendor,
  updateVendorTags,
  updateVendorProfile,
  type VendorListParams,
  type VendorProfileInput,
} from '../api/vendors';
import type { ApiError } from '../api/client';

export const useVendors = (params: VendorListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'vendors', params],
    queryFn: ({ signal }) => listVendors(params, signal),
    placeholderData: (prev) => prev,
  });

export const useVendorStatusCounts = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: ['admin', 'vendors', 'status-counts'],
    queryFn: ({ signal }) => getVendorStatusCounts(signal),
    refetchInterval: 60_000,
    enabled,
  });

export const useVendor = (id: string) =>
  useQuery({ queryKey: ['admin', 'vendors', id], queryFn: ({ signal }) => getVendor(id, signal), enabled: !!id });

export const useApproveVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveVendor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Vendor approved');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useRejectVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectVendor(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Vendor rejected');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useSuspendVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => suspendVendor(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Vendor suspended');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUnsuspendVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unsuspendVendor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Vendor unsuspended');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateVendorTags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tagIds }: { id: string; tagIds: string[] }) => updateVendorTags(id, tagIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      toast.success('Vendor tags updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateVendorProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorProfileInput }) => updateVendorProfile(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'vendors'] });
      qc.invalidateQueries({ queryKey: ['admin', 'vendors', vars.id] });
      toast.success('Vendor profile updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
