import { describe, expect, it } from 'vitest';

import { gu } from '@/lib/i18n/messages/gu';
import { hi } from '@/lib/i18n/messages/hi';
import { ImsApiError } from '@/lib/ims/api';
import { uuidFromBytes } from '@/lib/ims/client-id';
import { answersFrom, scanStatus, type Movement, type MovementResult, type Queued } from '@/lib/ims/queue';
import { parseKept } from '@/lib/ims/queue-store';
import { sendQueue, stopFor, type QueueStorage } from '@/lib/ims/sender';
import {
  REFUSAL_TEXT, checkLocation, isPalletLabelCode, latestProducedOn, matchProducts, offlinePalletScan, palletScanOutcome,
  parseQtyInput, producedOnOk, readCode, refusalWords, specsChange, stockInMovement, stockableProducts,
} from '@/lib/ims/stock-in';
import type { ApiLocation, ApiPallet, ApiProduct } from '@/lib/ims/types';

const product = (id: string, name: string, extra: Partial<ApiProduct> = {}): ApiProduct => ({
  product_id: id, sku: `SKU-${id}`, name, unit: 'boxes', tracking: 'quantity', specs: {}, active: true, ...extra,
});
const loc = (code: string, active = true): ApiLocation => ({ code, row: 1, column: 1, zone: null, name: null, active });
const LOCATIONS = [loc('R01-C01'), loc('R01-C02', false)];
const pallet = (extra: Partial<ApiPallet> = {}): ApiPallet => ({
  code: 'PL-000012', product_id: 'p1', specs: {}, qty: 40, status: 'in_stock', needs_count: false, batch: null, produced_on: null,
  stocked_at: '2026-11-20T10:00:00Z', closed_at: null, location: { code: 'R03-C05', row: 3, column: 5, zone: null, name: null }, ...extra,
});

describe('a scanned QR', () => {
  it('reads the bare code in any case, or the code at the end of a link', () => {
    expect(readCode('PL-000012')).toBe('PL-000012');
    expect(readCode('  r03-c05 \n')).toBe('R03-C05');
    expect(readCode('https://example.com/p/PL-000012')).toBe('PL-000012');
    expect(readCode('https://example.com/scan?code=r03-c05')).toBe('R03-C05');
  });

  it('is none of ours when it is not letters, digits and dashes up to 40', () => {
    expect(readCode('')).toBeNull();
    expect(readCode('hello world')).toBeNull();
    expect(readCode('-PL-1')).toBeNull();
    expect(readCode('A'.repeat(41))).toBeNull();
    expect(readCode('https://')).toBeNull();
  });

  it('a pallet label is PL- and six digits or more, as printed', () => {
    expect(isPalletLabelCode('PL-000012')).toBe(true);
    expect(isPalletLabelCode('PL-1234567')).toBe(true);
    expect(isPalletLabelCode('PL-0000012')).toBe(false);   // a typo would make a second pallet of one label
    expect(isPalletLabelCode('PL-000000')).toBe(false);
    expect(isPalletLabelCode('R03-C05')).toBe(false);
  });
});

describe('the pallet scan', () => {
  it('a new label goes on; one in stock says where it is; a closed one, a location or a stranger stops', () => {
    expect(palletScanOutcome({ kind: 'new_pallet', code: 'PL-000013' })).toEqual({ kind: 'new' });
    expect(palletScanOutcome({ kind: 'pallet', pallet: pallet(), product: null, photos: [] })).toEqual({ kind: 'in_stock', location: 'R03-C05' });
    expect(palletScanOutcome({ kind: 'pallet', pallet: pallet({ location: null }), product: null, photos: [] })).toEqual({ kind: 'in_stock', location: null });
    expect(palletScanOutcome({ kind: 'pallet', pallet: pallet({ status: 'closed' }), product: null, photos: [] })).toEqual({ kind: 'closed' });
    expect(palletScanOutcome({ kind: 'location', location: loc('R01-C01'), pallets: [] })).toEqual({ kind: 'location' });
    expect(palletScanOutcome({ kind: 'unknown', code: 'X1' })).toEqual({ kind: 'unknown' });
  });

  it('with no connection: a label in our form goes on (checked when sent); a known location does not', () => {
    expect(offlinePalletScan('PL-000013', LOCATIONS)).toEqual({ kind: 'new' });
    expect(offlinePalletScan('R01-C01', LOCATIONS)).toEqual({ kind: 'location' });
    expect(offlinePalletScan('BOX-7', LOCATIONS)).toEqual({ kind: 'unknown' });
  });
});

