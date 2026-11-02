import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  setCampaignStatus,
  deleteCampaign,
  listDiscounts,
  approveDiscount,
  rejectDiscount,
  listHighlights,
  setHighlightStatus,
  deleteHighlight,
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  type CampaignInput,
  type DiscountListParams,
  type HighlightListParams,
  type BannerInput,
} from '../api/marketing';
import type { ApiError } from '../api/client';
import type { CampaignStatus } from '../types';

export const useCampaigns = (page: number, limit = 20) =>
  useQuery({
    queryKey: ['admin', 'marketing', 'campaigns', page, limit],
    queryFn: ({ signal }) => listCampaigns(page, limit, signal),
    placeholderData: (prev) => prev,
  });

const invalidateCampaigns = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'campaigns'] });
};

export const useCreateCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      invalidateCampaigns(qc);
      toast.success('Campaign created');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCampaign>[1] }) => updateCampaign(id, data),
    onSuccess: () => {
      invalidateCampaigns(qc);
      toast.success('Campaign updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useSetCampaignStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatus }) => setCampaignStatus(id, status),
    onSuccess: () => {
      invalidateCampaigns(qc);
      toast.success('Campaign status updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeleteCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      invalidateCampaigns(qc);
      toast.success('Campaign deleted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDiscounts = (params: DiscountListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'marketing', 'discounts', params],
    queryFn: ({ signal }) => listDiscounts(params, signal),
    placeholderData: (prev) => prev,
  });

const invalidateDiscounts = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'discounts'] });
};

export const useApproveDiscount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveDiscount,
    onSuccess: () => {
      invalidateDiscounts(qc);
      toast.success('Discount approved');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useRejectDiscount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rejectDiscount,
    onSuccess: () => {
      invalidateDiscounts(qc);
      toast.success('Discount rejected');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useHighlights = (params: HighlightListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'marketing', 'highlights', params],
    queryFn: ({ signal }) => listHighlights(params, signal),
    placeholderData: (prev) => prev,
  });

const invalidateHighlights = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'highlights'] });
};

export const useSetHighlightStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setHighlightStatus(id, isActive),
    onSuccess: (_, vars) => {
      invalidateHighlights(qc);
      toast.success(vars.isActive ? 'Highlight activated' : 'Highlight deactivated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeleteHighlight = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteHighlight,
    onSuccess: () => {
      invalidateHighlights(qc);
      toast.success('Highlight deleted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useBanners = () =>
  useQuery({
    queryKey: ['admin', 'marketing', 'banners'],
    queryFn: ({ signal }) => listBanners(signal),
  });

const invalidateBanners = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['admin', 'marketing', 'banners'] });
};

export const useCreateBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBanner,
    onSuccess: () => {
      invalidateBanners(qc);
      toast.success('Banner created');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useUpdateBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateBanner>[1] }) => updateBanner(id, data),
    onSuccess: () => {
      invalidateBanners(qc);
      toast.success('Banner updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeleteBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      invalidateBanners(qc);
      toast.success('Banner deleted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export type { CampaignInput, BannerInput };