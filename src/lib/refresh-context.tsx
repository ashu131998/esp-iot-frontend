'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface RefreshInfo {
  lastUpdatedAt: number;
  intervalSec: number;
}

interface RefreshContextValue {
  info: RefreshInfo | null;
  setInfo: (info: RefreshInfo | null) => void;
  paused: boolean;
  setPaused: (v: boolean) => void;
  getIsPaused: () => boolean;
}

const RefreshContext = createContext<RefreshContextValue>({
  info: null,
  setInfo: () => {},
  paused: false,
  setPaused: () => {},
  getIsPaused: () => false,
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [info, setInfoState] = useState<RefreshInfo | null>(null);
  const [paused, setPausedState] = useState(false);
  const isPausedRef = useRef(false);

  const setInfo = useCallback((v: RefreshInfo | null) => setInfoState(v), []);

  const setPaused = useCallback((v: boolean) => {
    isPausedRef.current = v;
    setPausedState(v);
  }, []);

  // Stable getter — reads the ref synchronously so refetchInterval functions
  // always see the current paused state without waiting for a React re-render.
  const getIsPaused = useCallback(() => isPausedRef.current, []);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && info) {
        const elapsed = (Date.now() - info.lastUpdatedAt) / 1000;
        if (elapsed >= info.intervalSec) {
          // Update the ref synchronously before React Query can re-evaluate
          // refetchInterval, then cancel any in-flight background fetch it
          // already triggered.
          isPausedRef.current = true;
          setPausedState(true);
          queryClient.cancelQueries();
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [info, queryClient]);

  return (
    <RefreshContext.Provider value={{ info, setInfo, paused, setPaused, getIsPaused }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefreshInfo() {
  return useContext(RefreshContext).info;
}

export function useRefreshPaused() {
  const { paused, setPaused } = useContext(RefreshContext);
  return { paused, setPaused };
}

/** Register this dashboard's refresh timing so the toolbar countdown stays in sync. */
export function useSetRefreshInfo(lastUpdatedAt: number, intervalSec: number) {
  const { setInfo } = useContext(RefreshContext);
  useEffect(() => {
    setInfo({ lastUpdatedAt, intervalSec });
    return () => setInfo(null);
  }, [lastUpdatedAt, intervalSec, setInfo]);
}

/**
 * Returns a stable refetchInterval function for useSuspenseQuery.
 * Returns false while the refresh is paused (tab-return gate), otherwise
 * returns the given interval in ms.
 */
export function useRefetchInterval(intervalMs: number): () => number | false {
  const { getIsPaused } = useContext(RefreshContext);
  return useCallback(
    () => (getIsPaused() ? false : intervalMs),
    [getIsPaused, intervalMs],
  );
}
