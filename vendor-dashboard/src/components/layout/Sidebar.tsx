import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Package, Boxes, MessageCircle, Megaphone, BarChart3, Store, Image, Tags, Settings, Inbox, LifeBuoy,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { cn } from '../../lib/cn';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { useChatUnreadCount } from '../../hooks/useChat';
import { useRequestUnreadCount } from '../../hooks/useRequests';

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', labelKey: 'nav.orders', icon: Package },
  { to: '/messages', labelKey: 'nav.messages', icon: MessageCircle, badgeKey: 'chat' as const },
  { to: '/requests', labelKey: 'nav.requests', icon: Inbox, badgeKey: 'request' as const },
  { to: '/products', labelKey: 'nav.products', icon: Boxes },
  { to: '/marketing', labelKey: 'nav.marketing', icon: Megaphone },
  { to: '/highlights', labelKey: 'nav.highlights', icon: Image },
  { to: '/categories', labelKey: 'nav.categories', icon: Tags },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { to: '/shop', labelKey: 'nav.shopProfile', icon: Store },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
  { to: '/support', labelKey: 'nav.support', icon: LifeBuoy },
];

/** Desktop-only nav. Mobile uses BottomNav instead - see components/layout/BottomNav.tsx. */
export const Sidebar = () => {
  const { t } = useTranslation();
  const { data: chatUnread = 0 } = useChatUnreadCount();
  const { data: requestUnread = 0 } = useRequestUnreadCount();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-bg-surface lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-16 items-center px-5">
          <Logo size={28} />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const badge = item.badgeKey === 'chat' ? chatUnread : item.badgeKey === 'request' ? requestUnread : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-soft text-brand-strong' : 'text-text-muted hover:bg-bg-muted hover:text-text-primary',
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{t(item.labelKey)}</span>
                {badge > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-text-onBrand">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-border p-4">
          <LanguageSwitcher className="w-full justify-between" />
          <p className="text-xs text-text-placeholder">Marketplace Vendor · v1.0</p>
        </div>
      </div>
    </aside>
  );
};
