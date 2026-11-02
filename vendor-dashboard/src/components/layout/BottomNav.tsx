import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Package, Boxes, MessageCircle, MoreHorizontal, Megaphone, BarChart3, Store, Image, Tags, Settings, LogOut, X, Inbox, LifeBuoy } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../store/authStore';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { useChatUnreadCount } from '../../hooks/useChat';
import { useRequestUnreadCount } from '../../hooks/useRequests';

const TABS = [
  { to: '/', labelKey: 'nav.home', icon: LayoutDashboard, end: true },
  { to: '/orders', labelKey: 'nav.orders', icon: Package },
  { to: '/messages', labelKey: 'nav.chats', icon: MessageCircle, badgeKey: 'chat' as const },
  { to: '/requests', labelKey: 'nav.requests', icon: Inbox, badgeKey: 'request' as const },
];

const MORE_LINKS = [
  { to: '/products', labelKey: 'nav.products', icon: Boxes },
  { to: '/marketing', labelKey: 'nav.marketing', icon: Megaphone },
  { to: '/highlights', labelKey: 'nav.highlights', icon: Image },
  { to: '/categories', labelKey: 'nav.categories', icon: Tags },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { to: '/shop', labelKey: 'nav.shopProfile', icon: Store },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
  { to: '/support', labelKey: 'nav.support', icon: LifeBuoy },
];

const NavItem = ({
  to, end, icon: Icon, label, onClick, badge,
}: { to: string; end?: boolean; icon: typeof LayoutDashboard; label: string; onClick?: () => void; badge?: number }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        'flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
        isActive ? 'text-brand' : 'text-text-muted',
      )
    }
  >
    {({ isActive }) => (
      <>
        <div className={cn('relative flex h-9 w-9 items-center justify-center rounded-full', isActive && 'bg-brand-soft')}>
          <Icon className="h-5 w-5" />
          {!!badge && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        {label}
      </>
    )}
  </NavLink>
);

export const BottomNav = () => {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { data: chatUnread = 0 } = useChatUnreadCount();
  const { data: requestUnread = 0 } = useRequestUnreadCount();

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {TABS.map((tab) => (
          <NavItem
            key={tab.to}
            to={tab.to}
            end={tab.end}
            icon={tab.icon}
            label={t(tab.labelKey)}
            badge={tab.badgeKey === 'chat' ? chatUnread : tab.badgeKey === 'request' ? requestUnread : undefined}
          />
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium text-text-muted"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full">
            <MoreHorizontal className="h-5 w-5" />
          </div>
          {t('nav.more')}
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[color:var(--scrim)]" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-border bg-bg-surface p-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-popover animate-slide-up">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold text-text-primary">{t('nav.more')}</p>
              <button onClick={() => setMoreOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              <div className="px-1 py-1">
                <LanguageSwitcher className="w-full justify-between" />
              </div>
              {MORE_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium',
                      isActive ? 'bg-brand-soft text-brand-strong' : 'text-text-primary hover:bg-bg-muted',
                    )
                  }
                >
                  <l.icon className="h-5 w-5" />
                  {t(l.labelKey)}
                </NavLink>
              ))}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                  navigate('/login');
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-error-strong hover:bg-error-soft"
              >
                <LogOut className="h-5 w-5" />
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
