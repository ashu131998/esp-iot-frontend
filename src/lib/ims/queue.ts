/**
 * The scans waiting on the phone to be sent (POST …/ims/movements). Each scan has an id made on the
 * phone (client_id), so sending it twice is counted once. The server answers each one: ok and
 * duplicate leave the queue; rejected stays, with the reason, until someone looks at it. A scan is
 * never dropped quietly. Pure functions: where the queue is kept (IndexedDB) is the caller's.
 */

export type MovementType = 'in' | 'move' | 'out' | 'transfer' | 'count' | 'adjust';

export interface Movement {
  client_id: string;
  type: MovementType;
  pallet?: string;
  product?: string;
  specs?: Record<string, string>;
  qty?: number | null;
  from?: string;
  to?: string;
  from_pallet?: string;
  to_pallet?: string;
  order_ref?: string;
  reason?: string;
  photo_ids?: string[];
  /** When it was scanned on the phone (ISO), not when it reached the server. */
  scanned_at: string;
}

export interface Queued {
  movement: Movement;
  /** Set once the server refused it: shown to the person, kept until they clear it. */
  rejected?: string;
}

export type MovementResult =
  | { client_id: string; status: 'ok' | 'duplicate' }
  | { client_id: string; status: 'rejected'; reason: string };

/** At most this many scans go in one request. */
export const BATCH_SIZE = 50;

/** A scan added at the end (the same client_id twice is kept once). */
export function enqueue(queue: Queued[], movement: Movement): Queued[] {
  if (queue.some((q) => q.movement.client_id === movement.client_id)) return queue;
  return [...queue, { movement }];
}

/** The next scans to send, oldest first: those the server has not refused. */
export function nextBatch(queue: Queued[], size = BATCH_SIZE): Movement[] {
  return queue.filter((q) => !q.rejected).slice(0, size).map((q) => q.movement);
}

/** The queue after the server's answer: ok and duplicate leave, rejected stay with their reason; unanswered stay to send again. */
export function applyResults(queue: Queued[], results: MovementResult[]): Queued[] {
  const byId = new Map(results.map((r) => [r.client_id, r]));
  const out: Queued[] = [];
  for (const q of queue) {
    const r = byId.get(q.movement.client_id);
    if (!r) out.push(q);
    else if (r.status === 'rejected') out.push({ ...q, rejected: r.reason || 'Refused' });
    // ok / duplicate: sent
  }
  return out;
}

/** How many wait to be sent, and how many the server refused. */
export function queueCounts(queue: Queued[]): { waiting: number; rejected: number } {
  const rejected = queue.filter((q) => q.rejected).length;
  return { waiting: queue.length - rejected, rejected };
}
