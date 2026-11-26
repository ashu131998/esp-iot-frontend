import { describe, expect, it } from 'vitest';

import { gu } from '@/lib/i18n/messages/gu';
import { hi } from '@/lib/i18n/messages/hi';
import { ImsApiError } from '@/lib/ims/api';
import { exifTakenAt, exifTime } from '@/lib/ims/exif';
import {
  choicesToSend, detailsOf, draftProblem, editFieldBody, fieldProblems, keyFromLabel, moveKey, newFieldBody, parseNumberInput,
  phoneFields, stockInFields, valueFromLabel, type ApiField,
} from '@/lib/ims/fields';
import { FULL_QUALITY, photoTime } from '@/lib/ims/photo';
import { keepStockInPhotos, linkRequest, photoFits, PHOTO_QUEUE_MAX_BYTES, sendPhotos, type PendingPhoto, type PhotoCalls, type PhotoStore } from '@/lib/ims/photo-queue';
import { stockInMovement } from '@/lib/ims/stock-in';
import type { ApiPhotoLinks, ApiProduct } from '@/lib/ims/types';

const field = (key: string, type: ApiField['type'], extra: Partial<ApiField> = {}): ApiField => ({
  key, label: key, type, required: false, options: [], sort: 0, ...extra,
});

describe('a new field on the ops Stock details page', () => {
  it('gets a key the server takes, never one the factory has or had', () => {
    expect(keyFromLabel('Grade (A/B)', [])).toBe('grade_a_b');
    expect(keyFromLabel('Weight', ['weight'])).toBe('weight_2');
    expect(keyFromLabel('Weight', ['weight', 'weight_2'])).toBe('weight_3');
    expect(keyFromLabel('2nd check', [])).toBe('f_2nd_check');
    expect(keyFromLabel('रंग', [])).toBe('field');
    expect(keyFromLabel('रंग', ['field'])).toBe('field_2');
    // its own path on the server: never a key
    expect(keyFromLabel('Order', [])).toBe('order_2');
    const long = keyFromLabel('A very long name for a field that goes on', []);
    expect(long).toMatch(/^[a-z][a-z0-9_]{0,29}$/);
  });

  it('gives new choices values; saved ones keep theirs (pallets have them)', () => {
    expect(valueFromLabel('Light grey', [])).toBe('light_grey');
    expect(valueFromLabel('Grey', ['grey'])).toBe('grey_2');
    expect(choicesToSend([
      { value: 'grey', label: 'Grey (light)' },
      { value: null, label: ' Black ' },
      { value: null, label: '' },
      { value: null, label: 'Grey' },
    ])).toEqual([
      { value: 'grey', label: 'Grey (light)' },
      { value: 'black', label: 'Black' },
      { value: 'grey_2', label: 'Grey' },
    ]);
  });

  it('says what is wrong before the server would', () => {
    expect(draftProblem({ label: ' ', type: 'text', required: false, choices: [], unit: '', allowLibrary: true })).toBe('Give the field a name.');
    expect(draftProblem({ label: 'Grade', type: 'choice', required: false, choices: [{ value: null, label: '' }], unit: '', allowLibrary: true })).toBe('Give at least one choice.');
    expect(draftProblem({ label: 'Grade', type: 'choice', required: false, choices: [{ value: null, label: 'A' }, { value: null, label: 'a' }], unit: '', allowLibrary: true })).toBe('"a" is there twice.');
    expect(draftProblem({ label: 'Grade', type: 'choice', required: true, choices: [{ value: null, label: 'A' }], unit: '', allowLibrary: true })).toBeNull();
    expect(draftProblem({ label: 'Photo of the label', type: 'photo', required: true, choices: [], unit: '', allowLibrary: true })).toBeNull();
  });

  it('sends choices only for a pick-list, a unit only for a number, the library switch only for a file; never the key or type on an edit', () => {
    expect(newFieldBody({ label: 'Weight', type: 'number', required: true, choices: [{ value: null, label: 'x' }], unit: ' kg ', allowLibrary: false }, []))
      .toEqual({ key: 'weight', label: 'Weight', type: 'number', required: true, unit: 'kg' });
    expect(newFieldBody({ label: 'Count', type: 'number', required: false, choices: [], unit: '', allowLibrary: true }, []))
      .toEqual({ key: 'count', label: 'Count', type: 'number', required: false, unit: null });
    expect(newFieldBody({ label: 'Label photo', type: 'photo', required: true, choices: [], unit: 'kg', allowLibrary: false }, []))
      .toEqual({ key: 'label_photo', label: 'Label photo', type: 'photo', required: true, allow_library: false });
    expect(editFieldBody({ label: 'Grade', type: 'choice', required: false, choices: [{ value: 'a', label: 'A' }], unit: '', allowLibrary: true }))
      .toEqual({ label: 'Grade', required: false, options: [{ value: 'a', label: 'A' }] });
    expect(draftProblem({ label: 'Weight', type: 'number', required: false, choices: [], unit: 'kilograms net', allowLibrary: true })).toBe('The unit is longer than 12 characters.');
  });

  it('moves a field up or down, and not past either end', () => {
    expect(moveKey(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveKey(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveKey(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveKey(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('Add stock asks for the factory\'s fields', () => {
  it('in the factory\'s order; an older server (pick-lists only) still works', () => {
    const fields = [field('b', 'text', { sort: 20 }), field('a', 'choice', { sort: 10 })];
    expect(stockInFields({ spec_fields: [], fields }).map((f) => f.key)).toEqual(['a', 'b']);
    // archived: kept for old pallets' labels, never asked
    expect(stockInFields({ spec_fields: [], fields: [...fields, field('old', 'text', { archived: true })] }).map((f) => f.key)).toEqual(['a', 'b']);
    expect(stockInFields({ spec_fields: [{ key: 'colour', label: 'Colour', options: [{ value: 'grey', label: 'Grey' }] }] }))
      .toEqual([{ key: 'colour', label: 'Colour', type: 'choice', required: false, options: [{ value: 'grey', label: 'Grey' }], sort: 0 }]);
    expect(stockInFields(null)).toEqual([]);
  });

  it('leaves audio and video out until the app records them', () => {
    expect(phoneFields([field('a', 'audio'), field('p', 'photo'), field('v', 'video'), field('n', 'number')]).map((f) => f.key)).toEqual(['p', 'n']);
  });

  it('reads numbers as typed, Indian grouping too; never guesses', () => {
    expect(parseNumberInput('12.5')).toBe(12.5);
    expect(parseNumberInput('1,250')).toBe(1250);
    expect(parseNumberInput('12,34,567')).toBe(1234567);
    expect(parseNumberInput('-3')).toBe(-3);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('1,5')).toBe('bad');
    // a decimal comma is refused, never read as a bigger number
    expect(parseNumberInput('0,75')).toBe('bad');
    expect(parseNumberInput('12,50')).toBe('bad');
    expect(parseNumberInput('1,50')).toBe('bad');
    expect(parseNumberInput('1,2345')).toBe('bad');
    expect(parseNumberInput('1,00,000')).toBe(100000);
    expect(parseNumberInput('1,234,567.5')).toBe(1234567.5);
    expect(parseNumberInput('12 kg')).toBe('bad');
    expect(parseNumberInput('1e20')).toBe('bad');
  });

  it('sends text and number answers as details, only those given', () => {
    const fields = [field('note', 'text'), field('weight', 'number'), field('grade', 'choice'), field('pic', 'photo')];
    expect(detailsOf(fields, { note: '  torn  wrap ', weight: '41.5', grade: 'x' })).toEqual({ note: 'torn wrap', weight: 41.5 });
    expect(detailsOf(fields, { note: ' ', weight: 'abc' })).toBeUndefined();
  });

  it('holds back a required field left empty, and a number that is not one', () => {
    const fields = [
      field('grade', 'choice', { required: true }), field('note', 'text', { required: true }), field('weight', 'number'),
      field('label_photo', 'photo', { required: true }), field('extra', 'photo'),
    ];
    expect(fieldProblems(fields, { specs: {}, typed: { weight: 'x' }, photos: new Set() }))
      .toEqual({ grade: 'required', note: 'required', weight: 'bad_number', label_photo: 'required' });
    expect(fieldProblems(fields, { specs: { grade: 'a' }, typed: { note: 'ok', weight: '' }, photos: new Set(['label_photo']) })).toEqual({});
  });

  it('follows the server\'s value rules from the field: a text\'s length, a number\'s range', () => {
    const fields = [field('note', 'text', { max_length: 5 }), field('pct', 'number', { min: 0, max: 100 }), field('w', 'number')];
    expect(fieldProblems(fields, { specs: {}, typed: { note: 'abcdef', pct: '101', w: '1e3' }, photos: new Set() }))
      .toEqual({ note: 'too_long', pct: 'bad_number', w: 'bad_number' });
    expect(fieldProblems(fields, { specs: {}, typed: { note: 'abc  de', pct: '100', w: '-5' }, photos: new Set() })).toEqual({ note: 'too_long' });
    expect(fieldProblems(fields, { specs: {}, typed: { note: 'abcde', pct: '0' }, photos: new Set() })).toEqual({});
    // no rule sent (an older server): the limits it has always had
    expect(fieldProblems([field('n', 'text')], { specs: {}, typed: { n: 'x'.repeat(201) }, photos: new Set() })).toEqual({ n: 'too_long' });
  });

  it('puts the details on the stock-in scan', () => {
    const product: ApiProduct = { product_id: 'p1', sku: 'S', name: 'Box', unit: 'boxes', tracking: 'quantity', specs: {}, active: true };
    const m = stockInMovement({ pallet: 'PL-000001', product, location: 'R01-C01', qty: 4, specs: {}, batch: '', producedOn: '', details: { weight: 41.5 } }, 'id-1', new Date('2026-11-26T10:00:00Z'));
    expect(m.details).toEqual({ weight: 41.5 });
    expect(stockInMovement({ pallet: 'PL-000001', product, location: 'R01-C01', qty: 4, specs: {}, batch: '', producedOn: '', details: {} }, 'id-2')).not.toHaveProperty('details');
  });

  it('has Hindi and Gujarati for every new word on the phone', () => {
    const keys = [
      'Take photo', 'Choose from phone', 'Photo taken', 'Photo from the phone', 'Getting the photo ready…', 'This is needed.',
      'Type a number like 40 or 12.5.', 'Fill in the details marked in red.', 'Up to {count} characters.', 'Photo (optional)', 'Details',
      'This photo could not be read. Take it again or choose another.',
      '{count} photo waiting to send', '{count} photos waiting to send', '{count} photo was not saved', '{count} photos were not saved',
    ];
    for (const k of keys) {
      expect(hi[k], k).toBeTruthy();
      expect(gu[k], k).toBeTruthy();
    }
  });
});

// ── a photo's time, read from the photo before it is made small ──

/** A JPEG with only an EXIF block: DateTimeOriginal (and its offset when given), little- or big-endian. */
function jpegWithExif(date: string, { offset = null as string | null, little = true } = {}): ArrayBuffer {
  const enc = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);
  const dateBytes = enc(date);
  const offBytes = offset ? enc(offset) : [];
  // TIFF: header 8, IFD0 at 8 with 1 entry (ExifIFD pointer) → 2+12+4 = 18 → Exif IFD at 26
  const exifIfd = 26;
  const entries = offset ? 2 : 1;
  const dataAt = exifIfd + 2 + entries * 12 + 4;
  const tiff: number[] = [];
  const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) => (little ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifIfd), ...u32(0));
  tiff.push(...u16(entries), ...u16(0x9003), ...u16(2), ...u32(dateBytes.length), ...u32(dataAt));
  if (offset) tiff.push(...u16(0x9011), ...u16(2), ...u32(offBytes.length), ...u32(dataAt + dateBytes.length));
  tiff.push(...u32(0), ...dateBytes, ...offBytes);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xe1, len >> 8, len & 0xff, ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

describe('when a library photo was taken', () => {
  it('reads the photo\'s own date taken, with its offset when the phone wrote one', () => {
    expect(exifTakenAt(jpegWithExif('2026:11:20 14:05:09', { offset: '+05:30' }))?.toISOString()).toBe('2026-11-20T08:35:09.000Z');
    expect(exifTakenAt(jpegWithExif('2026:11:20 14:05:09', { offset: '+05:30', little: false }))?.toISOString()).toBe('2026-11-20T08:35:09.000Z');
    expect(exifTakenAt(jpegWithExif('2026:11:20 14:05:09'))?.getTime()).toBe(new Date(2026, 10, 20, 14, 5, 9).getTime());
  });

  it('finds nothing in a file that is not a JPEG with a date', () => {
    expect(exifTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(exifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
    expect(exifTakenAt(jpegWithExif('0000:00:00 00:00:00'))).toBeNull();
    expect(exifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x45]).buffer)).toBeNull();
    expect(exifTime('2026:13:01 10:00:00')).toBeNull();
  });

  it('says where the time is from: taken now, the photo, the file, or the upload', async () => {
    const now = new Date('2026-11-26T10:00:00Z');
    const fresh = new File([jpegWithExif('2026:11:26 15:29:00', { offset: '+05:30' })], 'f.jpg');
    expect(await photoTime(fresh, 'camera', now)).toEqual({ takenAt: now, takenAtSource: 'capture', source: 'camera' });
    const withExif = new File([jpegWithExif('2026:11:20 14:05:09', { offset: '+05:30' })], 'a.jpg', { lastModified: Date.parse('2026-11-25T00:00:00Z') });
    expect(await photoTime(withExif, 'library', now)).toEqual({ takenAt: new Date('2026-11-20T08:35:09Z'), takenAtSource: 'photo_info', source: 'library' });
    const plain = new File([new Uint8Array([1, 2, 3])], 'b.png', { lastModified: Date.parse('2026-11-25T00:00:00Z') });
    expect(await photoTime(plain, 'library', now)).toEqual({ takenAt: new Date('2026-11-25T00:00:00Z'), takenAtSource: 'file_date', source: 'library' });
    expect(await photoTime(plain, 'camera', now)).toEqual({ takenAt: now, takenAtSource: 'capture', source: 'camera' });
    const future = new File([new Uint8Array([1])], 'c.png', { lastModified: Date.parse('2027-01-01T00:00:00Z') });
    expect(await photoTime(future, 'library', now)).toEqual({ takenAt: now, takenAtSource: 'upload', source: 'library' });
  });

  it('a "Take photo" that brings an old photo (a browser that ignores camera-only) counts as from the library', async () => {
    const now = new Date('2026-11-26T10:00:00Z');
    const old = new File([jpegWithExif('2026:11:20 14:05:09', { offset: '+05:30' })], 'a.jpg');
    expect(await photoTime(old, 'camera', now)).toEqual({ takenAt: new Date('2026-11-20T08:35:09Z'), takenAtSource: 'photo_info', source: 'library' });
  });

  it('never makes photos blockier than JPEG quality 0.7 (AI reads colours)', () => {
    expect(Math.min(...FULL_QUALITY)).toBe(0.7);
  });
});

// ── photos waiting on the phone ──

const blob = (n: number) => new Blob([new Uint8Array(n)]);
const pending = (id: string, extra: Partial<PendingPhoto> = {}): PendingPhoto => ({
  id, factoryId: 'f1', pallet: 'PL-000001', field: 'label_photo', source: 'library', takenAt: '2026-11-20T08:35:09.000Z',
  takenAtSource: 'photo_info', full: blob(10), thumb: blob(2), addedAt: `2026-11-26T10:00:0${id}Z`, ...extra,
});

function memoryStore(photos: PendingPhoto[]): PhotoStore & { all: Map<string, PendingPhoto> } {
  const all = new Map(photos.map((p) => [p.id, p]));
  return {
    all,
    list: async (f) => [...all.values()].filter((p) => p.factoryId === f),
    put: async (p) => { all.set(p.id, p); },
    remove: async (id) => { all.delete(id); },
  };
}

const links = (id: string, uploaded = false): ApiPhotoLinks => ({
  photo_id: id, full_put_url: `https://r2.example.com/${id}/full`, thumb_put_url: `https://r2.example.com/${id}/thumb`, expires_at: '', uploaded,
});

describe('photos waiting on the phone', () => {
  it('asks for links with the field and how the photo came, uploads both, then says they are there', async () => {
    const store = memoryStore([pending('1', { stockIn: 'mv-1' }), pending('2', { field: null, source: 'camera', takenAtSource: 'capture' })]);
    const asked: unknown[] = [];
    const put: string[] = [];
    const done: string[] = [];
    const calls: PhotoCalls = {
      links: async (_f, req) => { asked.push(req); return links(req.photo_id); },
      putJpeg: async (url) => { put.push(url); },
      uploaded: async (_f, id) => { done.push(id); },
    };
    expect(await sendPhotos(store, calls, 'f1')).toEqual({ sent: 2, refused: 0, stop: null });
    expect(asked).toEqual([
      { photo_id: '1', taken_at: '2026-11-20T08:35:09.000Z', pallet: 'PL-000001', field: 'label_photo', movement_client_id: 'mv-1', source: 'library', taken_at_source: 'photo_info' },
      { photo_id: '2', taken_at: '2026-11-20T08:35:09.000Z', pallet: 'PL-000001', source: 'camera', taken_at_source: 'capture' },
    ]);
    expect(put).toHaveLength(4);
    expect(done).toEqual(['1', '2']);
    expect(store.all.size).toBe(0);
  });

  it('a photo the server has already (its 409 "uploaded" after a lost reply) counts as sent, never as refused', async () => {
    const already = () => new ImsApiError('This photo is uploaded already', 409, { error: 'This photo is uploaded already', uploaded: true });
    const store = memoryStore([pending('1')]);
    const calls: PhotoCalls = { links: async () => { throw already(); }, putJpeg: async () => { throw new Error('no'); }, uploaded: async () => { throw new Error('no'); } };
    expect(await sendPhotos(store, calls, 'f1')).toEqual({ sent: 1, refused: 0, stop: null });
    expect(store.all.size).toBe(0);
    // the same answer to "they are there"
    const again = memoryStore([pending('2')]);
    expect(await sendPhotos(again, { links: async () => links('2'), putJpeg: async () => {}, uploaded: async () => { throw already(); } }, 'f1'))
      .toEqual({ sent: 1, refused: 0, stop: null });
    // a 409 that is not "uploaded" (another photo's id) is still refused
    const other = memoryStore([pending('3')]);
    expect(await sendPhotos(other, { links: async () => { throw new ImsApiError('This photo_id is another photo\'s', 409, { error: 'x' }); }, putJpeg: async () => {}, uploaded: async () => {} }, 'f1'))
      .toEqual({ sent: 0, refused: 1, stop: null });
  });

  it('no connection, or the bucket failing: it stays and is tried again later', async () => {
    const store = memoryStore([pending('1')]);
    expect((await sendPhotos(store, { links: async () => { throw new TypeError('fetch failed'); }, putJpeg: async () => {}, uploaded: async () => {} }, 'f1')).stop).toBe('offline');
    expect((await sendPhotos(store, { links: async () => links('1'), putJpeg: async () => { throw new ImsApiError('Upload failed (403)', 403); }, uploaded: async () => {} }, 'f1')).stop).toBe('offline');
    expect((await sendPhotos(store, { links: async () => links('1'), putJpeg: async () => {}, uploaded: async () => { throw new ImsApiError('Not uploaded yet', 409); } }, 'f1')).stop).toBe('offline');
    expect(store.all.get('1')?.refused).toBeUndefined();
  });

  it('signed out: stops and waits for the next sign-in', async () => {
    const store = memoryStore([pending('1'), pending('2')]);
    const report = await sendPhotos(store, { links: async () => { throw new ImsApiError('Unauthorized', 401); }, putJpeg: async () => {}, uploaded: async () => {} }, 'f1');
    expect(report).toEqual({ sent: 0, refused: 0, stop: 'signed_out' });
    expect(store.all.size).toBe(2);
  });

  it('one the server will not take is kept with its reason, and the rest still go; it is not tried again', async () => {
    const store = memoryStore([pending('1'), pending('2')]);
    let tries = 0;
    const calls: PhotoCalls = {
      links: async (_f, req) => {
        tries++;
        if (req.photo_id === '1') throw new ImsApiError('No spec field "label_photo"', 422);
        return links(req.photo_id);
      },
      putJpeg: async () => {},
      uploaded: async () => {},
    };
    expect(await sendPhotos(store, calls, 'f1')).toEqual({ sent: 1, refused: 1, stop: null });
    expect(store.all.get('1')?.refused).toBe('No spec field "label_photo"');
    await sendPhotos(store, calls, 'f1');
    expect(tries).toBe(2);
  });

  it('only the factory\'s own photos, and no more than the phone keeps', async () => {
    const store = memoryStore([pending('1', { factoryId: 'other' })]);
    expect(await sendPhotos(store, { links: async () => { throw new Error('not this one'); }, putJpeg: async () => {}, uploaded: async () => {} }, 'f1'))
      .toEqual({ sent: 0, refused: 0, stop: null });
    expect(photoFits([], { full: blob(10), thumb: blob(1) })).toBe(true);
    expect(photoFits([{ full: { size: PHOTO_QUEUE_MAX_BYTES } as Blob, thumb: blob(0) }], { full: blob(1), thumb: blob(0) })).toBe(false);
    expect(linkRequest(pending('9', { field: null }))).not.toHaveProperty('field');
  });
});

describe('a stock-in\'s photos are kept before its scan is queued', () => {
  const two = [pending('1'), pending('2')];

  it('all kept: the scan may go', async () => {
    expect(await keepStockInPhotos(two, { keep: async () => 'kept', upload: async () => {}, remove: () => {} }))
      .toEqual({ ok: true, keptIds: ['1', '2'] });
  });

  it('one the phone cannot keep: those kept are taken back and the scan must not go', async () => {
    const removed: string[] = [];
    const outcome = await keepStockInPhotos(two, {
      keep: async (p) => (p.id === '2' ? 'full' : 'kept'), upload: async () => {}, remove: (id) => { removed.push(id); },
    });
    expect(outcome).toEqual({ ok: false, reason: 'no_space' });
    expect(removed).toEqual(['1']);
  });

  it('no store on this phone: sent at once; if that fails, the scan must not go', async () => {
    const sent: string[] = [];
    expect(await keepStockInPhotos(two, { keep: async () => 'no_store', upload: async (p) => { sent.push(p.id); }, remove: () => {} }))
      .toEqual({ ok: true, keptIds: [] });
    expect(sent).toEqual(['1', '2']);
    expect(await keepStockInPhotos(two, { keep: async () => 'no_store', upload: async () => { throw new TypeError('offline'); }, remove: () => {} }))
      .toEqual({ ok: false, reason: 'not_sent' });
  });
});

describe('the ops Stock details rows', () => {
  it('a take-now-only file field says it must be taken on the spot', async () => {
    const { fieldHelp } = await import('@/components/internal/stock-details-panel');
    expect(fieldHelp({ type: 'photo', options: [], allow_library: true })).toBe('Taken with the camera or chosen from the phone.');
    expect(fieldHelp({ type: 'photo', options: [], allow_library: false })).toMatch(/^Must be taken on the spot/);
    expect(fieldHelp({ type: 'video', options: [], allow_library: false })).toMatch(/^Must be recorded on the spot/);
    expect(fieldHelp({ type: 'choice', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] })).toBe('A, B');
  });
});
