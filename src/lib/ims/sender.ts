/**
 * Sending the phone's queued scans (lib/ims/queue.ts) to POST …/ims/movements, batch by batch, until
 * none is left to send or something stops it. Where the queue is kept and how a batch is posted are
 * given (lib/ims/queue-store.ts and lib/ims/api.ts), so this is tested without a phone or a server.
 *
 * The queue is read again after each answer, so a scan added while a batch was on its way is never
 * lost or sent as if it were answered.
 */
import { ImsApiError, isImsOff } from './api';
import { applyResults, nextBatch, type Movement, type MovementResult, type Queued } from './queue';

export interface QueueStorage {
  load(): Queued[];
  save(queue: Queued[]): void;
}

/**
 * Why sending stopped with scans still waiting:
 *  - offline: no connection, or the server did not answer (tried again later, by itself);
 *  - signed_out: the session is over (sign in again; the scans wait);
 *  - off: the IMS is not switched on for the factory;
 *  - denied: the account may not scan (FloorBeat staff, a disabled account);
 *  - refused: the server turned the whole batch down (a bug of ours: the scans wait, nothing is lost).
 */
export type SendStop = 'offline' | 'signed_out' | 'off' | 'denied' | 'refused';

export interface SendReport {
  /** Scans the server took (ok, or had already). */
  sent: number;
  /** Scans the server took but that changed less than they said (a newer scan was there first). */
  stale: MovementResult[];
  /** Why it stopped before the queue was empty, or null. */
  stop: SendStop | null;
}

/** Why a failed post stopped the sending. */
export function stopFor(error: unknown): SendStop {
  if (!(error instanceof ImsApiError)) return 'offline';
  // signed out, or the page's CSRF cookie gone: opening the app again fixes both
  if (error.status === 401 || (error.status === 403 && /csrf/i.test(error.message))) return 'signed_out';
  if (isImsOff(error)) return 'off';
  if (error.status === 403) return 'denied';
  if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) return 'refused';
  return 'offline';
}

/** Sends what waits, batch after batch; never throws (what stopped it is in the report). */
export async function sendQueue(
  storage: QueueStorage,
  post: (movements: Movement[]) => Promise<MovementResult[]>,
  { batchSize, maxRounds = 20 }: { batchSize?: number; maxRounds?: number } = {},
): Promise<SendReport> {
  const report: SendReport = { sent: 0, stale: [], stop: null };
  for (let round = 0; round < maxRounds; round++) {
    const batch = nextBatch(storage.load(), batchSize);
    if (batch.length === 0) return report;
    let results: MovementResult[];
    try {
      results = await post(batch);
    } catch (error) {
      report.stop = stopFor(error);
      return report;
    }
    const before = storage.load();
    const after = applyResults(before, results);
    storage.save(after);
    const answered = new Set(results.map((r) => r.client_id.toLowerCase()));
    const left = new Set(after.map((q) => q.movement.client_id.toLowerCase()));
    report.sent += before.filter((q) => answered.has(q.movement.client_id.toLowerCase()) && !left.has(q.movement.client_id.toLowerCase())).length;
    report.stale.push(...results.filter((r) => r.status === 'ok' && r.stale));
    // an answer that named none of the batch would send the same batch for ever
    if (!batch.some((m) => answered.has(m.client_id.toLowerCase()))) {
      report.stop = 'refused';
      return report;
    }
  }
  return report;
}
