import { describe, expect, it } from 'vitest';

import { makeTranslator } from '@/lib/i18n/translate';
import { FULL_SIDE, R2_ORIGIN, THUMB_SIDE, fitWithin, imsPhotoOrigin } from '@/lib/ims/photo';
import { applyResults, enqueue, nextBatch, queueCounts, type Movement, type Queued } from '@/lib/ims/queue';
import { EMPTY_FILTER, isPicked, parseStockFilter, pickedCount, stockFilterQuery, toggleChoice } from '@/lib/ims/stock-filter';
import { ageDays, qtyText, specFieldsOf, specsText, toStockView, unitTotalText } from '@/lib/ims/stock-view';
import type { ApiStock } from '@/lib/ims/types';

describe('the stock filter in the address', () => {
  it('reads specs (any of several choices), rows, products and age', () => {
    const f = parseStockFilter(new URLSearchParams('spec.colour=grey,black&spec.size=m&zone=Z2&row=R3&column=C5&product=p1&older_than_days=30'));
    expect(f).toEqual({ specs: { colour: ['black', 'grey'], size: ['m'] }, zones: ['Z2'], rows: ['R3'], columns: ['C5'], products: ['p1'], olderThanDays: 30 });
  });

  it('writes the same filter the same way whatever order it was picked in', () => {
    const a = stockFilterQuery({ ...EMPTY_FILTER, specs: { size: ['m'], colour: ['grey', 'black'] }, rows: ['R3'], columns: ['C5'] });
    const b = stockFilterQuery({ ...EMPTY_FILTER, specs: { colour: ['black', 'grey'], size: ['m'] }, columns: ['C5'], rows: ['R3'] });
    expect(a).toBe('spec.colour=black,grey&spec.size=m&row=R3&column=C5');
    expect(b).toBe(a);
  });

  it('goes round: written then read gives the same filter', () => {
    const f = { specs: { colour: ['grey'], grade: ['a', 'b'] }, zones: ['Z1'], rows: ['R1', 'R2'], columns: [], products: ['p 1'], olderThanDays: 7 };
    expect(parseStockFilter(new URLSearchParams(stockFilterQuery(f)))).toEqual({ ...f, products: ['p 1'] });
  });

  it('leaves out what it cannot use: bad keys, empty values, a nonsense age', () => {
    const f = parseStockFilter({ 'spec.': 'x', 'spec.bad key': 'x', 'spec.colour': ',,', older_than_days: '-3', row: '' });
    expect(f).toEqual(EMPTY_FILTER);
    expect(stockFilterQuery(EMPTY_FILTER)).toBe('');
    expect(parseStockFilter({ older_than_days: '2.5' }).olderThanDays).toBeNull();
  });

  it('reads a page\'s searchParams object too (an array takes its first)', () => {
    expect(parseStockFilter({ 'spec.colour': ['grey', 'black'], row: undefined }).specs).toEqual({ colour: ['grey'] });
  });

  it('switches a chip on and off; the last choice of a spec takes the spec away', () => {
    const colour = { key: 'colour', kind: 'spec' as const };
    const on = toggleChoice(EMPTY_FILTER, colour, 'grey');
    expect(on.specs).toEqual({ colour: ['grey'] });
    expect(isPicked(on, colour, 'grey')).toBe(true);
    const both = toggleChoice(on, colour, 'black');
    expect(both.specs.colour).toEqual(['black', 'grey']);
    expect(toggleChoice(toggleChoice(both, colour, 'grey'), colour, 'black').specs).toEqual({});
    const row = toggleChoice(both, { key: 'row', kind: 'row' }, 'R3');
    expect(row.rows).toEqual(['R3']);
    const zone = toggleChoice(row, { key: 'zone', kind: 'zone' }, 'Z2');
    expect(isPicked(zone, { key: 'zone', kind: 'zone' }, 'Z2')).toBe(true);
    expect(toggleChoice(zone, { key: 'zone', kind: 'zone' }, 'Z2').zones).toEqual([]);
    expect(pickedCount({ ...zone, olderThanDays: 30 })).toBe(5);
  });
});

