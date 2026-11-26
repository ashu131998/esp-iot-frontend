/**
 * A photo sent at once, for a phone that cannot keep it to send later (no IndexedDB: a private window).
 * Otherwise photos go through the phone's photo queue (photo-queue.ts), which does the same steps: upload
 * links (POST …/ims/photos), both JPEGs straight into the bucket, then "they are there". Browser only.
 */
import { imsApi } from './api';
import { isAlreadyUploaded, linkRequest, type PendingPhoto } from './photo-queue';

export async function uploadReadyPhoto(factoryId: string, photo: PendingPhoto): Promise<void> {
  let links;
  try {
    links = await imsApi.photoLinks(factoryId, linkRequest(photo));
  } catch (error) {
    if (isAlreadyUploaded(error)) return;
    throw error;
  }
  if (links.uploaded) return;
  await Promise.all([imsApi.putJpeg(links.full_put_url, photo.full), imsApi.putJpeg(links.thumb_put_url, photo.thumb)]);
  await imsApi.photoUploaded(factoryId, links.photo_id);
}
