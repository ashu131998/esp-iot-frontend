'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import type { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';

/** The whole page, its data included (a link's own prefetch stops at the page's skeleton). */
const WHOLE = { kind: 'full' as PrefetchKind };

/** Someone who asked their phone to save data, or is on a 2G link, is not sent pages they did not ask for. */
export function savingData(connection: { saveData?: boolean; effectiveType?: string } | null | undefined): boolean {
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? '');
}

/** Fetch a page ahead of the tap that opens it; the router keeps it a few minutes (next.config staleTimes). */
export function usePrefetchPage(): (href: string) => void {
  const router = useRouter();
  return useCallback((href: string) => {
    try {
      router.prefetch(href, WHOLE);
    } catch {
      // a page that cannot be fetched ahead is fetched when it is opened
    }
  }, [router]);
}

/**
 * The pages a tap is most likely to open next (the phone's bottom bar), fetched ahead once the page
 * shown has had `delayMs` to load its own data, so a tap on one shows it at once. Not on a
 * data-saving or 2G connection, nor while the app is in the background.
 */
export function usePrefetchPages(hrefs: readonly string[], current: string, delayMs = 1500): void {
  const prefetch = usePrefetchPage();
  const key = hrefs.join(' ');
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (savingData(connection) || document.visibilityState !== 'visible') return;
    const id = window.setTimeout(() => {
      for (const href of key.split(' ')) if (href && href !== current) prefetch(href);
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [key, current, delayMs, prefetch]);
}
