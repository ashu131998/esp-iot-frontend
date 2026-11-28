import 'server-only';

import { dehydrate, QueryClient, type DehydratedState } from '@tanstack/react-query';

import { ALERTS_QUERY_KEY, alertQueryKey } from '@/lib/alerts-app/model';
import type { MyAlert, MyAlertsPage } from '@/lib/alerts-app/types';
import { internalApiFetch } from '@/lib/internal-api-fetch';

/**
 * The person's alerts, fetched where the page is drawn and sent with it (the owner, 2026-11-27: "alert app is
 * very slow"). Drawn in Frankfurt next to the API, they take tens of milliseconds there; asked for by the phone
 * after the page came, they cost it another trip to Europe and back through the site (0.4–1.1 s from India,
 * measured on stage). The phone's own queries take them as just fetched (lib/alerts-app/queries.ts, same keys)
 * and keep them fresh as before.
 */

/** How long a page waits for them: past this the phone asks itself, as it did before. */
export const ALERTS_AHEAD_MS = 2000;

async function quick<T>(path: string): Promise<T | null> {
  try {
    const res = await internalApiFetch(path, { timeoutMs: ALERTS_AHEAD_MS });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;   // not signed in, the API slow or away: the phone asks, as before
  }
}

/**
 * The inbox (the first 100, as the inbox asks: alertsApi.alerts({ limit: 100 })) and, for an alert's own page,
 * that alert: what the page's queries start with (`inbox: false` where the layout sends the inbox already).
 * Never throws; an empty state when nothing came.
 */
export async function alertsAhead({ alertId, inbox: withInbox = true }: { alertId?: string; inbox?: boolean } = {}): Promise<DehydratedState> {
  const client = new QueryClient();
  const [inbox, alert] = await Promise.all([
    withInbox ? quick<MyAlertsPage>('/v1/me/alerts?limit=100') : Promise.resolve(null),
    alertId ? quick<MyAlert>(`/v1/me/alerts/${encodeURIComponent(alertId)}`) : Promise.resolve(null),
  ]);
  if (inbox) client.setQueryData(ALERTS_QUERY_KEY, inbox);
  if (alert && alertId) client.setQueryData(alertQueryKey(alertId), alert);
  return dehydrate(client);
}
