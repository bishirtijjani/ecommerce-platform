import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Monitor, LogOut, User, ChevronDown, Headset } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useVendorProfile, useToggleShopStatus } from '../../hooks/useVendor';
import { Switch } from '../ui/Switch';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';
import { NotificationBell } from './NotificationBell';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { cn } from '../../lib/cn';

export const Topbar = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { data: vendor } = useVendorProfile();
  const toggleStatus = useToggleShopStatus();
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

  const THEME_OPTIONS = [
    { value: 'light' as const, Icon: Sun, label: t('topbar.themeLight') },
    { value: 'dark' as const, Icon: Moon, label: t('topbar.themeDark') },
    { value: 'system' as const, Icon: Monitor, label: t('topbar.themeSystem') },
  ];

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-bg-surface/95 px-4 backdrop-blur sm:gap-3 sm:px-6">
      <div className="lg:hidden">
        <Logo size={26} wordmark={false} />
      </div>

      <div className="flex-1" />

      {vendor && vendor.status === 'APPROVED' && (
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-bg-canvas px-2.5 py-1.5 sm:gap-2.5 sm:px-3">
          <span className={cn('h-2 w-2 rounded-full', vendor.isOpen ? 'bg-success' : 'bg-text-placeholder')} />
          <span className="hidden text-sm font-medium text-text-primary sm:inline">{vendor.isOpen ? t('topbar.shopOpen') : t('topbar.shopClosed')}</span>
          <Switch checked={vendor.isOpen} onChange={(v) => toggleStatus.mutate(v)} disabled={toggleStatus.isPending} />
        </div>
      )}

      <LanguageSwitcher className="hidden sm:inline-flex" />

      <button
        onClick={() => navigate('/support')}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted hover:text-text-primary"
        aria-label={t('nav.support')}
        title={t('nav.support')}
      >
        <Headset className="h-[18px] w-[18px]" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error ring-2 ring-bg-surface" aria-hidden="true" />
      </button>

      <NotificationBell />

      <div className="relative" ref={ref}>
        <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1 hover:bg-bg-muted sm:pr-2">
          <Avatar name={`${user?.firstName || ''} ${user?.lastName || ''}`} size={32} />
          <ChevronDown className="hidden h-4 w-4 text-text-muted sm:block" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-11 z-30 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-bg-surface p-1.5 shadow-popover animate-slide-up">
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
                navigate('/settings');
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-text-primary hover:bg-bg-muted"
            >
              <User className="h-4 w-4" /> {t('topbar.accountSettings')}
            </button>

            <div className="my-1 h-px bg-border" />
            <div className="px-2.5 py-1.5">
              <p className="mb-1.5 text-xs font-semibold text-text-muted">
                {t('topbar.themeLabel', { mode: t(`topbar.theme${mode.charAt(0).toUpperCase()}${mode.slice(1)}`) })}
              </p>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-canvas p-1">
                {THEME_OPTIONS.map(({ value, Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    title={label}
                    aria-label={label}
                    aria-pressed={mode === value}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold',
                      mode === value ? 'bg-brand text-white' : 'text-text-muted hover:bg-bg-muted',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-error-strong hover:bg-error-soft"
            >
              <LogOut className="h-4 w-4" /> {t('nav.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
