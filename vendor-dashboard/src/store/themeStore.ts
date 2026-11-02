import { create } from 'zustand';

type Mode = 'light' | 'dark' | 'system';
const KEY = 'mysooq_vendor_theme';

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolve = (mode: Mode) => (mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode);

const applyDom = (resolved: 'light' | 'dark') => {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
};

interface ThemeState {
  mode: Mode;
  resolved: 'light' | 'dark';
  setMode: (mode: Mode) => void;
}

const initialMode = (localStorage.getItem(KEY) as Mode) || 'light';
applyDom(resolve(initialMode));

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  resolved: resolve(initialMode),
  setMode: (mode) => {
    localStorage.setItem(KEY, mode);
    const resolved = resolve(mode);
    applyDom(resolved);
    set({ mode, resolved });
  },
}));

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { mode, setMode } = useThemeStore.getState();
  if (mode === 'system') setMode('system');
});
