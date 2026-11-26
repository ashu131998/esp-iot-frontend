/**
 * Stock photos are made small on the phone before they are sent: a full picture for the pallet's
 * page and a small one for lists. Factory Wi-Fi is weak, and the server takes at most 1 MB.
 */

import { EXIF_READ_BYTES, exifTakenAt } from './exif';

/** Longest side of the full picture and of the list picture, in pixels. */
export const FULL_SIDE = 1600;
/** Tried when FULL_SIDE does not fit at the lowest quality: smaller, not blockier. */
export const SMALLER_SIDE = 1280;
export const THUMB_SIDE = 320;
/**
 * JPEG quality for the full one, tried lower until it fits, never under 0.7: below that JPEG blocks spoil
 * colours and edges ("grey or silver"), which next month's AI step reads (R&D and AI Engineer, 2026-11-26).
 */
export const FULL_QUALITY = [0.8, 0.7] as const;
export const THUMB_QUALITY = 0.7;
export const MAX_BYTES = 1_000_000;

/** A picture's size scaled to fit within `side` on its longest edge (never made larger), whole pixels, at least 1. */
export function fitWithin(width: number, height: number, side: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, side / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** R2's own address for signed links (https://<account>.r2.cloudflarestorage.com/<bucket>/…), the default. */
export const R2_ORIGIN = 'https://*.r2.cloudflarestorage.com';

/**
 * Where stock photos are shown from and uploaded to, for the page's security header: IMS_PHOTO_ORIGIN
 * when set (a bucket behind its own address), else R2's. Only an https origin is taken; anything else
 * falls back to R2's, so a typo never opens the page to every site.
 */
export function imsPhotoOrigin(configured: string | null | undefined): string {
  const value = (configured ?? '').trim();
  if (/^https:\/\/(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return value.toLowerCase();
  return R2_ORIGIN;
}

/** Whether a JPEG fits the server's limit for its kind (full: 1 MB, list picture: 200 KB). */
export const THUMB_MAX_BYTES = 200 * 1024;

/**
 * The picture taken, made small on the phone: a full JPEG (longest side FULL_SIDE, quality lowered
 * until it fits MAX_BYTES) and a list picture (THUMB_SIDE). Browser only. The phone turns the picture
 * the right way up as it draws it (EXIF orientation), so a portrait photo stays portrait.
 */
export async function shrinkPhoto(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const draw = (side: number) => {
      const size = fitWithin(img.naturalWidth, img.naturalHeight, side);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx || size.width === 0) throw new Error('The photo could not be read');
      ctx.drawImage(img, 0, 0, size.width, size.height);
      return canvas;
    };
    const jpeg = (canvas: HTMLCanvasElement, quality: number) =>
      new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be made smaller'))), 'image/jpeg', quality));
    let full: Blob | null = null;
    for (const side of [FULL_SIDE, SMALLER_SIDE]) {
      const big = draw(side);
      for (const quality of FULL_QUALITY) {
        full = await jpeg(big, quality);
        if (full.size <= MAX_BYTES) break;
      }
      if (full && full.size <= MAX_BYTES) break;
    }
    const thumb = await jpeg(draw(THUMB_SIDE), THUMB_QUALITY);
    if (!full || full.size > MAX_BYTES || thumb.size > THUMB_MAX_BYTES) throw new Error('The photo is too big');
    return { full, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Where a photo's time is from: taken just now, the photo's own date, the file's date, or the upload. */
export type TakenAtSource = 'capture' | 'photo_info' | 'file_date' | 'upload';

/**
 * When a photo was taken, and how it came, read before it is made small (that drops the photo's own date).
 * A photo just taken with the camera button is "now" (unless its own date says it is old: then it counts as
 * from the library). One from the library: its EXIF date taken, else the file's date
 * (on Android often when it was copied or downloaded, so less sure), else now, said to be the upload's.
 */
export async function photoTime(
  file: Blob & { lastModified?: number },
  button: 'camera' | 'library',
  now: Date = new Date(),
): Promise<{ takenAt: Date; takenAtSource: TakenAtSource; source: 'camera' | 'library' }> {
  let fromPhoto: Date | null = null;
  try {
    fromPhoto = exifTakenAt(await file.slice(0, EXIF_READ_BYTES).arrayBuffer());
    if (fromPhoto && fromPhoto.getTime() > now.getTime() + CLOCK_SLACK_MS) fromPhoto = null;
  } catch {
    // unreadable: the file's date, then now
  }
  if (button === 'camera') {
    // a browser that ignores "camera only" lets an old photo be picked: its own date gives it away
    if (fromPhoto && fromPhoto.getTime() < now.getTime() - CAMERA_FRESH_MS) {
      return { takenAt: fromPhoto, takenAtSource: 'photo_info', source: 'library' };
    }
    return { takenAt: now, takenAtSource: 'capture', source: 'camera' };
  }
  if (fromPhoto) return { takenAt: fromPhoto, takenAtSource: 'photo_info', source: 'library' };
  const modified = file.lastModified;
  if (typeof modified === 'number' && modified > Date.UTC(1990, 0, 1) && modified <= now.getTime() + CLOCK_SLACK_MS) {
    return { takenAt: new Date(modified), takenAtSource: 'file_date', source: 'library' };
  }
  return { takenAt: now, takenAtSource: 'upload', source: 'library' };
}

/** A phone's clock may be a little ahead of the photo's. */
const CLOCK_SLACK_MS = 10 * 60_000;
/** A photo from the camera button whose own date is older than this was not taken just now. */
export const CAMERA_FRESH_MS = 5 * 60_000;
