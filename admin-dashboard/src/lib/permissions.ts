export type AdminPermission =
  | 'ALL'
  | 'MANAGE_USERS'
  | 'MANAGE_VENDORS'
  | 'MANAGE_FINANCE'
  | 'MANAGE_SUPPORT'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_STAFF';

export const PERMISSIONS: Record<string, AdminPermission> = {
  ALL: 'ALL',
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_VENDORS: 'MANAGE_VENDORS',
  MANAGE_FINANCE: 'MANAGE_FINANCE',
  MANAGE_SUPPORT: 'MANAGE_SUPPORT',
  MANAGE_SETTINGS: 'MANAGE_SETTINGS',
  MANAGE_STAFF: 'MANAGE_STAFF',
};

export const hasPermission = (permissions: AdminPermission[] | null | undefined, permission: AdminPermission) => {
  if (!permissions) return true;
  return permissions.includes('ALL') || permissions.includes(permission);
};

export const hasAnyPermission = (
  permissions: AdminPermission[] | null | undefined,
  required: AdminPermission[],
) => {
  if (!permissions) return true;
  if (permissions.includes('ALL')) return true;
  return required.some((p) => permissions.includes(p));
};
