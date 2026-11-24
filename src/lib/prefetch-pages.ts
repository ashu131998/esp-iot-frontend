'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import type { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';

/** The whole page, its data included (a link's own prefetch stops at the page's skeleton). */
const WHOLE = { kind: 'full' as PrefetchKind };

/** Someone who asked their phone to save data, or is on a 2G link, is not sent pages they did not ask for. */
export function savingData(connection: { saveData?: boolean; effectiveType?: string } | null | undefined): boolean {
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? '');
}

type Connection = { saveData?: boolean; effectiveType?: string };
const connectionNow = (): Connection | undefined => (navigator as Navigator & { connection?: Connection }).connection;

/**
 * Fetch a page ahead of the tap that opens it; the router keeps it a few minutes (next.config staleTimes).
 * Not on a data-saving or 2G connection.
 */
export function usePrefetchPage(): (href: string) => void {
  const router = useRouter();
  return useCallback((href: string) => {
    if (savingData(connectionNow())) return;
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
 * data-saving or 2G connection, nor while the app is in the background, nor when `media` (a CSS media
 * query: the screens the bar is shown on) does not match: a computer, where the bar is hidden, was
 * fetching its pages all the same.
 */
export function usePrefetchPages(hrefs: readonly string[], current: string, delayMs = 1500, media?: string): void {
  const prefetch = usePrefetchPage();
  const key = hrefs.join(' ');
  useEffect(() => {
    if (savingData(connectionNow()) || document.visibilityState !== 'visible') return;
    if (media && !window.matchMedia(media).matches) return;
    const id = window.setTimeout(() => {
      for (const href of key.split(' ')) if (href && href !== current) prefetch(href);
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [key, current, delayMs, media, prefetch]);
}

/** How long a pointer must rest on a menu item before its page is fetched ahead. */
export const DWELL_MS = 120;

/**
 * Fetching a page ahead when the pointer rests on its menu item: `rest(href)` on entering (or focusing)
 * the item, `leave()` on leaving it. A pointer that only passes over the menu on its way somewhere else
 * fetches nothing: without the wait, crossing the menu asked the server for every page it crossed.
 */
export function usePrefetchOnRest(delayMs = DWELL_MS): { rest: (href: string) => void; leave: () => void } {
  const prefetch = usePrefetchPage();
  const timer = useRef<number | null>(null);
  const leave = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const rest = useCallback((href: string) => {
    leave();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      prefetch(href);
    }, delayMs);
  }, [leave, prefetch, delayMs]);
  useEffect(() => leave, [leave]);
  return { rest, leave };
}
