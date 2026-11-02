import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Store,
  Users,
  FolderTree,
  Tag,
  LifeBuoy,
  MessagesSquare,
  Star,
  PhoneCall,
  Megaphone,
  MoreHorizontal,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../store/authStore';
import { hasPermission, type AdminPermission } from '../../lib/permissions';

interface NavItemDef {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: AdminPermission;
  end?: boolean;
}

const PRIMARY_TABS: NavItemDef[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard, permission: 'ALL', end: true },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, permission: 'MANAGE_USERS' },
  { to: '/vendors', label: 'Vendors', icon: Store, permission: 'MANAGE_VENDORS' },
  { to: '/customers', label: 'Customers', icon: Users, permission: 'MANAGE_USERS' },
];

const MORE_LINKS: NavItemDef[] = [
  { to: '/categories', label: 'Categories', icon: FolderTree, permission: 'MANAGE_VENDORS' },
  { to: '/tags', label: 'Tags', icon: Tag, permission: 'MANAGE_VENDORS' },
  { to: '/support', label: 'Support', icon: LifeBuoy, permission: 'MANAGE_SUPPORT' },
  { to: '/chat', label: 'Chat', icon: MessagesSquare, permission: 'MANAGE_SUPPORT' },
  { to: '/ratings', label: 'Ratings', icon: Star, permission: 'MANAGE_SUPPORT' },
  { to: '/callbacks', label: 'Callbacks', icon: PhoneCall, permission: 'MANAGE_SUPPORT' },
  { to: '/marketing', label: 'Marketing', icon: Megaphone, permission: 'MANAGE_SETTINGS' },
];

const NavItem = ({
  to,
  end,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
  label: string;
  onClick?: () => void;
}) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        'flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-inset',
        isActive ? 'text-brand' : 'text-text-muted',
      )
    }
  >
    {({ isActive }) => (
      <>
        <div className={cn('relative flex h-9 w-9 items-center justify-center rounded-full', isActive && 'bg-brand-soft')}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span>
          {label}
          {isActive && <span className="sr-only"> (current)</span>}
        </span>
      </>
    )}
  </NavLink>
);

export const BottomNav = () => {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const permissions = useAuthStore((s) => s.user?.permissions);

  const visiblePrimary = PRIMARY_TABS.filter((item) =>
    item.permission === 'ALL' ? true : hasPermission(permissions, item.permission),
  );
  const visibleMore = MORE_LINKS.filter((item) => hasPermission(permissions, item.permission));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Mobile navigation"
      >
        {visiblePrimary.map((t) => (
          <NavItem key={t.to} {...t} />
        ))}
        {visibleMore.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-inset"
            aria-label="More navigation"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full">
              <MoreHorizontal className="h-5 w-5" />
            </div>
            More
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[color:var(--scrim)]" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-border bg-bg-surface p-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-popover animate-slide-up">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-semibold text-text-primary">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {visibleMore.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                      isActive ? 'bg-brand-soft text-brand-strong' : 'text-text-primary hover:bg-bg-muted',
                    )
                  }
                >
                  <l.icon className="h-5 w-5" />
                  {l.label}
                </NavLink>
              ))}
              <button
                onClick={async () => {
                  setMoreOpen(false);
                  await logout();
                  navigate('/login');
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-error-strong hover:bg-error-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
              >
                <LogOut className="h-5 w-5" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
