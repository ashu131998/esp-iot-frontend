'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';

import { isShown, type Display } from '@/lib/display';
import type { Machine, ProductionLine, Shift } from '@/lib/types';

export interface FactoryRefs {
  /** Machines for this factory (used by the machine selector). */
  machines: Machine[];
  /** Production lines for this factory (used to group machines). */
  lines: ProductionLine[];
  /** Factory `created_at`, used as the date-picker minimum. */
  minDate: string | null;
  /** Shift schedule; the default date range is the current shift. */
  shifts: Shift[];
  /** Pages and page sections switched on for this factory (lib/display.ts). */
  display: Display;
}

const FactoryRefsContext = createContext<FactoryRefs | null>(null);

/**
 * Holds factory reference data (machines, lines, created_at) fetched once in the
 * factory layout — which persists across page navigations — so the date toolbar
 * doesn't re-fetch it on every date change.
 */
export function FactoryRefsProvider({
  value,
  children,
}: {
  value: FactoryRefs;
  children: ReactNode;
}) {
  return <FactoryRefsContext.Provider value={value}>{children}</FactoryRefsContext.Provider>;
}

export function useFactoryRefs(): FactoryRefs {
  const ctx = useContext(FactoryRefsContext);
  if (!ctx) {
    throw new Error('useFactoryRefs must be used within a FactoryRefsProvider');
  }
  return ctx;
}

/** Non-throwing variant for components shared with non-factory pages (overview). */
export function useFactoryRefsOptional(): FactoryRefs | null {
  return useContext(FactoryRefsContext);
}

/**
 * `shown(key)`: whether this factory shows a page or page section, e.g.
 * `shown('production.chart')` or `shown('energy')`. Everything is shown outside
 * a factory (shared components on the platform pages).
 */
export function useShown(): (key: string) => boolean {
  const display = useContext(FactoryRefsContext)?.display;
  return useCallback((key: string) => isShown(display, key), [display]);
}
