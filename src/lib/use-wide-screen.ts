'use client';

import { useSyncExternalStore } from 'react';

const WIDE = '(min-width: 640px)'; // Tailwind's sm

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * False on a phone held upright (below sm), true from sm up and in landscape. Charts are
 * left out on phones: not hidden but never mounted, so their library and their data are
 * not downloaded. False in the server render; corrected right after hydration.
 */
export function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}
