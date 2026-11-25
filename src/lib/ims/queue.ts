/**
 * The scans waiting on the phone to be sent (POST …/ims/movements). Each scan has an id made on the
 * phone (client_id), so sending it twice is counted once. The server answers each one:
 *  - ok: done, it leaves the queue;
 *  - rejected (with a reason): nothing changed, it stays, marked, until the person has seen it;
 *  - duplicate: the server had it already (the phone missed the first answer). It carries what became
 *    of it then (outcome): ok leaves the queue, rejected stays marked as above, so a refusal is never
 *    lost to a retry.
 * A scan is never dropped quietly. Pure functions: where the queue is kept (IndexedDB) is the caller's.
 * The scan's shape is the API's (query-api ims.js parseMovement).
 */

export type MovementType = 'in' | 'move' | 'out' | 'count' | 'adjust';

/** Why a quantity was fixed after a count (query-api ims.js ADJUST_REASONS). */
export type AdjustReason = 'damaged' | 'taken_without_scan' | 'count_was_wrong' | 'missing' | 'other';

export interface Movement {
  client_id: string;
  type: MovementType;
  /** The pallet's label code. */
  pallet: string;
  /** When it was scanned on the phone (ISO), not when it reached the server. */
  scanned_at: string;
  /** in: the product, its specs if this pallet's differ, batch and production day. */
  product_id?: string;
  specs?: Record<string, string>;
  batch?: string;
  produced_on?: string;
  /** in, move: the location's code (R03-C05). */
  to?: string;
  /** move part of a pallet onto another pallet (split or merge). */
  to_pallet?: string;
  /** in: null or left out = not counted; out and a part move: how many; count and adjust: what is there. */
  qty?: number | null;
  /** out: the order. */
  order_ref?: string;
  /** out: free text; adjust: one of AdjustReason. */
  reason?: string;
  /** adjust: a note, needed with "other". */
  note?: string;
  /** count: the location it was counted at. */
  at?: string;
  photo_ids?: string[];
}

export interface Refusal {
  /** The server's reason key (query-api ims.js REJECT_REASONS: already_stocked, pallet_closed…). */
  reason: string;
  /** The server's own words, shown when the app has none of its own for the reason. */
  message: string | null;
}

export interface Queued {
  movement: Movement;
  /** Set once the server refused it: shown to the person, kept until they clear it. */
  rejected?: Refusal;
}

export interface MovementResult {
  client_id: string;
  status: 'ok' | 'duplicate' | 'rejected';
  /** For a duplicate: what became of the scan the first time ('ok' or 'rejected'). */
  outcome?: 'ok' | 'rejected';
  reason?: string;
  message?: string;
  /** ok, but older than what the pallet already had: it changed less (the pallet is marked to count). */
  stale?: boolean;
}

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

/** Whether the server refused the scan, now or the first time it had it. */
function refusal(r: MovementResult): Refusal | null {
  const refused = r.status === 'rejected' || (r.status === 'duplicate' && r.outcome === 'rejected');
  return refused ? { reason: r.reason || 'refused', message: r.message ?? null } : null;
}

/** The queue after the server's answer: done ones leave, refused ones stay marked, unanswered stay to send again. */
export function applyResults(queue: Queued[], results: MovementResult[]): Queued[] {
  const byId = new Map(results.map((r) => [r.client_id.toLowerCase(), r]));
  const out: Queued[] = [];
  for (const q of queue) {
    const r = byId.get(q.movement.client_id.toLowerCase());
    if (!r) {
      out.push(q);
      continue;
    }
    const refused = refusal(r);
    if (refused) out.push({ ...q, rejected: refused });
    // ok, or a duplicate of one that went through: sent
  }
  return out;
}

/** How many wait to be sent, and how many the server refused. */
export function queueCounts(queue: Queued[]): { waiting: number; rejected: number } {
  const rejected = queue.filter((q) => q.rejected).length;
  return { waiting: queue.length - rejected, rejected };
}
