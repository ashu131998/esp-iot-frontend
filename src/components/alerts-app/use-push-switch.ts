'use client';

import { useCallback, useEffect, useState } from 'react';

import { alertsApi } from '@/lib/alerts-app/api';
import type { PushState } from '@/lib/alerts-app/push';
import { currentState, turnOff, turnOn } from '@/lib/alerts-app/push-client';

export type SwitchState = PushState | 'checking';
/** What the last action came to, for the component to say in the person's language. */
export type SwitchNote = 'enable-failed' | 'test-sent' | 'test-failed' | null;

/**
 * This phone's notifications switch: whether it will ring (lib/alerts-app/push.ts), and turning it
 * on, off, or sending a test. Shared by the inbox's prompt and the settings card.
 */
export function usePushSwitch() {
  const [state, setState] = useState<SwitchState>('checking');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<SwitchNote>(null);

  useEffect(() => {
    let live = true;
    currentState().then((s) => { if (live) setState(s); }, () => { if (live) setState('unsupported'); });
    return () => { live = false; };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      setState(await turnOn());
    } catch {
      setNote('enable-failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      await turnOff();
      setState('off');
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await alertsApi.testPush();
      setNote(result.sent > 0 ? 'test-sent' : 'test-failed');
    } catch {
      setNote('test-failed');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, note, enable, disable, test };
}
