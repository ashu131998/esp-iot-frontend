'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { useImsQueueMaybe } from '@/components/ims-app/queue-context';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

/**
 * Signing out of FloorBeat IMS: the app's address then shows the sign-in (middleware.ts). Scans not sent
 * yet stay on the phone (they go after the next sign-in), so the person is asked first.
 */
export function ImsSignOut({ className, withText = false }: { className?: string; withText?: boolean }) {
  const { t, tn } = useT();
  const { logout } = useAuth();
  const queue = useImsQueueMaybe();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    const unsent = queue?.waiting ?? 0;
    if (unsent > 0 && !window.confirm(tn(unsent, '{count} scan is not sent yet. It stays on this phone and is sent after the next sign-in. Sign out?', '{count} scans are not sent yet. They stay on this phone and are sent after the next sign-in. Sign out?', { count: unsent }))) return;
    const photos = queue?.photosWaiting ?? 0;
    if (unsent === 0 && photos > 0 && !window.confirm(tn(photos, '{count} photo is not sent yet. It stays on this phone and is sent after the next sign-in. Sign out?', '{count} photos are not sent yet. They stay on this phone and are sent after the next sign-in. Sign out?', { count: photos }))) return;
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
