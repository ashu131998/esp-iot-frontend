/**
 * A pallet's photo, sent while the phone is online: made small on the phone (photo.ts shrinkPhoto),
 * upload links asked for (POST …/ims/photos), both JPEGs put straight into the bucket, then the server
 * told they are there. The pallet need not be in the system yet: its stock-in may still be queued.
 * Browser only.
 */
import { imsApi } from './api';
import { newClientId } from './client-id';
import { shrinkPhoto } from './photo';

export async function uploadPalletPhoto(factoryId: string, pallet: string, file: Blob, takenAt: Date = new Date()): Promise<void> {
  const { full, thumb } = await shrinkPhoto(file);
  const links = await imsApi.photoLinks(factoryId, { photo_id: newClientId(), taken_at: takenAt.toISOString(), pallet });
  if (links.uploaded) return;
  await Promise.all([imsApi.putJpeg(links.full_put_url, full), imsApi.putJpeg(links.thumb_put_url, thumb)]);
  await imsApi.photoUploaded(factoryId, links.photo_id);
}
