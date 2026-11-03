'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State kept in this browser's localStorage under `key`, so a half-filled form survives a reload,
 * a closed tab or a dropped connection (filling it in on site at a factory). It is read after
 * mounting, since the server render cannot see it: `ready` is false until then. `revive` merges
 * what was stored into the current shape (an older draft may lack newer fields). Never throws:
 * blocked or full storage just stops saving.
 */
export function useStoredState<T>(
  key: string,
  initial: () => T,
  revive: (stored: unknown, fresh: T) => T = (stored) => stored as T,
) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const fresh = useRef(initial);
  const reviveRef = useRef(revive);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(reviveRef.current(JSON.parse(raw), fresh.current()));
    } catch {
      /* blocked or unreadable: start fresh */
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* full or blocked: keep going without saving */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [key, value, ready]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to clear */
    }
    setValue(fresh.current());
  }, [key]);

  return { value, set: setValue, ready, clear };
}
