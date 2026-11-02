import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Monitor, LogOut, ChevronDown, UserCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';

export const Topbar = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { mode, setMode } = useThemeStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const cycleTheme = () => {
    const order: Array<typeof mode> = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-bg-surface/95 px-4 backdrop-blur sm:gap-3 sm:px-6">
      <div className="lg:hidden">
        <Logo size={26} wordmark={false} />
      </div>

      <div className="flex-1" />

      <button
        onClick={cycleTheme}
        className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label={`Theme: ${mode}. Click to cycle.`}
        title={`Theme: ${mode}`}
      >
        {mode === 'light' ? <Sun className="h-[18px] w-[18px]" /> : mode === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Monitor className="h-[18px] w-[18px]" />}
      </button>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1 hover:bg-bg-muted sm:pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="User menu"
        >
          <Avatar name={`${user?.firstName || ''} ${user?.lastName || ''}`} size={32} src={user?.profilePicture} />
          <div className="hidden text-left sm:block">
            <p className="max-w-[140px] truncate text-sm font-semibold text-text-primary">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="max-w-[140px] truncate text-xs text-text-muted">{user?.email}</p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-text-muted sm:block" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-11 z-30 w-56 rounded-lg border border-border bg-bg-surface p-1.5 shadow-popover animate-slide-up"
            role="menu"
            aria-orientation="vertical"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-semibold text-text-primary">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-text-muted">{user?.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate('/profile');
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-text-primary hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              role="menuitem"
            >
              <UserCircle className="h-4 w-4" /> My profile
            </button>
            <button
              onClick={async () => {
                setMenuOpen(false);
                await logout();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-error-strong hover:bg-error-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
