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
