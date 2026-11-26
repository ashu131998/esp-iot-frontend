/**
 * Photos waiting on the phone to be sent, like scans (sender.ts): Add stock never waits for weak Wi-Fi, and
 * a required photo can be taken with no connection at all. Each photo is made small first (photo.ts), so a
 * waiting one is about 0.3–1 MB. Where they are kept is given (photo-store.ts: the browser's IndexedDB), so
 * the sending is tested without a phone or a server.
 *
 * A photo is sent as: upload links (POST …/ims/photos, with its own photo_id, so asking twice is one photo),
 * both JPEGs straight to the bucket, then "they are there" (POST …/photos/:id/uploaded). The pallet need not
 * be in the system yet: its stock-in may still wait in the scan queue.
 */
import { ImsApiError, type PhotoLinkRequest } from './api';
import type { TakenAtSource } from './photo';
import { stopFor, type SendStop } from './sender';
import type { ApiPhotoLinks } from './types';

export interface PendingPhoto {
  /** The photo_id, made on the phone. */
  id: string;
  factoryId: string;
  pallet: string;
  /** The photo field it answers, or null (Add stock's own optional photo). */
  field: string | null;
  /**
   * The client_id of the stock-in it was taken with: the server ties the file to that scan, so a refused
   * stock-in's photo never lands on another load with the same label. Missing on photos kept before this.
   */
  stockIn?: string | null;
  source: 'camera' | 'library';
  takenAt: string;
  takenAtSource: TakenAtSource;
  full: Blob;
  thumb: Blob;
  addedAt: string;
  /** The server's reason when it would not take it: kept on the phone until the person removes it. */
  refused?: string | null;
}

export interface PhotoStore {
  list(factoryId: string): Promise<PendingPhoto[]>;
  put(photo: PendingPhoto): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface PhotoCalls {
  links(factoryId: string, photo: PhotoLinkRequest): Promise<ApiPhotoLinks>;
  putJpeg(url: string, jpeg: Blob): Promise<void>;
  uploaded(factoryId: string, photoId: string): Promise<unknown>;
}

/** At most this much waits on one phone (a few hundred photos): a phone kept offline for days does not fill up. */
export const PHOTO_QUEUE_MAX_BYTES = 200 * 1024 * 1024;

export const photoBytes = (p: Pick<PendingPhoto, 'full' | 'thumb'>) => p.full.size + p.thumb.size;

/** Whether one more photo still fits in what the phone keeps. */
export function photoFits(waiting: Array<Pick<PendingPhoto, 'full' | 'thumb'>>, photo: Pick<PendingPhoto, 'full' | 'thumb'>): boolean {
  return waiting.reduce((n, p) => n + photoBytes(p), 0) + photoBytes(photo) <= PHOTO_QUEUE_MAX_BYTES;
}

export interface PhotoSendReport {
  sent: number;
  refused: number;
  stop: SendStop | null;
}

/** The upload-link request for a waiting photo. */
export function linkRequest(p: PendingPhoto): PhotoLinkRequest {
  return {
    photo_id: p.id,
    taken_at: p.takenAt,
    pallet: p.pallet,
    ...(p.field ? { field: p.field } : {}),
    ...(p.stockIn ? { stock_in: p.stockIn } : {}),
    source: p.source,
    taken_at_source: p.takenAtSource,
  };
}

/**
 * Sends the factory's waiting photos, oldest first; never throws. A photo the server will not take (a field
 * removed while the phone was offline, too many photos for the pallet) is kept, marked with the reason, and
 * the next one is tried. The connection failing, or the session ending, stops it: those are tried again later.
 * An upload straight to the bucket that fails (a link expired, Wi-Fi gone) is tried again with new links.
 */
export async function sendPhotos(store: PhotoStore, calls: PhotoCalls, factoryId: string): Promise<PhotoSendReport> {
  const report: PhotoSendReport = { sent: 0, refused: 0, stop: null };
  const waiting = (await store.list(factoryId)).filter((p) => !p.refused).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  for (const photo of waiting) {
    try {
      const links = await calls.links(factoryId, linkRequest(photo));
      if (!links.uploaded) {
        try {
          await Promise.all([calls.putJpeg(links.full_put_url, photo.full), calls.putJpeg(links.thumb_put_url, photo.thumb)]);
        } catch {
          // the bucket, not our server: a link that expired or a dropped connection; new links next time
          report.stop = 'offline';
          return report;
        }
        await calls.uploaded(factoryId, links.photo_id);
      }
      await store.remove(photo.id);
      report.sent++;
    } catch (error) {
      const stop = stopFor(error);
      // "not uploaded yet": the bucket had not got it; tried again from the start next time
      if (stop === 'refused' && !(error instanceof ImsApiError && error.status === 409 && /not uploaded/i.test(error.message))) {
        await store.put({ ...photo, refused: error instanceof ImsApiError ? error.message : 'Refused' });
        report.refused++;
        continue;
      }
      report.stop = stop === 'refused' ? 'offline' : stop;
      return report;
    }
  }
  return report;
}
