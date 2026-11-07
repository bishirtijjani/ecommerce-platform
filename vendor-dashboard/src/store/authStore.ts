import { create } from 'zustand';
import { tokenStorage } from '../api/client';
import { registerWebPush, unregisterWebPush } from '../services/push';
import type { AuthUser } from '../types';

const USER_KEY = 'marketplace_vendor_user';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  setSession: (user: AuthUser, tokens: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

const readStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),
  isAuthenticated: !!tokenStorage.getAccess() && !!readStoredUser(),
  hydrated: true,
  setSession: (user, tokens) => {
    tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true });
    // If the browser already granted notifications, (re)save the subscription.
    registerWebPush().catch(() => {});
  },
  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    unregisterWebPush().catch(() => {});
    tokenStorage.clear();
    localStorage.removeItem(USER_KEY);
    set({ user: null, isAuthenticated: false });
  },
}));
