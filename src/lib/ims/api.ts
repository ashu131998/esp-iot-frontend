/**
 * FloorBeat IMS's calls, through the BFF (/api/v1/factories/:id/ims/* → query-api /v1/factories/:id/ims/*).
 * Cookies carry the session; reads need nothing else.
 */
import { fetchWithSignal } from '@/lib/request-signal';

import type { StockPage } from './types';

export class ImsApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ImsApiError';
  }
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
  stock: (factoryId: string, filterQuery: string, cursor: string | null, signal?: AbortSignal | null) =>
    get<StockPage>(stockUrl(factoryId, filterQuery, cursor), signal),
};
