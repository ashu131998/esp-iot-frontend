/**
 * FloorBeat IMS's calls, through the BFF (/api/v1/factories/:id/ims/* → query-api /v1/factories/:id/ims/*).
 * Cookies carry the session; reads need nothing else.
 */
import { fetchWithSignal } from '@/lib/request-signal';

import type { ApiSetup, ApiStock } from './types';

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

async function get<T>(url: string, signal?: AbortSignal | null): Promise<T> {
  const res = await fetchWithSignal(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin', signal });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ImsApiError((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const imsApi = {
  /** Spec fields, products, locations: what the phone keeps. */
  setup: (factoryId: string, signal?: AbortSignal | null) => get<ApiSetup>(imsPath(factoryId, '/setup'), signal),
  stock: (factoryId: string, filterQuery: string, cursor: string | null, signal?: AbortSignal | null) =>
    get<ApiStock>(stockUrl(factoryId, filterQuery, cursor), signal),
};
