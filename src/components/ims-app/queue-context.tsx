'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { imsApi } from '@/lib/ims/api';
import { answersFrom, enqueue, queueCounts, type Answer, type Movement, type MovementResult, type Queued } from '@/lib/ims/queue';
import { loadQueue, NO_QUEUE, queueStorage, saveQueue, subscribeQueue } from '@/lib/ims/queue-store';
import { sendQueue, type SendStop } from '@/lib/ims/sender';

/** Tried again by itself this often while scans wait and the connection or server was the problem. */
const RETRY_MS = 30_000;

interface ImsQueue {
  queue: Queued[];
  waiting: number;
  rejected: number;
  sending: boolean;
  /** Why the last sending stopped short, or null. */
  stop: SendStop | null;
  /** Taken, but a newer scan had changed the pallet already (shown once, then dismissed). */
  stale: MovementResult[];
  /** The server's answers to scans sent from this screen, kept after they leave the phone (by client_id). */
  answers: Record<string, Answer>;
  /** Keeps a scan on the phone and starts sending; false when the phone would not keep it. */
  add: (movement: Movement) => boolean;
  send: () => void;
  /** Takes a refused scan off the phone once the person has seen it. */
  remove: (clientId: string) => void;
  dismissStale: () => void;
}

const Ctx = createContext<ImsQueue | null>(null);

/**
 * The phone's unsent scans for the signed-in factory, and the sending of them: at once when one is
 * added, when the app comes back on screen or online, and every 30 s while the connection is the
 * problem. Lives in the app's frame, so sending goes on whichever tab is open. A stock-in that goes
 * through refreshes Available stock.
 */
export function ImsQueueProvider({ factoryId, children }: { factoryId: string; children: React.ReactNode }) {
  const client = useQueryClient();
  const queue = useSyncExternalStore(subscribeQueue, () => loadQueue(factoryId), () => NO_QUEUE);
  const [sending, setSending] = useState(false);
  const [stop, setStop] = useState<SendStop | null>(null);
  const [stale, setStale] = useState<MovementResult[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const running = useRef(false);
  const again = useRef(false);

  const send = useCallback(() => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setSending(true);
    void (async () => {
      try {
        do {
          again.current = false;
          const report = await sendQueue(queueStorage(factoryId), (movements) => imsApi.sendMovements(factoryId, movements));
          setStop(report.stop);
          if (report.results.length > 0) setAnswers((a) => ({ ...a, ...answersFrom(report.results) }));
          if (report.stale.length > 0) setStale((s) => [...s, ...report.stale]);
          if (report.sent > 0) void client.invalidateQueries({ queryKey: ['ims-stock', factoryId] });
          if (report.stop) break;
        } while (again.current);
      } finally {
        running.current = false;
        setSending(false);
      }
    })();
  }, [client, factoryId]);

  const add = useCallback((movement: Movement) => {
    const kept = saveQueue(factoryId, enqueue(loadQueue(factoryId), movement));
    if (kept) send();
    return kept;
  }, [factoryId, send]);

  const remove = useCallback((clientId: string) => {
    saveQueue(factoryId, loadQueue(factoryId).filter((q) => q.movement.client_id !== clientId));
  }, [factoryId]);

  const counts = queueCounts(queue);

  // on opening the app, coming back to it, and the connection coming back
  useEffect(() => {
    send();
    const onVisible = () => { if (document.visibilityState === 'visible') send(); };
    window.addEventListener('online', send);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', send);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [send]);

  // while the connection is the problem: again every 30 s (a refusal or a signed-out session waits for the person)
  useEffect(() => {
    if (counts.waiting === 0 || (stop !== null && stop !== 'offline')) return;
    const timer = setInterval(send, RETRY_MS);
    return () => clearInterval(timer);
  }, [counts.waiting, stop, send]);

  const value = useMemo<ImsQueue>(() => ({
    queue, waiting: counts.waiting, rejected: counts.rejected, sending, stop: counts.waiting > 0 ? stop : null, stale, answers,
    add, send, remove, dismissStale: () => setStale([]),
  }), [queue, counts.waiting, counts.rejected, sending, stop, stale, answers, add, send, remove]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useImsQueue(): ImsQueue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useImsQueue outside ImsQueueProvider');
  return value;
}

/** The queue when there may be no provider (the sign-out button on the no-factory screen). */
export function useImsQueueMaybe(): ImsQueue | null {
  return useContext(Ctx);
}
