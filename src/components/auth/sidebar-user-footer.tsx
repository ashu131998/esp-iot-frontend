'use client';

import { LogOut } from 'lucide-react';

import { LanguageToggle } from '@/components/ui/language-toggle';
import { useAuth } from '@/lib/auth-context';
import type { AuthUser } from '@/lib/auth-types';
import { useT } from '@/lib/i18n/context';
import { isStaffRole } from '@/lib/internal-auth';

function loginPathFor(user: AuthUser | null, factoryId?: string): string {
  if (user && isStaffRole(user.role)) return '/internal/login';
  if (user?.factory_id) return `/f/${user.factory_id}/login`;
  if (factoryId) return `/f/${factoryId}/login`;
  return '/internal/login';
}

function useSignOut(factoryId?: string) {
  const { user, logout } = useAuth();

  return async () => {
    const redirect = loginPathFor(user, factoryId);
    await logout();
    window.location.href = redirect;
  };
}

export function SignOutButton({
  factoryId,
  className,
}: {
  factoryId?: string;
  className?: string;
}) {
  const { user, loading } = useAuth();
  const { t } = useT();
  const signOut = useSignOut(factoryId);

  if (loading || !user) return null;

  return (
    <button
      type="button"
      onClick={signOut}
      className={
        className ??
        'flex items-center gap-1.5 text-sm text-muted hover:text-foreground'
      }
    >
      <LogOut className="h-4 w-4" />
      {t('Sign out')}
    </button>
  );
}

export function SidebarUserFooter({ factoryId, children }: { factoryId?: string; children?: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useT();
  const signOut = useSignOut(factoryId);

  if (loading || !user) return null;
  const initial = (user.username || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-3 border-t border-gray-100 p-3">
      {children}
      <LanguageToggle fill className="border-gray-200" />
      <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{user.username}</p>
          <p className="truncate text-xs text-muted">{t('Signed in')}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          aria-label={t('Sign out')}
          title={t('Sign out')}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-gray-50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
