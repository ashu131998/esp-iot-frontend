import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The person's alerts sent with the page (lib/server/alerts-ahead.ts, 2026-11-27: "alert app is very slow"):
 * fetched where the page is drawn, next to the API, under the same keys the phone's queries use, so the inbox
 * shows at once; anything that goes wrong leaves them to the phone, as before, and never holds the page.
 */
vi.mock('server-only', () => ({}));
const fetchMock = vi.fn();
vi.mock('@/lib/internal-api-fetch', () => ({ internalApiFetch: (...args: unknown[]) => fetchMock(...args) }));

const { ALERTS_AHEAD_MS, alertsAhead } = await import('@/lib/server/alerts-ahead');
const { ALERTS_QUERY_KEY, alertQueryKey } = await import('@/lib/alerts-app/model');

const INBOX = { alerts: [{ notification_id: 'ntf-1', title: 'Loom 3 stopped' }], unread: 1, next: null };
const ALERT = { notification_id: 'ntf-1', title: 'Loom 3 stopped' };
const ok = (body: unknown) => ({ ok: true, json: async () => body });
const queries = (state: Awaited<ReturnType<typeof alertsAhead>>) => Object.fromEntries(state.queries.map((q) => [JSON.stringify(q.queryKey), q.state.data]));

// (in braces: a function handed back from beforeEach is run after the test as its clean-up)
beforeEach(() => { fetchMock.mockReset(); });

describe('the alerts sent with the page', () => {
  it('the inbox as the inbox asks for it (the first 100), under its own key, waiting at most 2 s', async () => {
    fetchMock.mockResolvedValue(ok(INBOX));
    const state = await alertsAhead();
    expect(fetchMock).toHaveBeenCalledWith('/v1/me/alerts?limit=100', { timeoutMs: ALERTS_AHEAD_MS });
    expect(ALERTS_AHEAD_MS).toBe(2000);
    expect(queries(state)).toEqual({ [JSON.stringify(ALERTS_QUERY_KEY)]: INBOX });
  });

  it('an alert\'s own page: that alert too, or only it where the layout sends the inbox', async () => {
    fetchMock.mockImplementation(async (path: string) => ok(path.includes('ntf-1') ? ALERT : INBOX));
    expect(queries(await alertsAhead({ alertId: 'ntf-1' }))).toEqual({
      [JSON.stringify(ALERTS_QUERY_KEY)]: INBOX,
      [JSON.stringify(alertQueryKey('ntf-1'))]: ALERT,
    });
    fetchMock.mockClear();
    expect(queries(await alertsAhead({ alertId: 'ntf-1', inbox: false }))).toEqual({ [JSON.stringify(alertQueryKey('ntf-1'))]: ALERT });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/v1/me/alerts/ntf-1');
  });

  it('signed out, refused, slow or away: nothing sent, left to the phone, never a failed page', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    expect((await alertsAhead()).queries).toEqual([]);
    fetchMock.mockRejectedValue(new Error('The operation timed out'));
    expect((await alertsAhead({ alertId: 'ntf-1' })).queries).toEqual([]);
  });
});