describe('the location scan', () => {
  it('is one of the factory\'s locations in use', () => {
    expect(checkLocation('R01-C01', LOCATIONS)).toBe('ok');
    expect(checkLocation('R01-C02', LOCATIONS)).toBe('not_in_use');
    expect(checkLocation('PL-000012', LOCATIONS)).toBe('pallet_label');
    expect(checkLocation('R09-C09', LOCATIONS)).toBe('unknown');
  });
});

describe('the product list', () => {
  const list = [product('b', 'Tile 600 Grey'), product('a', 'Tile 600 Black'), product('c', 'Old tile', { active: false })];

  it('shows products in use, by name', () => {
    expect(stockableProducts(list).map((p) => p.product_id)).toEqual(['a', 'b']);
  });

  it('finds by any words of the name or SKU', () => {
    expect(matchProducts(list, 'grey 600').map((p) => p.product_id)).toEqual(['b']);
    expect(matchProducts(list, 'sku-a').map((p) => p.product_id)).toEqual(['a']);
    expect(matchProducts(list, '  ')).toHaveLength(3);
  });
});

describe('the quantity typed', () => {
  it('empty is "not counted yet" (null, shown as —), never 0', () => {
    expect(parseQtyInput('')).toEqual({ ok: true, qty: null });
    expect(parseQtyInput('   ')).toEqual({ ok: true, qty: null });
  });

  it('takes a number above 0 with up to 3 decimals', () => {
    expect(parseQtyInput('40')).toEqual({ ok: true, qty: 40 });
    expect(parseQtyInput('12.5')).toEqual({ ok: true, qty: 12.5 });
    expect(parseQtyInput('0.125')).toEqual({ ok: true, qty: 0.125 });
  });

  it('refuses anything else', () => {
    for (const text of ['0', '0.000', '-3', '12.3456', 'abc', '1e3', '1,000', '12.', '1000000001']) {
      expect(parseQtyInput(text), text).toEqual({ ok: false });
    }
  });
});

describe('the production date', () => {
  // 20:00 UTC on 26 Nov is 01:30 on 27 Nov in India: tomorrow there is the 28th
  const now = new Date('2026-11-26T20:00:00Z');

  it('may be empty, or a real day up to tomorrow in factory time', () => {
    expect(latestProducedOn(now)).toBe('2026-11-28');
    expect(producedOnOk('', now)).toBe(true);
    expect(producedOnOk('2026-11-28', now)).toBe(true);
    expect(producedOnOk('2026-11-29', now)).toBe(false);
    expect(producedOnOk('2026-02-31', now)).toBe(false);
    expect(producedOnOk('26-11-2026', now)).toBe(false);
  });
});

describe('the stock-in sent', () => {
  const tile = product('p1', 'Tile', { specs: { colour: 'grey', grade: 'a' } });

  it('says only the specs that differ from the product\'s (null: one taken away)', () => {
    expect(specsChange(tile.specs, { colour: 'grey', grade: 'a' })).toBeUndefined();
    expect(specsChange(tile.specs, { colour: 'black', grade: 'a' })).toEqual({ colour: 'black' });
    expect(specsChange(tile.specs, { colour: 'grey', grade: null })).toEqual({ grade: null });
    expect(specsChange(tile.specs, { colour: 'grey', grade: 'a', size: null })).toBeUndefined();
    expect(specsChange(tile.specs, { colour: 'grey', grade: 'a', size: 'm' })).toEqual({ size: 'm' });
  });

  it('is the API\'s "in" scan, with its own id and the time it was made on the phone', () => {
    const now = new Date('2026-11-26T10:00:00Z');
    const m = stockInMovement({
      pallet: 'PL-000012', product: tile, location: 'R03-C05', qty: 40, specs: { colour: 'black', grade: 'a' }, batch: '  B 7 ', producedOn: '2026-11-25',
    }, 'c1', now);
    expect(m).toEqual({
      client_id: 'c1', type: 'in', pallet: 'PL-000012', scanned_at: '2026-11-26T10:00:00.000Z', product_id: 'p1', to: 'R03-C05', qty: 40,
      specs: { colour: 'black' }, batch: 'B 7', produced_on: '2026-11-25',
    });
  });

  it('an uncounted pallet is sent with qty null, and nothing that was left empty', () => {
    const m = stockInMovement({ pallet: 'PL-000012', product: tile, location: 'R03-C05', qty: null, specs: { colour: 'grey', grade: 'a' }, batch: '', producedOn: '' }, 'c2');
    expect(m.qty).toBeNull();
    expect('qty' in m).toBe(true);
    expect(m).not.toHaveProperty('specs');
    expect(m).not.toHaveProperty('batch');
    expect(m).not.toHaveProperty('produced_on');
  });
});

