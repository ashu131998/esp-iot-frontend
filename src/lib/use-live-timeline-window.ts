'use client';

import { useEffect, useMemo, useState } from 'react';

/** Rolling [from, to] window anchored to the client clock (updates every second). */
export function useLiveTimelineWindow(hours: number) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const to = new Date(nowMs).toISOString();
    const from = new Date(nowMs - hours * 3_600_000).toISOString();
    return { from, to, nowMs };
  }, [hours, nowMs]);
}
