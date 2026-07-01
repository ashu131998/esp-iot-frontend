'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { useRefreshPaused } from '@/lib/refresh-context';

const REFRESH_INTERVAL_SEC = 30;

/** Circular countdown synced to the last data fetch timestamp. */
export function RefreshCountdown({
  intervalSec = REFRESH_INTERVAL_SEC,
  lastUpdatedAt,
}: {
  intervalSec?: number;
  lastUpdatedAt: number;
}) {
  const queryClient = useQueryClient();
  const { paused, setPaused } = useRefreshPaused();

  const [remaining, setRemaining] = useState(() =>
    Math.min(intervalSec, Math.max(0, intervalSec - Math.floor((Date.now() - lastUpdatedAt) / 1000)))
  );

  useEffect(() => {
    const computeRemaining = () => {
      const elapsed = Math.floor((Date.now() - lastUpdatedAt) / 1000);
      return Math.min(Math.max(intervalSec - elapsed, 0), intervalSec);
    };

    setRemaining(computeRemaining());

    const tick = setInterval(() => {
      setRemaining(computeRemaining());
    }, 1000);

    // When the tab becomes visible again the browser may have throttled the
    // interval so the display can be stuck at 0. Recompute immediately on focus.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setRemaining(computeRemaining());
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalSec, lastUpdatedAt]);

  if (paused) {
    return (
      <button
        type="button"
        onClick={() => {
          setPaused(false);
          queryClient.invalidateQueries();
        }}
        className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </button>
    );
  }

  const isRefreshing = remaining === 0;
  const progress     = ((intervalSec - remaining) / intervalSec) * 100;
  const radius       = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset   = circumference - (progress / 100) * circumference;

  return (
    <div className="flex items-center gap-2 text-xs text-muted" title="Auto-refresh countdown">
      <div className="relative flex h-10 w-10 items-center justify-center">
        <svg className="-rotate-90" width="40" height="40" viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke={isRefreshing ? '#94a3b8' : '#3b82f6'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute text-[11px] font-semibold tabular-nums text-foreground">
          {isRefreshing ? '↻' : remaining}
        </span>
      </div>
      <span className="hidden sm:inline">
        {isRefreshing ? 'Updating…' : `Refreshing in ${remaining}s`}
      </span>
    </div>
  );
}

export const UPTIME_REFRESH_MS = REFRESH_INTERVAL_SEC * 1000;
