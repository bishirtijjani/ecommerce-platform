import api from './client';
import type { ApiResponse } from './client';
import type { Vendor, VendorStatus, Paginated } from '../types';

export interface ReverseGeocodeResult {
  address: string | null;
  city: string | null;
  state: string | null;
  lga: string | null;
  country: string | null;
}

/** Resolve a map pin to an address + canonical State/LGA. */
export const reverseGeocode = (lat: number, lng: number) =>
  api
    .get<unknown, { data: ReverseGeocodeResult }>('/geo/reverse', { params: { lat, lng } })
    .then((r) => r.data);

export interface PlaceSearchResult {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  state: string | null;
  lga: string | null;
}

/** Free-text place/address search for the map picker. */
export const searchPlaces = (query: string) =>
  api
    .get<unknown, { data: PlaceSearchResult[] }>('/geo/search', { params: { query } })
    .then((r) => r.data);

export interface VendorListParams {
  page?: number;
  limit?: number;
  status?: VendorStatus;
  search?: string;
  categoryId?: string;
  categorySlug?: string;
}

interface RawVendorTag {
  tag: { id: string; name: string; color: string | null };
}

const mapVendorTags = (vendor: Vendor & { tags?: RawVendorTag[] }): Vendor => ({
  ...vendor,
  tags: (vendor.tags as RawVendorTag[] | undefined)?.map((t) => t.tag) ?? [],
});

export interface VendorStatusCounts {
  PENDING_APPROVAL: number;
  APPROVED: number;
  SUSPENDED: number;
  REJECTED: number;
  total: number;
}

export const listVendors = (params: VendorListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<Vendor>>('/admin/vendors', { params, signal }).then((r) => r);

export const getVendorStatusCounts = (signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<VendorStatusCounts>>('/admin/vendors/status-counts', { signal }).then((r) => r.data);

export const getVendor = (id: string, signal?: AbortSignal) =>
  api
    .get<unknown, ApiResponse<Vendor & { tags?: RawVendorTag[] }>>(`/admin/vendors/${id}`, { signal })
    .then((r) => mapVendorTags(r.data));

export const approveVendor = (id: string) =>
  api.patch<unknown, ApiResponse<Vendor>>(`/admin/vendors/${id}/approve`, {}).then((r) => r.data);

export const rejectVendor = (id: string, reason: string) =>
  api.patch<unknown, ApiResponse<Vendor>>(`/admin/vendors/${id}/reject`, { reason }).then((r) => r.data);

export const suspendVendor = (id: string, reason: string) =>
  api.patch<unknown, ApiResponse<Vendor>>(`/admin/vendors/${id}/suspend`, { reason }).then((r) => r.data);

export const unsuspendVendor = (id: string) =>
  api.patch<unknown, ApiResponse<Vendor>>(`/admin/vendors/${id}/unsuspend`, {}).then((r) => r.data);

export const updateVendorTags = (id: string, tagIds: string[]) =>
  api.post<unknown, ApiResponse<RawVendorTag[]>>(`/admin/vendors/${id}/tags`, { tagIds }).then((r) => r.data);

export interface VendorProfileInput {
  name?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  state?: string;
  lga?: string;
  lat?: number;
  lng?: number;
  openingTime?: string;
  closingTime?: string;
  openingDays?: string[];
  logoUrl?: string;
  coverImageUrl?: string;
  photos?: string[];
  policies?: Record<string, string> | null;
}

export const updateVendorProfile = (id: string, data: VendorProfileInput) =>
  api.put<unknown, ApiResponse<Vendor>>(`/admin/vendors/${id}`, data).then((r) => r.data);
