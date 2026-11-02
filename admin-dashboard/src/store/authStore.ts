import { create } from 'zustand';
import { tokenStorage } from '../api/client';
import { logout as logoutApi } from '../api/auth';
import { registerWebPush, unregisterWebPush } from '../services/push';
import type { AuthUser } from '../types';

const USER_KEY = 'mysooq_admin_user';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setSession: (user: AuthUser, tokens: { accessToken: string; refreshToken: string }) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => Promise<void>;
}

const readStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

const storedUser = readStoredUser();
const hasTokens = !!tokenStorage.getAccess() && !!tokenStorage.getRefresh();

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  isAuthenticated: hasTokens && !!storedUser,
  isInitialized: true,
  setSession: (user, tokens) => {
    tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true });
    // If notifications are already granted, (re)save the push subscription.
    registerWebPush().catch(() => {});
  },
  updateUser: (patch) =>
    set((state) => {
      if (!state.user) return state;
      const next = { ...state.user, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return { user: next };
    }),
  logout: async () => {
    const refreshToken = tokenStorage.getRefresh();
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch {
        // ignore server errors during logout; still clear local state
      }
    }
    tokenStorage.clear();
    localStorage.removeItem(USER_KEY);
    set({ user: null, isAuthenticated: false });
    unregisterWebPush().catch(() => {});
  },
}));
