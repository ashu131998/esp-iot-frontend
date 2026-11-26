/**
 * Where the phone keeps its unsent scans: the browser's local storage, one list per factory. It stays
 * when the app is closed or the phone restarts (a Home Screen app keeps its own storage), and every
 * write is whole, so two tabs never half-write it. Scans are small; a day of them is a few hundred KB
 * at most.
 *
 * Screens listen for changes (subscribe): a scan added on Stock in shows at once wherever the count is
 * shown, and so does one sent in the background or in another tab.
 */
import type { Queued } from './queue';
import type { QueueStorage } from './sender';

const PREFIX = 'fb_ims_queue:';
const EMPTY: Queued[] = [];

export const queueKey = (factoryId: string) => `${PREFIX}${factoryId}`;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;   // storage switched off
  }
}

/** Kept lists by text, so a list read twice is the same object (what useSyncExternalStore needs). */
const cache = new Map<string, { text: string | null; queue: Queued[] }>();

function isQueued(value: unknown): value is Queued {
  const m = (value as Queued | null)?.movement;
  return Boolean(m && typeof m.client_id === 'string' && typeof m.type === 'string' && typeof m.pallet === 'string');
}

/** What was kept, read whole; anything not a scan is left out (never thrown on). */
export function parseKept(text: string | null): Queued[] {
  if (!text) return EMPTY;
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? value.filter(isQueued) : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function loadQueue(factoryId: string): Queued[] {
  const key = queueKey(factoryId);
  const text = storage()?.getItem(key) ?? null;
  const kept = cache.get(key);
  if (kept && kept.text === text) return kept.queue;
  const queue = parseKept(text);
  cache.set(key, { text, queue });
  return queue;
}

const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

/** Keeps the list; false when the phone would not (storage full or switched off): the screen says so. */
export function saveQueue(factoryId: string, queue: Queued[]): boolean {
  const store = storage();
  if (!store) return false;
  try {
    if (queue.length === 0) store.removeItem(queueKey(factoryId));
    else store.setItem(queueKey(factoryId), JSON.stringify(queue));
    return true;
  } catch {
    return false;
  } finally {
    changed();
  }
}

/** Called on any change to the kept scans, here or in another tab; returns the way to stop. */
export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  const other = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', other);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', other);
  };
}

export function queueStorage(factoryId: string): QueueStorage {
  return { load: () => loadQueue(factoryId), save: (queue) => void saveQueue(factoryId, queue) };
}

export const NO_QUEUE = EMPTY;
