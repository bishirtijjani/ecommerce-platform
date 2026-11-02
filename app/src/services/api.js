import axios from 'axios';
import * as SecureStore from '../lib/storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import i18n from '../i18n';
import { captureError as captureSentryError } from './sentry';
import { optimizeImagesInPayload } from '../lib/imageUrl';

/**
 * Translate a server error envelope to the user's locale.
 *   - Looks up `errors.<code>` in the current language.
 *   - Falls back to the server-supplied English `message` when no
 *     translation exists (or when the response carried no `code`).
 * Lives here rather than in a hook so the response interceptor - which
 * can't use hooks - has access to localized copy for its auto-toast.
 */
const translateError = (data, fallbackMessage) => {
  const code = data?.code;
  const serverMessage = data?.message || fallbackMessage;
  if (!code) return serverMessage;
  const key = `errors.${code}`;
  const translated = i18n.t(key);
  return translated === key ? serverMessage : translated;
};

// Load base URL from environment variables, fallback for local dev.
// For physical device testing, use your computer's LAN IP (e.g., http://192.168.1.100:3000).
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';

// Socket.io connects at the same host as the REST API.
export const SOCKET_URL = BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  // Without a timeout, a stalled or unreachable backend leaves every request
  // pending forever - the caller never gets a resolve OR a reject, so loading
  // spinners (e.g. the quote screen) hang indefinitely. 30s is generous for a
  // mobile network yet still fails fast enough to show an error + retry.
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cache device-identification headers - these never change at runtime, so
// computing them once and reusing avoids touching the native bridge per request.
const DEVICE_HEADERS = {
  'x-device-name': Device.deviceName || `${Platform.OS}-device`,
  'x-device-model': Device.modelName || Device.modelId || 'unknown',
  'x-device-platform': Platform.OS,
  'x-device-os-version': String(Platform.Version || ''),
};

// ============================================================
// Auth handoff
// ============================================================
// authSlice registers a logout function here at startup so the response
// interceptor can hard-logout when /auth/refresh ultimately fails. We avoid
// a direct `import` of the slice/store to keep this module free of circular
// deps (the slice imports api, api can't import the slice).
let _onForceLogout = null;
export const registerForceLogout = (fn) => { _onForceLogout = fn; };

// ============================================================
// Request interceptor - auth header + device fingerprint
// ============================================================
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    Object.assign(config.headers, DEVICE_HEADERS);
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// Silent token refresh
// ============================================================
// Phase 5 - when any request 401s (except /auth/login and /auth/refresh
// themselves), transparently:
//   1. Call POST /auth/refresh with the stored refresh token
//   2. Persist the rotated token pair to SecureStore
//   3. Replay the original request once with the new access token
//
// Concurrent 401s coalesce on a single in-flight refresh promise so we don't
// fan out N parallel /auth/refresh calls. If the refresh itself returns 401
// (or any other error), we clear tokens, surface ONE toast, and dispatch the
// registered logout. Without this the 15-minute access-token expiry kicks
// users to Login mid-task.

let refreshPromise = null;

const isRefreshableRequest = (url = '') => {
  // Don't try to refresh on the auth endpoints themselves; that infinite-loops.
  return !url.includes('/auth/login') && !url.includes('/auth/refresh') && !url.includes('/auth/logout');
};

/**
 * Only a refresh token the server explicitly rejects means the session is
 * actually over. Anything else - offline, DNS failure, a timeout, a 429 from a
 * shared carrier IP, a 502 while the container redeploys - must leave the
 * stored tokens alone. Treating those as fatal is what turned a flaky mobile
 * connection into a logout.
 */
const isFatalRefreshError = (error) => {
  const status = error?.response?.status ?? error?.status ?? null;
  return status === 400 || status === 401 || status === 403;
};

const performRefresh = async () => {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  if (!refreshToken) {
    const err = new Error('No refresh token stored');
    err.status = 401;
    throw err;
  }

  // Use a bare axios instance for the refresh call so our own interceptors
  // don't recurse on a refresh-call 401. 30s matches the API client: a 10s cap
  // was too tight for a slow mobile network and turned latency into a logout.
  let res;
  try {
    res = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { refreshToken },
      {
        headers: { 'Content-Type': 'application/json', ...DEVICE_HEADERS },
        timeout: 30_000,
      },
    );
  } catch (error) {
    const status = error.response?.status ?? null;
    const err = new Error(
      error.response?.data?.message || error.message || 'Token refresh failed',
    );
    err.status = status;
    err.code = error.response?.data?.code || error.code || null;
    throw err;
  }

  const data = res.data?.data || res.data;
  const tokens = data?.tokens || data;
  const newAccess = tokens?.accessToken;
  const newRefresh = tokens?.refreshToken;
  if (!newAccess || !newRefresh) {
    throw new Error('Malformed refresh response');
  }

  // Write the refresh token FIRST. The server revokes the previous one the
  // moment it issues a new one, so a crash between these two writes must leave
  // the new (working) refresh token in place - the next 401 refreshes again.
  // The old order could leave a fresh access token paired with a revoked
  // refresh token, which forced a full re-login.
  await SecureStore.setItemAsync('refreshToken', newRefresh);
  await SecureStore.setItemAsync('accessToken', newAccess);
  return newAccess;
};

const runRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

let forceLogoutInFlight = null;