describe('stock figures: unknown is never 0', () => {
  const { t, tn } = makeTranslator(null, 'en');

  it('a quantity nobody counted is "—"', () => {
    expect(qtyText(null)).toBe('—');
    expect(qtyText(undefined)).toBe('—');
    expect(qtyText(0)).toBe('0');
    expect(qtyText(1240)).toBe('1,240');
    expect(qtyText(1234567)).toBe('12,34,567');
    // kg, m and litres keep the server's 3 decimals: never rounded to a whole number
    expect(qtyText(0.4)).toBe('0.4');
    expect(qtyText(12.9)).toBe('12.9');
    expect(qtyText(13.3)).toBe('13.3');
    expect(qtyText(2.125)).toBe('2.125');
  });

  it('a total says how many pallets it leaves out', () => {
    expect(unitTotalText({ unit: 'boxes', qty: 1240, uncounted_pallets: 0 }, t, tn)).toBe('1,240 boxes');
    expect(unitTotalText({ unit: 'boxes', qty: 1240, uncounted_pallets: 2 }, t, tn)).toBe('1,240 boxes · 2 pallets not counted');
    expect(unitTotalText({ unit: 'boxes', qty: 1240, uncounted_pallets: 1 }, t, tn)).toBe('1,240 boxes · 1 pallet not counted');
    expect(unitTotalText({ unit: 'kg', qty: null, uncounted_pallets: 3 }, t, tn)).toBe('— kg · 3 pallets not counted');
    expect(unitTotalText({ unit: 'kg', qty: 13.3, uncounted_pallets: 0 }, t, tn)).toBe('13.3 kg');
  });

  it('in Hindi too', () => {
    const hi = makeTranslator({ '{count} pallets not counted': '{count} पैलेट की गिनती बाकी' }, 'hi');
    expect(unitTotalText({ unit: 'boxes', qty: 1240, uncounted_pallets: 2 }, hi.t, hi.tn, 'hi')).toBe('1,240 boxes · 2 पैलेट की गिनती बाकी');
  });

  it('specs read in the factory\'s own words and order', () => {
    const fields = [
      { key: 'colour', label: 'Colour', options: [{ key: 'grey', label: 'Grey' }] },
      { key: 'size', label: 'Size', options: [{ key: 'm', label: 'M' }] },
    ];
    expect(specsText({ size: 'm', colour: 'grey' }, fields)).toBe('Grey · M');
    expect(specsText({ colour: 'teal', finish: 'matt' }, fields)).toBe('teal · matt');
    expect(specsText({}, fields)).toBe('');
  });

  it('age in whole days (an ISO date is an IST day); unknown stays unknown', () => {
    const now = new Date('2026-11-25T12:00:00+05:30');
    expect(ageDays('2026-11-12', now)).toBe(13);
    expect(ageDays('2026-11-25', now)).toBe(0);
    expect(ageDays('2026-11-30', now)).toBe(0);
    expect(ageDays(null, now)).toBeNull();
    expect(ageDays('not a date', now)).toBeNull();
  });
});

describe('scans waiting on the phone', () => {
  const scan = (id: string): Movement => ({ client_id: id, type: 'move', pallet: 'PLT-000001', to: 'R03-C05', scanned_at: '2026-11-25T10:00:00Z' });

  it('a scan is queued once, however often it is added', () => {
    let q: Queued[] = [];
    q = enqueue(q, scan('a'));
    q = enqueue(q, scan('a'));
    q = enqueue(q, scan('b'));
    expect(q.map((x) => x.movement.client_id)).toEqual(['a', 'b']);
  });

  it('ok leaves; rejected stays with its reason and the server\'s words; unanswered stays to send again', () => {
    const q = [scan('a'), scan('c'), scan('d')].reduce<Queued[]>(enqueue, []);
    const after = applyResults(q, [
      { client_id: 'a', status: 'ok' },
      { client_id: 'c', status: 'rejected', reason: 'already_stocked', message: 'This pallet is already in stock: use Move or Count' },
    ]);
    expect(after).toEqual([
      { movement: scan('c'), rejected: { reason: 'already_stocked', message: 'This pallet is already in stock: use Move or Count' } },
      { movement: scan('d') },
    ]);
    expect(queueCounts(after)).toEqual({ waiting: 1, rejected: 1 });
  });

  it('a retry after a lost answer: a duplicate of a refused scan stays refused; of a done one, leaves', () => {
    const q = [scan('a'), scan('b')].reduce<Queued[]>(enqueue, []);
    const after = applyResults(q, [
      { client_id: 'a', status: 'duplicate', outcome: 'rejected', reason: 'pallet_closed' },
      { client_id: 'b', status: 'duplicate', outcome: 'ok' },
    ]);
    expect(after).toEqual([{ movement: scan('a'), rejected: { reason: 'pallet_closed', message: null } }]);
  });

  it('the server\'s ids are lower case: a phone\'s upper-case id still matches', () => {
    const q = enqueue([], scan('ABC'));
    expect(applyResults(q, [{ client_id: 'abc', status: 'ok' }])).toEqual([]);
  });

  it('a refused scan is not sent again; the rest go oldest first, in batches', () => {
    const q = applyResults(['a', 'b', 'c'].map(scan).reduce<Queued[]>(enqueue, []), [{ client_id: 'a', status: 'rejected' }]);
    expect(q[0].rejected).toEqual({ reason: 'refused', message: null });
    expect(nextBatch(q).map((m) => m.client_id)).toEqual(['b', 'c']);
    expect(nextBatch(q, 1).map((m) => m.client_id)).toEqual(['b']);
  });
});

