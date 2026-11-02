import axios, { type InternalAxiosRequestConfig, type AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import type { PaginationMeta } from '../types';

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

export interface ApiError extends Error {
  code?: string | null;
  status?: number | null;
  data?: unknown;
  sessionExpired?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

const ACCESS_KEY = 'mysooq_admin_access';
const REFRESH_KEY = 'mysooq_admin_refresh';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let onForceLogout: (() => void) | null = null;
export const registerForceLogout = (fn: () => void) => {
  onForceLogout = fn;
};

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['x-device-name'] = 'admin-dashboard-web';
  return config;
});

let refreshPromise: Promise<string> | null = null;
let isForceLoggingOut = false;

const isRefreshable = (url = '') =>
  !url.includes('/auth/login') && !url.includes('/auth/refresh') && !url.includes('/auth/logout');

const performRefresh = async (): Promise<string> => {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) throw new Error('No refresh token stored');

  const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 },
  );
  const data = res.data?.data;
  const newAccess = data?.accessToken;
  const newRefresh = data?.refreshToken;
  if (!newAccess || !newRefresh) throw new Error('Malformed refresh response');
  tokenStorage.set(newAccess, newRefresh);
  return newAccess;
};

const forceLogout = () => {
  if (isForceLoggingOut) return;
  isForceLoggingOut = true;
  tokenStorage.clear();
  toast.error('Session expired', { description: 'Please log in again.' });
  onForceLogout?.();
  // reset after a tick so future failures can still redirect if needed
  setTimeout(() => {
    isForceLoggingOut = false;
  }, 0);
};

api.interceptors.response.use(
  (response) => response.data as any,
  async (error) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status ?? null;
    const requestUrl = original?.url || '';

    if (status === 401 && original && !original._retry && isRefreshable(requestUrl)) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = performRefresh().finally(() => {
            refreshPromise = null;
          });
        }
        const newAccess = await refreshPromise;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        forceLogout();
        const sessionErr: ApiError = new Error('Your session expired. Please log in again.');
        sessionErr.status = 401;
        sessionErr.sessionExpired = true;
        return Promise.reject(sessionErr);
      }
    }

    const data = error.response?.data ?? null;
    const isNetworkError = !error.response;
    const message = data?.message || error.message || 'Network error. Please check your connection.';

    const err: ApiError = new Error(message);
    err.code = data?.code || (isNetworkError ? 'NETWORK_ERROR' : null);
    err.status = status;
    err.data = data;
    return Promise.reject(err);
  },
);

export type RequestConfig = AxiosRequestConfig;

export default api;
