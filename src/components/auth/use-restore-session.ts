'use client';

import { useEffect, useState } from 'react';

import { noteRestore, shouldTryRestore } from '@/lib/auth-redirect';

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Before a phone app's sign-in form shows: a session may still be there (the page was opened from a
 * link or a notification without the strict cookies, or the 15-minute token ran out). It is renewed
 * once and `onRestored` moves on, without asking for the password. Returns true while that is tried.
 */
export function useRestoreSession(onRestored: () => void): boolean {
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const storage = safeSessionStorage();
    let cancelled = false;
    const renewed = shouldTryRestore(storage)
      ? fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' }).then((res) => res.ok, () => false)
      : Promise.resolve(false);
    renewed.then((ok) => {
      if (cancelled) return;
      if (ok) {
        noteRestore(storage);
        onRestored();
        return;
      }
      setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
    // Once, when the form first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return restoring;
}