const forceLogout = async ({ showToast = true } = {}) => {
  // Every request that shared the failed refresh calls this. Coalesce the
  // burst so the user sees one toast and one state wipe, not N of each.
  if (forceLogoutInFlight) return forceLogoutInFlight;

  forceLogoutInFlight = (async () => {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    } catch (_) {}
    if (showToast) {
      // Both lines pull from the i18n catalog so a Hausa user sees Hausa copy
      // on session expiry instead of the original English fallback.
      Toast.show({
        type: 'error',
        text1: i18n.t('errors.REFRESH_TOKEN_INVALID'),
        text2: i18n.t('errors.UNAUTHORIZED'),
      });
    }
    if (typeof _onForceLogout === 'function') {
      try { _onForceLogout(); } catch (_) {}
    }
  })();

  try {
    await forceLogoutInFlight;
  } finally {
    forceLogoutInFlight = null;
  }
};

const decodeBase64 = (value) => {
  if (!value || typeof atob !== 'function') return null;
  try {
    return atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  } catch (_) {
    return null;
  }
};

/** Read a JWT's `exp` without verifying it (we only need a refresh hint). */
const getTokenExpiryMs = (token) => {
  try {
    const json = decodeBase64(String(token).split('.')[1] || '');
    const exp = json ? JSON.parse(json).exp : null;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch (_) {
    return null;
  }
};

/**
 * Refresh ahead of expiry instead of waiting for a 401.
 *
 * Call on foreground and before opening the socket. A transient failure is
 * swallowed (the current token is returned and the 401 path will retry); a
 * fatal one clears the session and rejects, same as the interceptor.
 */
export const ensureFreshAccessToken = async ({ force = false, minValidityMs = 60_000 } = {}) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (!token) return null;

  const expiresAt = getTokenExpiryMs(token);
  if (!force && expiresAt !== null && expiresAt - Date.now() > minValidityMs) {
    return token;
  }

  try {
    return await runRefresh();
  } catch (error) {
    if (isFatalRefreshError(error)) {
      await forceLogout();
      throw error;
    }
    return token;
  }
};

// ============================================================
// Response interceptor
// ============================================================
// On 401, attempt one silent refresh + replay. On any other error, normalize
// to `{ message, status, data, retryAfterSeconds? }` so callers (thunks) can
// read structured fields.
api.interceptors.response.use(
  (response) => optimizeImagesInPayload(response.data),
  async (error) => {
    const original = error.config;
    const status = error.response?.status ?? null;
    const requestUrl = original?.url || '';

    // --- Silent refresh path ---
    if (status === 401 && original && !original._retry && isRefreshableRequest(requestUrl)) {
      original._retry = true;
      try {
        const newAccess = await runRefresh();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshErr) {
        // Transient: keep the session and let the caller retry. No toast -
        // the screen that made the request already renders its own error, and
        // a toast here would fire on every request during an outage.
        if (!isFatalRefreshError(refreshErr)) {
          // No HTTP status means we never reached the server - use localized
          // network copy. Otherwise keep the server's message (429, 5xx).
          const retryErr = new Error(
            refreshErr?.status
              ? (refreshErr.message || i18n.t('errors.UNKNOWN_ERROR'))
              : i18n.t('errors.NETWORK_ERROR'),
          );
          retryErr.status = refreshErr?.status ?? null;
          retryErr.code = refreshErr?.code || 'REFRESH_TRANSIENT';
          retryErr.data = null;
          retryErr.transient = true;
          return Promise.reject(retryErr);
        }

        // forceLogout already surfaces a single localized "session expired"
        // toast and clears tokens + Redux state. Reject with a sentinel error
        // and do NOT fall through to the generic toast block below - two
        // toasts on session expiry is just noise.
        await forceLogout();
        const sessionErr = new Error(i18n.t('errors.REFRESH_TOKEN_INVALID'));
        sessionErr.status = 401;
        sessionErr.data = null;
        sessionErr.sessionExpired = true;
        return Promise.reject(sessionErr);
      }
    }

    const data = error.response?.data ?? null;
    // Network-level failures (no response) get a localized NETWORK_ERROR;
    // server errors carry their own `code` and `message`.
    const isNetworkError = !error.response;
    const serverMessage =
      data?.message || error.message || 'Network Error. Please check your connection.';
    const localizedMessage = isNetworkError
      ? i18n.t('errors.NETWORK_ERROR')
      : translateError(data, serverMessage);
    const code = data?.code || (isNetworkError ? 'NETWORK_ERROR' : null);

    // Suppress the global toast for 401/423/429 - callers render contextual UI
    // (retry banner, session-expired toast already shown above). Callers can
    // also opt out via `skipToast: true` in the request config when they render
    // their own error state (e.g. the seller requests screens).
    if (status !== 401 && status !== 423 && status !== 429 && !original?.skipToast) {
      Toast.show({
        type: 'error',
        text1: i18n.t('errors.title'),
        text2: localizedMessage,
        position: 'top',
      });
    }

    // The rejected error carries both: `message` is the localized copy ready
    // to render verbatim; `serverMessage` preserves the English wire text in
    // case a caller logs or reports it. `code` is top-level for easy access.
    const err = new Error(localizedMessage);
    err.code = code;
    err.status = status;
    err.data = data;
    err.serverMessage = serverMessage;
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) {
      const secs = parseInt(retryAfter, 10);
      if (!Number.isNaN(secs)) err.retryAfterSeconds = secs;
    }
    // Forward server-side 5xx + true network failures to Sentry. Skip 4xx
    // operational errors (validation, insufficient balance, etc.) - they're
    // expected and would drown out real signal in the dashboard.
    const requestIdHeader = error.response?.headers?.['x-request-id'];
    if (isNetworkError || (status && status >= 500)) {
      captureSentryError(err, {
        source: 'apiInterceptor',
        url: requestUrl,
        method: original?.method,
        status,
        requestId: requestIdHeader,
      });
    }
    if (requestIdHeader) err.requestId = requestIdHeader;
    return Promise.reject(err);
  }
);

export default api;
