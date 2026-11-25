import { describe, expect, it } from 'vitest';

import { makeTranslator } from '@/lib/i18n/translate';
import { FULL_SIDE, THUMB_SIDE, fitWithin } from '@/lib/ims/photo';
import { applyResults, enqueue, nextBatch, queueCounts, type Movement, type Queued } from '@/lib/ims/queue';
import { EMPTY_FILTER, isPicked, parseStockFilter, pickedCount, stockFilterQuery, toggleChoice } from '@/lib/ims/stock-filter';
import { ageDays, qtyText, specsText, unitTotalText } from '@/lib/ims/stock-view';

describe('the stock filter in the address', () => {
  it('reads specs (any of several choices), rows, products and age', () => {
    const f = parseStockFilter(new URLSearchParams('spec.colour=grey,black&spec.size=m&row=R03&product=p1&older_than_days=30'));
    expect(f).toEqual({ specs: { colour: ['black', 'grey'], size: ['m'] }, rows: ['R03'], products: ['p1'], olderThanDays: 30 });
  });

  it('writes the same filter the same way whatever order it was picked in', () => {
    const a = stockFilterQuery({ specs: { size: ['m'], colour: ['grey', 'black'] }, rows: ['R03'], products: [], olderThanDays: null });
    const b = stockFilterQuery({ specs: { colour: ['black', 'grey'], size: ['m'] }, rows: ['R03'], products: [], olderThanDays: null });
    expect(a).toBe('spec.colour=black,grey&spec.size=m&row=R03');
    expect(b).toBe(a);
  });

  it('goes round: written then read gives the same filter', () => {
    const f = { specs: { colour: ['grey'], grade: ['a', 'b'] }, rows: ['R01', 'R02'], products: ['p 1'], olderThanDays: 7 };
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
    const row = toggleChoice(both, { key: 'row', kind: 'row' }, 'R03');
    expect(row.rows).toEqual(['R03']);
    expect(pickedCount({ ...row, olderThanDays: 30 })).toBe(4);
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
  });

  it('a total says how many pallets it leaves out', () => {
    expect(unitTotalText({ unit: 'boxes', qty: 1240, uncounted_pallets: 0 }, t, tn)).toBe('1,240 boxes');
    expect(unitTotalText({ unit: 'boxes', qty: 1240, uncounted_pallets: 2 }, t, tn)).toBe('1,240 boxes · 2 pallets not counted');
    expect(unitTotalText({ unit: 'boxes', qty: 1240, uncounted_pallets: 1 }, t, tn)).toBe('1,240 boxes · 1 pallet not counted');
    expect(unitTotalText({ unit: 'kg', qty: null, uncounted_pallets: 3 }, t, tn)).toBe('— kg · 3 pallets not counted');
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
  const scan = (id: string): Movement => ({ client_id: id, type: 'move', pallet: 'PLT-1', to: 'R03-C05', scanned_at: '2026-11-25T10:00:00Z' });

  it('a scan is queued once, however often it is added', () => {
    let q: Queued[] = [];
    q = enqueue(q, scan('a'));
    q = enqueue(q, scan('a'));
    q = enqueue(q, scan('b'));
    expect(q.map((x) => x.movement.client_id)).toEqual(['a', 'b']);
  });

  it('ok and duplicate leave; rejected stays with its reason; unanswered stays to send again', () => {
    const q = [scan('a'), scan('b'), scan('c'), scan('d')].reduce<Queued[]>(enqueue, []);
    const after = applyResults(q, [
      { client_id: 'a', status: 'ok' },
      { client_id: 'b', status: 'duplicate' },
      { client_id: 'c', status: 'rejected', reason: 'Pallet already dispatched' },
    ]);
    expect(after).toEqual([{ movement: scan('c'), rejected: 'Pallet already dispatched' }, { movement: scan('d') }]);
    expect(queueCounts(after)).toEqual({ waiting: 1, rejected: 1 });
  });

  it('a refused scan is not sent again; the rest go oldest first, in batches', () => {
    const q = applyResults(['a', 'b', 'c'].map(scan).reduce<Queued[]>(enqueue, []), [{ client_id: 'a', status: 'rejected', reason: '' }]);
    expect(q[0].rejected).toBe('Refused');
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
});