describe('a refused scan', () => {
  it('has the app\'s own words, in Hindi and Gujarati too (they are looked up by value)', () => {
    for (const text of Object.values(REFUSAL_TEXT)) {
      expect(hi[text], `hi: ${text}`).toBeTruthy();
      expect(gu[text], `gu: ${text}`).toBeTruthy();
    }
  });

  it('says the server\'s words for a reason the app does not know, and a plain line when there are none', () => {
    const t = (k: string) => `[${k}]`;
    expect(refusalWords({ reason: 'already_stocked', message: 'x' }, t)).toBe('[This pallet is already in stock. Use Move instead.]');
    expect(refusalWords({ reason: 'something_new', message: 'Server words' }, t)).toBe('Server words');
    expect(refusalWords({ reason: 'something_new', message: null }, t)).toBe('[FloorBeat did not take this scan.]');
    expect(refusalWords({ reason: 'toString', message: 'Server words' }, t)).toBe('Server words');
  });
});

describe('the scan id', () => {
  it('is a version-4 UUID (what the server takes)', () => {
    const id = uuidFromBytes(new Uint8Array(16).fill(255));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

// ── sending the queue ──

const mv = (id: string): Movement => ({ client_id: id, type: 'in', pallet: `PL-00000${id}`, scanned_at: '2026-11-26T10:00:00Z', product_id: 'p1', to: 'R01-C01', qty: 1 });

function memory(initial: Queued[]): QueueStorage & { queue: Queued[] } {
  const s = { queue: initial, load: () => s.queue, save: (q: Queued[]) => { s.queue = q; } };
  return s;
}
const ok = (m: Movement): MovementResult => ({ client_id: m.client_id, status: 'ok' });

describe('sending the queued scans', () => {
  it('sends batch after batch until none waits', async () => {
    const store = memory(['1', '2', '3', '4', '5'].map((id) => ({ movement: mv(id) })));
    const posted: string[][] = [];
    const report = await sendQueue(store, async (batch) => { posted.push(batch.map((m) => m.client_id)); return batch.map(ok); }, { batchSize: 2 });
    expect(posted).toEqual([['1', '2'], ['3', '4'], ['5']]);
    expect(report).toMatchObject({ sent: 5, stale: [], stop: null });
    expect(report.results.map((r) => r.client_id)).toEqual(['1', '2', '3', '4', '5']);
    expect(store.queue).toEqual([]);
  });

  it('keeps a refused scan, marked with its reason, and is not sent again', async () => {
    const store = memory([{ movement: mv('1') }, { movement: mv('2') }]);
    let calls = 0;
    const report = await sendQueue(store, async (batch) => {
      calls++;
      return batch.map((m) => (m.client_id === '2' ? { client_id: '2', status: 'rejected' as const, reason: 'already_stocked', message: 'm' } : ok(m)));
    });
    expect(calls).toBe(1);
    expect(report.sent).toBe(1);
    expect(store.queue).toEqual([{ movement: mv('2'), rejected: { reason: 'already_stocked', message: 'm' } }]);
  });

  it('with no connection, nothing changes and it says why', async () => {
    const store = memory([{ movement: mv('1') }]);
    const report = await sendQueue(store, async () => { throw new TypeError('Failed to fetch'); });
    expect(report.stop).toBe('offline');
    expect(store.queue).toEqual([{ movement: mv('1') }]);
  });

  it('a scan added while a batch was on its way is kept', async () => {
    const store = memory([{ movement: mv('1') }]);
    const report = await sendQueue(store, async (batch) => {
      store.queue = [...store.queue, { movement: mv('2') }];
      return batch.map(ok);
    }, { maxRounds: 1 });
    expect(report.sent).toBe(1);
    expect(store.queue).toEqual([{ movement: mv('2') }]);
  });

  it('tells a stale scan (taken, but a newer one was there first)', async () => {
    const store = memory([{ movement: mv('1') }]);
    const report = await sendQueue(store, async () => [{ client_id: '1', status: 'ok', stale: true }]);
    expect(report.stale).toEqual([{ client_id: '1', status: 'ok', stale: true }]);
    expect(store.queue).toEqual([]);
  });

  it('stops, keeping the scans, when the answer names none of them (never sends the same batch for ever)', async () => {
    const store = memory([{ movement: mv('1') }]);
    let calls = 0;
    const report = await sendQueue(store, async () => { calls++; return []; });
    expect(calls).toBe(1);
    expect(report.stop).toBe('refused');
    expect(store.queue).toEqual([{ movement: mv('1') }]);
  });

  it('says why a post failed', () => {
    expect(stopFor(new TypeError('Failed to fetch'))).toBe('offline');
    expect(stopFor(new ImsApiError('Server', 502))).toBe('offline');
    expect(stopFor(new ImsApiError('Timeout', 408))).toBe('offline');
    expect(stopFor(new ImsApiError('Signed out', 401))).toBe('signed_out');
    expect(stopFor(new ImsApiError('Invalid CSRF token', 403))).toBe('signed_out');
    expect(stopFor(new ImsApiError('The IMS is not switched on for this factory', 403))).toBe('off');
    expect(stopFor(new ImsApiError('Scans are made by the factory\'s own people', 403))).toBe('denied');
    expect(stopFor(new ImsApiError('movements must be a list of scans', 422))).toBe('refused');
  });
});

describe('the queue kept on the phone', () => {
  it('reads what was kept, leaving out anything that is not a scan, never throwing', () => {
    expect(parseKept(null)).toEqual([]);
    expect(parseKept('not json')).toEqual([]);
    expect(parseKept('{"a":1}')).toEqual([]);
    expect(parseKept(JSON.stringify([{ movement: mv('1') }, { movement: { client_id: 3 } }, null]))).toEqual([{ movement: mv('1') }]);
  });
});

describe('what became of a scan, on the screen that made it', () => {
  const refused = { reason: 'already_stocked', message: 'This pallet is already in stock: use Move or Count' };

  it('a refused scan stays "not added" after it is cleared off the phone (never "added")', () => {
    const answers = answersFrom([{ client_id: 'C1', status: 'rejected', reason: 'already_stocked', message: refused.message }]);
    const kept: Queued[] = [{ movement: mv('c1'), rejected: refused }];
    expect(scanStatus('c1', kept, answers)).toEqual({ kind: 'refused', refusal: refused });
    // the ✕ in the bar takes it off the phone
    expect(scanStatus('c1', [], answers)).toEqual({ kind: 'refused', refusal: refused });
  });

  it('a duplicate of one refused the first time is refused; of one taken, added', () => {
    const answers = answersFrom([
      { client_id: 'c1', status: 'duplicate', outcome: 'rejected', reason: 'not_our_label' },
      { client_id: 'c2', status: 'duplicate', outcome: 'ok' },
    ]);
    expect(scanStatus('c1', [], answers).kind).toBe('refused');
    expect(scanStatus('c2', [], answers).kind).toBe('added');
  });

  it('is added only when the server said so; waiting while on the phone; unknown when it left with no answer seen', () => {
    expect(scanStatus('c1', [], answersFrom([{ client_id: 'c1', status: 'ok' }]))).toEqual({ kind: 'added' });
    expect(scanStatus('c1', [{ movement: mv('c1') }], {})).toEqual({ kind: 'waiting' });
    expect(scanStatus('c1', [], {})).toEqual({ kind: 'unknown' });
    // refused before this screen saw the answer (another tab sent it): the phone's mark says so
    expect(scanStatus('c1', [{ movement: mv('c1'), rejected: refused }], {})).toEqual({ kind: 'refused', refusal: refused });
  });

  it('a send that answers in another shape takes nothing off the phone and does not throw', async () => {
    const store = memory([{ movement: mv('1') }]);
    const report = await sendQueue(store, async () => (undefined as unknown as MovementResult[]));
    expect(report.stop).toBe('refused');
    expect(store.queue).toEqual([{ movement: mv('1') }]);
  });
});
