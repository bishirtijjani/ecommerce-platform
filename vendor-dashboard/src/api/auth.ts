import api from './client';
import type { AuthUser } from '../types';

export interface LoginResponse {
  user: AuthUser;
  tokens: { accessToken: string; refreshToken: string };
}

export const login = (email: string, password: string) =>
  api.post<unknown, { data: LoginResponse }>('/auth/login', { email, password }).then((r) => r.data);

/**
 * The one account-creation call. Same endpoint the customer app uses - there
 * is no separate "vendor account". Verifying the emailed OTP signs the new
 * account in, after which the user continues into the shop wizard.
 */
export interface RegisterAccountInput {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
}

export const registerAccount = (input: RegisterAccountInput) =>
  api.post<unknown, { data: { email: string; role: string } }>('/auth/register', input).then((r) => r.data);

/**
 * Attach a shop to the currently-authenticated account. This is the single
 * "become a vendor" action - works for an account that started in the
 * customer app just as well as one created here.
 */
export interface EnrollVendorInput {
  businessName: string;
  businessPhone: string;
  businessEmail?: string;
  businessAddress?: string;
  lat?: number;
  lng?: number;
  state?: string;
  lga?: string;
  openingTime?: string;
  closingTime?: string;
}

export const enrollVendor = (input: EnrollVendorInput) =>
  api
    .post<unknown, { data: { vendorId: string; status: string } }>('/auth/vendor/enroll', input)
    .then((r) => r.data);

/** Redeem the one-time code minted by the customer app (app -> web SSO). */
export const exchangeHandoff = (token: string) =>
  api
    .post<unknown, { data: LoginResponse }>('/auth/handoff/exchange', { token })
    .then((r) => r.data);

export interface VendorRegisterInput {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  openingTime: string;
  closingTime: string;
}

export const vendorRegister = (input: VendorRegisterInput) =>
  api.post<unknown, { data: { email: string; businessName: string } }>('/auth/vendor/register', input).then((r) => r.data);

export const verifyOtp = (email: string, code: string) =>
  api
    .post<unknown, { data: { verified: boolean; userId?: string; user?: AuthUser; tokens?: LoginResponse['tokens'] } }>(
      '/auth/otp/verify',
      { email, code },
    )
    .then((r) => r.data);

export const resendOtp = (email: string) => api.post('/auth/otp/send', { email });

export const forgotPassword = (email: string) => api.post('/auth/password/forgot', { email });

export const resetPassword = (email: string, code: string, newPassword: string) =>
  api.post('/auth/password/reset', { email, code, newPassword });

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  profilePicture: string | null;
  address: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export const getProfile = () => api.get<unknown, { data: UserProfile }>('/auth/profile').then((r) => r.data);

export const updateProfile = (data: Partial<{ firstName: string; lastName: string; phone: string; address: string }>) =>
  api.patch<unknown, { data: UserProfile }>('/auth/profile', data).then((r) => r.data);

export const logout = (refreshToken: string) => api.post('/auth/logout', { refreshToken });

export interface Session {
  id: string;
  deviceName: string | null;
  deviceModel: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export const listSessions = () => api.get<unknown, { data: Session[] }>('/auth/sessions').then((r) => r.data);
export const revokeSession = (id: string) => api.delete(`/auth/sessions/${id}`);
export const revokeOtherSessions = () => api.delete('/auth/sessions/others');

export interface NotificationPreferences {
  pushEnabled: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  emailEnabled: boolean;
  emailPromotions: boolean;
  smsEnabled: boolean;
}

export const getNotificationPreferences = () =>
  api.get<unknown, { data: NotificationPreferences }>('/auth/notification-preferences').then((r) => r.data);
export const updateNotificationPreferences = (data: Partial<NotificationPreferences>) =>
  api.patch<unknown, { data: NotificationPreferences }>('/auth/notification-preferences', data).then((r) => r.data);

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
}

export const getUploadSignature = (kind: 'vendor_logo' | 'vendor_cover' | 'product' | 'product_video' | 'chat' | 'ticket' | 'highlight' | 'highlight_video' | 'category') =>
  api.post<unknown, { data: UploadSignature }>('/auth/upload-signature', { kind }).then((r) => r.data);
