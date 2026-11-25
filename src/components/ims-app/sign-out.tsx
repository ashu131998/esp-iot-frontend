'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

/** Signing out of FloorBeat IMS: the app's address then shows the sign-in (middleware.ts). */
export function ImsSignOut({ className, withText = false }: { className?: string; withText?: boolean }) {
  const { t } = useT();
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await logout();
    } finally {
      window.location.replace('/');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      aria-label={t('Sign out')}
      className={cn('flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted hover:bg-slate-100 disabled:opacity-50', className)}
    >
      <LogOut className="h-5 w-5" aria-hidden />
      {withText && <span>{busy ? t('Signing out…') : t('Sign out')}</span>}
    </button>
  );
}
