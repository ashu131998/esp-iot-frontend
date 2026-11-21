'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

import { alertsApi } from './api';
import { ALERTS_QUERY_KEY, appBase } from './model';

/**
 * The inbox: refreshed when a push arrives (shell.tsx), when the app comes to the front, and every
 * 20 seconds while it is on screen, so a push whose word to the page went missing still shows soon.
 */
export const INBOX_REFRESH_MS = 20_000;

export function useMyAlerts() {
  return useQuery({
    queryKey: ALERTS_QUERY_KEY,
    queryFn: ({ signal }) => alertsApi.alerts({ limit: 100 }, signal),
    refetchInterval: INBOX_REFRESH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/** A link inside the app: plain on alerts.floorbeat.in, under /alerts-app when opened there (model.ts appBase). */
export function useAppHref(): (path: string) => string {
  const base = appBase(usePathname());
  return useCallback((path: string) => `${base}${path === '/' && base ? '' : path}` || '/', [base]);
}
