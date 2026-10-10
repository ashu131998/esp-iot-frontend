import type { AuthUser, Role } from '@/lib/auth-types';

export const STAFF_ROLES: Role[] = ['super_admin', 'internal_admin', 'internal_viewer'];

export function isStaffRole(role: string | undefined): boolean {
  return STAFF_ROLES.includes(role as Role);
}

export function isInternalStaff(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  return isStaffRole(user?.role);
}

export function isPlatformOwner(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  return user?.role === 'super_admin';
}

export function isInternalAdmin(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  return user?.role === 'internal_admin' || user?.role === 'super_admin';
}

/** Factory dashboard mutations (config, team, etc.) — not internal read-only staff. */
export function canWriteFactoryDashboard(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'admin') return true;
  return false;
}

export function staffHomePath(): string {
  return '/internal';
}
