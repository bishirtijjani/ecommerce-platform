import axios, { type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

export interface ApiError extends Error {
  code?: string | null;
  status?: number | null;
  data?: unknown;
  sessionExpired?: boolean;
}

const ACCESS_KEY = 'mysooq_vendor_access';
const REFRESH_KEY = 'mysooq_vendor_refresh';

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
  config.headers['x-device-name'] = 'vendor-dashboard-web';
  return config;
});

let refreshPromise: Promise<string> | null = null;

const isRefreshable = (url = '') =>
  !url.includes('/auth/login') && !url.includes('/auth/refresh') && !url.includes('/auth/logout');

const performRefresh = async (): Promise<string> => {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) throw new Error('No refresh token stored');

  const res = await axios.post(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 },
  );
  const data = res.data?.data || res.data;
  const newAccess = data?.accessToken;
  const newRefresh = data?.refreshToken;
  if (!newAccess || !newRefresh) throw new Error('Malformed refresh response');
  tokenStorage.set(newAccess, newRefresh);
  return newAccess;
};

const forceLogout = () => {
  tokenStorage.clear();
  toast.error('Session expired', { description: 'Please log in again.' });
  onForceLogout?.();
};

api.interceptors.response.use(
  (response) => response.data,
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
        original.headers = original.headers || ({} as never);
        (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
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

export default api;
