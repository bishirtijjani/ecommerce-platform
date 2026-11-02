import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { hasPermission, type AdminPermission } from '../lib/permissions';

export const PermissionGate = ({
  permission,
  children,
  fallback,
}: {
  permission: AdminPermission;
  children: ReactNode;
  fallback?: ReactNode;
}) => {
  const permissions = useAuthStore((s) => s.user?.permissions);
  if (!hasPermission(permissions, permission)) return fallback ?? null;
  return <>{children}</>;
};
