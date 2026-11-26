'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { imsApi } from '@/lib/ims/api';
import { answersFrom, enqueue, queueCounts, type Answer, type Movement, type MovementResult, type Queued } from '@/lib/ims/queue';
import { photoFits, sendPhotos, type PendingPhoto } from '@/lib/ims/photo-queue';
import { photoStore, subscribePhotos } from '@/lib/ims/photo-store';
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
  /** Photos waiting on the phone, and those the server would not take (kept until removed). */
  photosWaiting: number;
  photosRefused: PendingPhoto[];
  /** Keeps a photo on the phone and starts sending: 'full' when the phone keeps too much already, 'no_store' without IndexedDB. */
  addPhoto: (photo: PendingPhoto) => Promise<'kept' | 'full' | 'no_store'>;
  removePhoto: (id: string) => void;
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
  const photos = useMemo(() => photoStore(), []);
  const [kept, setKept] = useState<PendingPhoto[]>([]);

  const readPhotos = useCallback(() => {
    if (!photos) return;
    photos.list(factoryId).then(setKept, () => setKept([]));
  }, [factoryId, photos]);

  useEffect(() => {
    readPhotos();
    return subscribePhotos(readPhotos);
  }, [readPhotos]);

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
          // photos after the scans: a stock-in shows at once, its photo follows
          if (photos) {
            const sentPhotos = await sendPhotos(photos, {
              links: imsApi.photoLinks, putJpeg: imsApi.putJpeg, uploaded: imsApi.photoUploaded,
            }, factoryId);
            if (sentPhotos.stop) {
              setStop(sentPhotos.stop);
              break;
            }
          }
        } while (again.current);
      } finally {
        running.current = false;
        setSending(false);
      }
    })();
  }, [client, factoryId, photos]);

  const add = useCallback((movement: Movement) => {
    const kept = saveQueue(factoryId, enqueue(loadQueue(factoryId), movement));
    if (kept) send();
    return kept;
  }, [factoryId, send]);

  const addPhoto = useCallback(async (photo: PendingPhoto) => {
    if (!photos) return 'no_store' as const;
    try {
      if (!photoFits(await photos.list(factoryId), photo)) return 'full' as const;
      await photos.put(photo);
    } catch {
      return 'full' as const;   // the browser would not keep it (storage full)
    }
    send();
    return 'kept' as const;
  }, [factoryId, photos, send]);

  const removePhoto = useCallback((id: string) => {
    void photos?.remove(id);
  }, [photos]);

  const remove = useCallback((clientId: string) => {
    saveQueue(factoryId, loadQueue(factoryId).filter((q) => q.movement.client_id !== clientId));
  }, [factoryId]);

  const counts = queueCounts(queue);
  const photosRefused = useMemo(() => kept.filter((p) => p.refused), [kept]);
  const photosWaiting = kept.length - photosRefused.length;
  const anyWaiting = counts.waiting + photosWaiting;

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
    if (anyWaiting === 0 || (stop !== null && stop !== 'offline')) return;
    const timer = setInterval(send, RETRY_MS);
    return () => clearInterval(timer);
  }, [anyWaiting, stop, send]);

  const value = useMemo<ImsQueue>(() => ({
    queue, waiting: counts.waiting, rejected: counts.rejected, sending, stop: anyWaiting > 0 ? stop : null, stale, answers,
    add, send, remove, dismissStale: () => setStale([]),
    photosWaiting, photosRefused, addPhoto, removePhoto,
  }), [queue, counts.waiting, counts.rejected, sending, stop, anyWaiting, stale, answers, add, send, remove, photosWaiting, photosRefused, addPhoto, removePhoto]);

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
