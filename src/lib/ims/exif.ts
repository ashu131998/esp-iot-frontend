/**
 * When a photo was taken, from the photo itself (its EXIF "date taken"). Making the photo small on the phone
 * draws it again and drops this, so it is read from the original file first (photo.ts photoTime). For a photo
 * chosen from the phone's library, it is what tells next month's AI step whether it could be of this pallet.
 */

const DATE_TIME_ORIGINAL = 0x9003;
const OFFSET_TIME_ORIGINAL = 0x9011;
const DATE_TIME = 0x0132;
const EXIF_IFD = 0x8769;

/** How much of the file is read: the EXIF block sits in the first 64 KB of a JPEG. */
export const EXIF_READ_BYTES = 128 * 1024;

/**
 * "2026:11:26 14:05:09" (+ "+05:30" when the phone wrote its offset) as a time; null when it is not one.
 * Without an offset the phone's own clock zone is used: the phone that took it is the one reading it, mostly.
 */
export function exifTime(text: string, offset: string | null = null): Date | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const off = offset ? /^([+-])(\d{2}):(\d{2})$/.exec(offset.trim()) : null;
  const date = off
    ? new Date(Date.UTC(y, mo - 1, d, h, mi, s) - (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) * 60_000)
    : new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The EXIF date taken of a JPEG (its first bytes are enough), or null: not a JPEG, no EXIF, no date. */
export function exifTakenAt(buffer: ArrayBuffer): Date | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let pos = 2;
  while (pos + 4 <= view.byteLength) {
    if (view.getUint8(pos) !== 0xff) return null;
    const marker = view.getUint8(pos + 1);
    if (marker === 0xda || marker === 0xd9) return null; // the picture itself: no EXIF before it
    const length = view.getUint16(pos + 2);
    if (length < 2) return null;
    if (marker === 0xe1 && pos + 10 <= view.byteLength && ascii(view, pos + 4, 4) === 'Exif' && view.getUint16(pos + 8) === 0) {
      return readTiff(view, pos + 10, Math.min(view.byteLength, pos + 2 + length));
    }
    pos += 2 + length;
  }
  return null;
}

function ascii(view: DataView, at: number, n: number): string {
  let s = '';
  for (let i = 0; i < n && at + i < view.byteLength; i++) {
    const c = view.getUint8(at + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function readTiff(view: DataView, start: number, end: number): Date | null {
  if (start + 8 > end) return null;
  const order = view.getUint16(start);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const u16 = (at: number) => (at + 2 <= end ? view.getUint16(at, little) : null);
  const u32 = (at: number) => (at + 4 <= end ? view.getUint32(at, little) : null);
  if (u16(start + 2) !== 42) return null;

  /** An IFD's entries: tag → the entry's position. */
  const entries = (ifdOffset: number | null) => {
    const out = new Map<number, number>();
    if (ifdOffset === null) return out;
    const at = start + ifdOffset;
    const count = u16(at);
    if (count === null || count > 1000) return out;
    for (let i = 0; i < count; i++) {
      const e = at + 2 + i * 12;
      const tag = u16(e);
      if (tag === null || e + 12 > end) break;
      out.set(tag, e);
    }
    return out;
  };
  /** An ASCII entry's text (type 2), inline when 4 bytes or fewer. */
  const text = (entry: number | undefined) => {
    if (entry === undefined || u16(entry + 2) !== 2) return null;
    const count = u32(entry + 4) ?? 0;
    const at = count <= 4 ? entry + 8 : start + (u32(entry + 8) ?? end);
    if (at + count > end) return null;
    return ascii(view, at, count);
  };

  const ifd0 = entries(u32(start + 4));
  const exifPointer = ifd0.get(EXIF_IFD);
  const exif = exifPointer !== undefined ? entries(u32(exifPointer + 8)) : new Map<number, number>();
  const original = text(exif.get(DATE_TIME_ORIGINAL));
  if (original) {
    const t = exifTime(original, text(exif.get(OFFSET_TIME_ORIGINAL)));
    if (t) return t;
  }
  const plain = text(ifd0.get(DATE_TIME));
  return plain ? exifTime(plain) : null;
}
