/**
 * Stock photos are made small on the phone before they are sent: a full picture for the pallet's
 * page and a small one for lists. Factory Wi-Fi is weak, and the server takes at most 1 MB.
 */

/** Longest side of the full picture and of the list picture, in pixels. */
export const FULL_SIDE = 1600;
export const THUMB_SIDE = 320;
/** JPEG quality for each; the full one is tried lower until it fits. */
export const FULL_QUALITY = [0.8, 0.7, 0.6, 0.5] as const;
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
