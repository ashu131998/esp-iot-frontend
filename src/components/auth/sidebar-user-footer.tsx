'use client';

import { LogOut } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import type { AuthUser } from '@/lib/auth-types';

function loginPathFor(user: AuthUser | null, factoryId?: string): string {
  if (user?.role === 'super_admin') return '/admin/login';
  if (user?.factory_id) return `/f/${user.factory_id}/login`;
  if (factoryId) return `/f/${factoryId}/login`;
  return '/admin/login';
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
      Sign out
    </button>
  );
}

export function SidebarUserFooter({ factoryId }: { factoryId?: string }) {
  const { user, loading } = useAuth();
  const signOut = useSignOut(factoryId);

  if (loading || !user) return null;

  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="mb-2 truncate text-xs text-slate-400">Signed in as {user.username}</p>
      <button
        type="button"
        onClick={signOut}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
