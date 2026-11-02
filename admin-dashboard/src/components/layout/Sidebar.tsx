import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Store,
  Users,
  Tags,
  FolderTree,
  LifeBuoy,
  MessagesSquare,
  Megaphone,
  Star,
  PhoneCall,
  ClipboardList,
  UserCircle,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../store/authStore';
import { hasPermission, type AdminPermission } from '../../lib/permissions';
import { useVendorStatusCounts } from '../../hooks/useVendors';

interface NavItemDef {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: AdminPermission;
  end?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'ALL', end: true },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, permission: 'MANAGE_USERS' },
  { to: '/vendors', label: 'Vendors', icon: Store, permission: 'MANAGE_VENDORS' },
  { to: '/customers', label: 'Customers', icon: Users, permission: 'MANAGE_USERS' },
  { to: '/categories', label: 'Categories', icon: FolderTree, permission: 'MANAGE_VENDORS' },
  { to: '/tags', label: 'Tags', icon: Tags, permission: 'MANAGE_VENDORS' },
  { to: '/support', label: 'Support', icon: LifeBuoy, permission: 'MANAGE_SUPPORT' },
  { to: '/chat', label: 'Chat oversight', icon: MessagesSquare, permission: 'MANAGE_SUPPORT' },
  { to: '/ratings', label: 'Ratings', icon: Star, permission: 'MANAGE_SUPPORT' },
  { to: '/callbacks', label: 'Callbacks', icon: PhoneCall, permission: 'MANAGE_SUPPORT' },
  { to: '/requests', label: 'Requests', icon: ClipboardList, permission: 'MANAGE_SUPPORT' },
  { to: '/marketing', label: 'Marketing', icon: Megaphone, permission: 'MANAGE_SETTINGS' },
  { to: '/profile', label: 'My profile', icon: UserCircle, permission: 'ALL' },
];

export const Sidebar = () => {
  const permissions = useAuthStore((s) => s.user?.permissions);
  const canSeeVendors = hasPermission(permissions, 'MANAGE_VENDORS');
  // Only fetches when the user can actually see the Vendors nav.
  const { data: vendorCounts } = useVendorStatusCounts({ enabled: canSeeVendors });
  const pendingVendors = canSeeVendors ? (vendorCounts?.PENDING_APPROVAL ?? 0) : 0;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.permission === 'ALL' ? true : hasPermission(permissions, item.permission),
  );

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-bg-surface lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-16 items-center px-5">
          <Logo size={28} />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Sidebar navigation">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
                  isActive ? 'bg-brand-soft text-brand-strong' : 'text-text-muted hover:bg-bg-muted hover:text-text-primary',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/vendors' && pendingVendors > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-text-onBrand">
                      {pendingVendors > 99 ? '99+' : pendingVendors}
                    </span>
                  )}
                  {isActive && <span className="sr-only"> (current page)</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <p className="text-xs text-text-placeholder">MySooq Admin · v1.0</p>
        </div>
      </div>
    </aside>
  );
};
