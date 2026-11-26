/**
 * Where waiting photos are kept: the browser's IndexedDB (local storage is far too small for pictures). It
 * stays when the app is closed or the phone restarts. Browser only; null where IndexedDB is not there (a
 * private window), and the screen then sends the photo at once instead (photo-upload.ts).
 */
import type { PendingPhoto, PhotoStore } from './photo-queue';

const DB = 'fb_ims';
const STORE = 'photos';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('factoryId', 'factoryId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB did not open'));
      req.onblocked = () => reject(new Error('IndexedDB is blocked'));
    }).catch((error) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB stopped'));
  }));
}

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Told whenever a photo is added, sent or marked (in this page). */
export function subscribePhotos(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The phone's photo store, or null when this browser has no IndexedDB. */
export function photoStore(): PhotoStore | null {
  if (typeof indexedDB === 'undefined') return null;
  return {
    list: (factoryId) => run<PendingPhoto[]>('readonly', (s) => s.index('factoryId').getAll(factoryId)),
    put: async (photo) => { await run('readwrite', (s) => s.put(photo)); changed(); },
    remove: async (id) => { await run('readwrite', (s) => s.delete(id)); changed(); },
  };
}
