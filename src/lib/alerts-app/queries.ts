'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

import { alertsApi } from './api';
import { ALERTS_QUERY_KEY, appBase } from './model';

/** The inbox: refreshed every minute, when the app comes to the front, and when a push arrives (shell.tsx). */
export function useMyAlerts() {
  return useQuery({
    queryKey: ALERTS_QUERY_KEY,
    queryFn: ({ signal }) => alertsApi.alerts({ limit: 100 }, signal),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/** A link inside the app: plain on alerts.floorbeat.in, under /alerts-app when opened there (model.ts appBase). */
export function useAppHref(): (path: string) => string {
  const base = appBase(usePathname());
  return useCallback((path: string) => `${base}${path === '/' && base ? '' : path}` || '/', [base]);
}
