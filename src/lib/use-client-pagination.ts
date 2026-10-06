'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  LIMIT_PARAM,
  PAGE_PARAM,
  type PageSize,
  resolvePagination,
} from '@/lib/pagination';

/** In-app listeners for replaceState pagination (no Next router). */
const urlSearchListeners = new Set<() => void>();

function subscribeUrlSearch(onStoreChange: () => void) {
  urlSearchListeners.add(onStoreChange);
  return () => urlSearchListeners.delete(onStoreChange);
}

function getUrlSearchSnapshot(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

function notifyUrlSearchChange() {
  for (const listener of urlSearchListeners) listener();
}

/**
 * Page/limit from the URL without triggering Next.js soft navigation.
 * Updates via history.replaceState (preserving Next's history.state) so
 * pagination never sets isNavigating / "Updating…", even when the RSC
 * flight would otherwise abort while the API is already fast.
 */
export function useClientPagination() {
  const pathname = usePathname();
  const serverParams = useSearchParams();
  const serverSearch = serverParams.toString();

  const urlSearch = useSyncExternalStore(
    subscribeUrlSearch,
    getUrlSearchSnapshot,
    () => serverSearch,
  );

  // After a real router navigation (date range, etc.), sync subscribers.
  useEffect(() => {
    notifyUrlSearchChange();
  }, [serverSearch]);

  useEffect(() => {
    const onPopState = () => notifyUrlSearchChange();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const params = new URLSearchParams(urlSearch || serverSearch);
  const { page, limit, offset } = resolvePagination({
    page: params.get(PAGE_PARAM) ?? undefined,
    limit: params.get(LIMIT_PARAM) ?? undefined,
  });

  const setPaginationParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      const current = window.location.pathname + window.location.search;
      if (href === current) return;

      window.history.replaceState(window.history.state, '', href);
      notifyUrlSearchChange();
    },
    [pathname],
  );

  return {
    page,
    limit: limit as PageSize,
    offset,
    setPaginationParams,
  };
}
