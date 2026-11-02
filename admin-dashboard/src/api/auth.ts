import api from './client';
import type { ApiResponse } from './client';
import type { AuthUser } from '../types';

export interface LoginResponse {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string };
}

export const login = (email: string, password: string) =>
  api.post<unknown, ApiResponse<LoginResponse>>('/auth/login', { email, password }).then((r) => r.data);

export const logout = (refreshToken: string) =>
  api.post<unknown, ApiResponse<null>>('/auth/logout', { refreshToken });

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  kind: string;
}

export type UploadKind =
  | 'profile'
  | 'product'
  | 'product_video'
  | 'vendor_logo'
  | 'vendor_cover'
  | 'category'
  | 'highlight'
  | 'highlight_video';

export const getUploadSignature = (kind: UploadKind) =>
  api.post<unknown, ApiResponse<UploadSignature>>('/auth/upload-signature', { kind }).then((r) => r.data);

export interface AdminProfile {
  id: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string | null;
  dateOfBirth: string | null;
  address: string | null;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  status: string;
  createdAt: string;
}

export interface ProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
}

export const getProfile = (signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<AdminProfile>>('/auth/profile', { signal }).then((r) => r.data);

export const updateProfile = (data: ProfileUpdateInput) =>
  api.patch<unknown, ApiResponse<AdminProfile>>('/auth/profile', data).then((r) => r.data);

export const updateProfilePicture = (url: string) =>
  api.put<unknown, ApiResponse<null>>('/auth/profile/picture', { url }).then((r) => r.data);