describe('stock photos are made small on the phone', () => {
  it('fits the longest side, keeps the shape, never enlarges', () => {
    expect(fitWithin(4000, 3000, FULL_SIDE)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, THUMB_SIDE)).toEqual({ width: 240, height: 320 });
    expect(fitWithin(800, 600, FULL_SIDE)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 10, THUMB_SIDE)).toEqual({ width: 320, height: 1 });
    expect(fitWithin(0, 600, FULL_SIDE)).toEqual({ width: 0, height: 0 });
  });

  it('the page lets photos come from R2, or the bucket\'s own https address; never anything looser', () => {
    expect(imsPhotoOrigin(undefined)).toBe(R2_ORIGIN);
    expect(imsPhotoOrigin('https://photos.example.com')).toBe('https://photos.example.com');
    expect(imsPhotoOrigin('*')).toBe(R2_ORIGIN);
    expect(imsPhotoOrigin('http://photos.example.com')).toBe(R2_ORIGIN);
    expect(imsPhotoOrigin('https://photos.example.com; script-src *')).toBe(R2_ORIGIN);
  });
});

describe('the stock page from the API\'s answer', () => {
  const fields = specFieldsOf([
    { key: 'colour', label: 'Colour', options: [{ value: 'grey', label: 'Grey' }, { value: 'black', label: 'Black' }] },
    { key: 'grade', label: 'Grade', options: [{ value: 'a', label: 'A' }] },
  ]);
  const product = { product_id: 'p1', sku: 'VT-600', name: 'Vitrified tile', unit: 'boxes', tracking: 'quantity' as const, specs: { colour: 'grey' }, active: true };
  const api: ApiStock = {
    rows: [
      { product: { ...product, picture: { photo_id: 'ph', url: 'u', thumb_url: 'https://r2/t', taken_at: 't', taken_by: null } }, qty: null, unit: 'boxes', pallets: 2, uncounted_pallets: 2, needs_count_pallets: 1, oldest_stocked_at: '2026-11-01T05:00:00.000Z' },
      { product: { ...product, product_id: 'p2', name: 'Wall tile' }, specs: { colour: 'black', grade: 'a' }, qty: 40, unit: 'boxes', pallets: 1, uncounted_pallets: 0, needs_count_pallets: 0, oldest_stocked_at: '2026-11-20T05:00:00.000Z', oldest_on: '2026-11-10' },
    ],
    totals: { rows: 2, products: 2, pallets: 3, by_unit: [{ unit: 'boxes', qty: 40, pallets: 3, uncounted_pallets: 2 }] },
    filters: {
      specs: { finish: [{ value: 'matt', label: 'Matt', pallets: 1 }], grade: [{ value: 'a', label: 'A', pallets: 1 }], colour: [{ value: 'grey', label: 'Grey', pallets: 2 }, { value: 'black', label: 'Black', pallets: 1 }] },
      zones: [{ zone: 'Z2', pallets: 3 }],
      rows: [{ row: 3, pallets: 2 }, { row: 12, pallets: 1 }],
      columns: [],
      products: [{ product_id: 'p1', name: 'Vitrified tile', pallets: 2 }],
    },
    next: 'cur-2',
  };

  it('keeps unknown unknown, and takes the row\'s own specs and FIFO date when sent', () => {
    const v = toStockView(api, fields);
    expect(v.rows[0]).toMatchObject({ product_id: 'p1', qty: null, specs: { colour: 'grey' }, thumb_url: 'https://r2/t', needs_count_pallets: 1, oldest_on: '2026-11-01T05:00:00.000Z' });
    expect(v.rows[1]).toMatchObject({ product_id: 'p2', qty: 40, specs: { colour: 'black', grade: 'a' }, thumb_url: null, oldest_on: '2026-11-10' });
    expect(v.rows[0].key).not.toBe(v.rows[1].key);
    expect(v.totals).toEqual({ rows: 2, products: 2, pallets: 3, by_unit: api.totals.by_unit });
    expect(v.next_cursor).toBe('cur-2');
  });

  it('filter sections: the factory\'s specs in its order, then unknown specs, then the location, then products; empty ones left out', () => {
    const v = toStockView(api, fields);
    expect(v.facets.map((f) => `${f.kind}:${f.key}`)).toEqual(['spec:colour', 'spec:grade', 'spec:finish', 'zone:zone', 'row:row', 'product:product']);
    expect(v.facets[0]).toEqual({ key: 'colour', label: 'Colour', kind: 'spec', options: [{ key: 'grey', label: 'Grey', pallets: 2 }, { key: 'black', label: 'Black', pallets: 1 }] });
    expect(v.facets[3].options).toEqual([{ key: 'Z2', label: 'Z2', pallets: 3 }]);
    // rows and columns are numbers to the API (row=3) and written as on the labels (R03)
    expect(v.facets[4].options).toEqual([{ key: '3', label: 'R03', pallets: 2 }, { key: '12', label: 'R12', pallets: 1 }]);
    expect(v.facets[5].options).toEqual([{ key: 'p1', label: 'Vitrified tile', pallets: 2 }]);
  });
});
