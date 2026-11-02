import api from './client';
import type { ApiResponse } from './client';
import type { Paginated, PlatformCampaign, DiscountCode, Highlight, Banner, CampaignStatus } from '../types';

// ============================================================
// Campaigns
// ============================================================

export interface CampaignInput {
  name: string;
  type?: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number;
  targetAudience?: string;
  status?: CampaignStatus;
}

export const listCampaigns = (page: number, limit = 20, signal?: AbortSignal) =>
  api.get<unknown, Paginated<PlatformCampaign>>('/admin/marketing/campaigns', { params: { page, limit }, signal }).then((r) => r);

export const createCampaign = (data: CampaignInput) =>
  api.post<unknown, ApiResponse<PlatformCampaign>>('/admin/marketing/campaigns', data).then((r) => r.data);

export const updateCampaign = (id: string, data: Partial<CampaignInput>) =>
  api.put<unknown, ApiResponse<PlatformCampaign>>(`/admin/marketing/campaigns/${id}`, data).then((r) => r.data);

export const setCampaignStatus = (id: string, status: CampaignStatus) =>
  api.patch<unknown, ApiResponse<PlatformCampaign>>(`/admin/marketing/campaigns/${id}/status`, { status }).then((r) => r.data);

export const deleteCampaign = (id: string) =>
  api.delete<unknown, ApiResponse<{ success: boolean }>>(`/admin/marketing/campaigns/${id}`).then((r) => r.data);

// ============================================================
// Discount codes (vendor promo approvals)
// ============================================================

export interface DiscountListParams {
  page?: number;
  limit?: number;
  status?: DiscountCode['status'];
}

export const listDiscounts = (params: DiscountListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<DiscountCode>>('/admin/marketing/discounts', { params, signal }).then((r) => r);

export const approveDiscount = (id: string) =>
  api.patch<unknown, ApiResponse<DiscountCode>>(`/admin/marketing/discounts/${id}/approve`, {}).then((r) => r.data);

export const rejectDiscount = (id: string) =>
  api.patch<unknown, ApiResponse<DiscountCode>>(`/admin/marketing/discounts/${id}/reject`, {}).then((r) => r.data);

// ============================================================
// Story highlights moderation
// ============================================================

export interface HighlightListParams {
  page?: number;
  limit?: number;
  search?: string;
  vendorId?: string;
  isActive?: boolean;
}

export const listHighlights = (params: HighlightListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<Highlight>>('/admin/marketing/highlights', { params, signal }).then((r) => r);

export const setHighlightStatus = (id: string, isActive: boolean) =>
  api.patch<unknown, ApiResponse<Highlight>>(`/admin/marketing/highlights/${id}`, { isActive }).then((r) => r.data);

export const deleteHighlight = (id: string) =>
  api.delete<unknown, ApiResponse<{ success: boolean }>>(`/admin/marketing/highlights/${id}`).then((r) => r.data);

// ============================================================
// Banners
// ============================================================

export interface BannerInput {
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  deepLink?: string | null;
  bgColor?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  audience?: Record<string, unknown> | null;
  priority?: number;
  isActive?: boolean;
}

export const listBanners = (signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<Banner[]>>('/admin/marketing/banners', { signal }).then((r) => r.data);

export const createBanner = (data: BannerInput) =>
  api.post<unknown, ApiResponse<Banner>>('/admin/marketing/banners', data).then((r) => r.data);

export const updateBanner = (id: string, data: Partial<BannerInput>) =>
  api.put<unknown, ApiResponse<Banner>>(`/admin/marketing/banners/${id}`, data).then((r) => r.data);

export const deleteBanner = (id: string) =>
  api.delete<unknown, ApiResponse<{ success: boolean }>>(`/admin/marketing/banners/${id}`).then((r) => r.data);