/**
 * FloorBeat IMS's calls, through the BFF (/api/v1/factories/:id/ims/* → query-api /v1/factories/:id/ims/*).
 * Cookies carry the session; reads need nothing else, writes the CSRF header.
 */
import { csrfFromCookie } from '@/lib/csrf';
import { fetchWithSignal } from '@/lib/request-signal';

import type { Movement, MovementResult } from './queue';
import type { ApiPhotoLinks, ApiPicture, ApiScan, ApiSetup, ApiStock } from './types';

export class ImsApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ImsApiError';
  }
}

/** Whether an error says the IMS is not switched on for the factory (that 403 of the API's), not a passing fault. */
export function isImsOff(error: unknown): boolean {
  return error instanceof ImsApiError && error.status === 403 && /not switched on/i.test(error.message);
}

/**
 * What went wrong loading the stock, for the words on the screen:
 *  - off: the IMS is not switched on for the factory;
 *  - filter: the API refused the filter in the address (422: a choice or a spec that is no longer there,
 *    say from an old bookmark);
 *  - denied: any other refusal (a disabled account, no access to this factory);
 *  - other: the network or the server; worth trying again.
 */
export function stockProblem(error: unknown): 'off' | 'filter' | 'denied' | 'other' | null {
  if (!error) return null;
  if (isImsOff(error)) return 'off';
  if (error instanceof ImsApiError && error.status === 422) return 'filter';
  if (error instanceof ImsApiError && (error.status === 401 || error.status === 403)) return 'denied';
  return 'other';
}

/**
 * Whether a failed call is worth asking again (TanStack Query's retry): a refusal (4xx) gives the same
 * answer every time, so it is shown at once; a network or server fault is asked again, twice more.
 */
export function retryImsCall(failures: number, error: unknown): boolean {
  if (error instanceof ImsApiError && error.status >= 400 && error.status < 500) return false;
  return failures < 2;
}

/** The BFF address of one of a factory's IMS calls: imsPath('f1', '/stock') → /api/v1/factories/f1/ims/stock. */
export function imsPath(factoryId: string, sub: string): string {
  return `/api/v1/factories/${encodeURIComponent(factoryId)}/ims${sub.startsWith('/') ? sub : `/${sub}`}`;
}

/** The stock call for a filter (its query, lib/ims/stock-filter.ts) and the page after `cursor`. */
export function stockUrl(factoryId: string, filterQuery: string, cursor: string | null): string {
  const params = [filterQuery, cursor ? `cursor=${encodeURIComponent(cursor)}` : ''].filter(Boolean).join('&');
  return `${imsPath(factoryId, '/stock')}${params ? `?${params}` : ''}`;
}

async function answer<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ImsApiError((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

async function get<T>(url: string, signal?: AbortSignal | null, timeoutMs?: number): Promise<T> {
  return answer<T>(await fetchWithSignal(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin', signal, timeoutMs }));
}

/** How long a label check waits: Wi-Fi up with the internet down should not hold up every pallet for 15 s. */
export const SCAN_CHECK_MS = 6_000;

/** A write: JSON in and out, with the CSRF header; given up on after `timeoutMs` (weak factory Wi-Fi). */
async function post<T>(url: string, body: unknown, timeoutMs = 20_000): Promise<T> {
  return answer<T>(await fetchWithSignal(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfFromCookie() },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
    timeoutMs,
  }));
}

/** A photo's JPEG straight to the bucket by its signed link (no cookies: it is not our server). */
async function putJpeg(url: string, jpeg: Blob): Promise<void> {
  const res = await fetchWithSignal(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg, credentials: 'omit', timeoutMs: 60_000 });
  if (!res.ok) throw new ImsApiError(`Upload failed (${res.status})`, res.status);
}

export const imsApi = {
  /** Spec fields, products, locations: what the phone keeps. */
  setup: (factoryId: string, signal?: AbortSignal | null) => get<ApiSetup>(imsPath(factoryId, '/setup'), signal),
  stock: (factoryId: string, filterQuery: string, cursor: string | null, signal?: AbortSignal | null) =>
    get<ApiStock>(stockUrl(factoryId, filterQuery, cursor), signal),
  /** What a scanned code is (a location, a pallet, a new label of ours, or none). */
  scan: (factoryId: string, code: string, signal?: AbortSignal | null) =>
    get<ApiScan>(imsPath(factoryId, `/scan/${encodeURIComponent(code)}`), signal, SCAN_CHECK_MS),
  /** The queued scans; one result per client_id. */
  sendMovements: async (factoryId: string, movements: Movement[]) =>
    (await post<{ results: MovementResult[] }>(imsPath(factoryId, '/movements'), { movements })).results,
  /** Upload links for a pallet's photo (made on the phone: photo_id). */
  photoLinks: (factoryId: string, photo: { photo_id: string; taken_at: string; pallet: string }) =>
    post<ApiPhotoLinks>(imsPath(factoryId, '/photos'), photo),
  putJpeg,
  photoUploaded: (factoryId: string, photoId: string) =>
    post<ApiPicture>(imsPath(factoryId, `/photos/${encodeURIComponent(photoId)}/uploaded`), {}),
};
