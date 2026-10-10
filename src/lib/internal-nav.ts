import type { AuthUser } from '@/lib/auth-types';
import { isInternalAdmin, isPlatformOwner } from '@/lib/internal-auth';

export type InternalNavItem = {
  href: string;
  label: string;
  ownerOnly?: boolean;
  writeOnly?: boolean;
};

export const INTERNAL_NAV: InternalNavItem[] = [
  { href: '/internal', label: 'Home' },
  { href: '/internal/factories', label: 'Factories' },
  { href: '/internal/alerts', label: 'Alerts' },
  { href: '/internal/shift-reports', label: 'Email cron (shift reports)' },
  { href: '/internal/nodes', label: 'Nodes' },
  { href: '/internal/health', label: 'System health' },
  { href: '/internal/onboard', label: 'Onboard', writeOnly: true },
  { href: '/internal/features', label: 'Feature flags', writeOnly: true },
  { href: '/internal/users', label: 'Users' },
  { href: '/internal/audit', label: 'Audit log', ownerOnly: true },
];

export function visibleInternalNav(user: Pick<AuthUser, 'role'> | null | undefined): InternalNavItem[] {
  if (!user) return [];
  return INTERNAL_NAV.filter((item) => {
    if (item.ownerOnly && !isPlatformOwner(user)) return false;
    if (item.writeOnly && !isInternalAdmin(user)) return false;
    return true;
  });
}
