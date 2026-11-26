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
    const big = draw(FULL_SIDE);
    let full: Blob | null = null;
    for (const quality of FULL_QUALITY) {
      full = await jpeg(big, quality);
      if (full.size <= MAX_BYTES) break;
    }
    const thumb = await jpeg(draw(THUMB_SIDE), THUMB_QUALITY);
    if (!full || full.size > MAX_BYTES || thumb.size > THUMB_MAX_BYTES) throw new Error('The photo is too big');
    return { full, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}
