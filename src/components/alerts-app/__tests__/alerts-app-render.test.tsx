/**
 * The alerts app's pages rendered with sample data (server render): the frame with its unread
 * count, the inbox with its sections, one alert with its answers and once answered, the settings,
 * the sign-in form and the install steps; English and Hindi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ALERTS_QUERY_KEY, PLANTS_QUERY_KEY, alertQueryKey } from '@/lib/alerts-app/model';
import type { MyAlert, MyAlertsPage } from '@/lib/alerts-app/types';
import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';

const nav = { pathname: '/', search: '' };
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
const auth = {
  user: { user_id: 'u-ravi', username: 'ravi@mill.in', email: 'ravi@mill.in', role: 'employee', factory_id: 'mill', status: 'active' },
  loading: false, logout: vi.fn(async () => {}), refresh: vi.fn(async () => {}),
};
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth, getClientCsrf: () => 'csrf' }));
vi.mock('@/lib/alerts-app/api', async (original) => {
  const mod = await original<typeof import('@/lib/alerts-app/api')>();
  return { ...mod, alertsApi: { ...mod.alertsApi, markRead: vi.fn(async () => ({ read_at: 'now' })) } };
});

const { AlertsAppShell } = await import('@/components/alerts-app/shell');
const { AlertsInbox } = await import('@/components/alerts-app/inbox');
const { AlertDetail } = await import('@/components/alerts-app/alert-detail');
const { AlertsSettings } = await import('@/components/alerts-app/settings');
const { AppLoginForm } = await import('@/components/alerts-app/login-form');
const { InstallGuide } = await import('@/components/alerts-app/install-guide');

const QUESTION = { kind: 'downtime_reason', report_id: 'rep-1', prompt: 'Why is it down?', options: [{ id: 'dtr|rep-1|changeover', label: 'Changeover' }, { id: 'dtr|rep-1|thread', label: 'Thread break' }, { id: 'dtr|rep-1|yarn_breakage', label: 'Yarn breakage' }] };
const now = new Date().toISOString();
const alert = (over: Partial<MyAlert> = {}): MyAlert => ({
  notification_id: 'ntf-1', factory_id: 'mill', factory_name: 'Shree Mills', type: 'machine_down', title: '🔴 Loom 3 is DOWN', severity: 'HIGH',
  message: 'Loom 3 stopped at 10:02.', machine_id: 'm3', machine_name: 'Loom 3', payload: null,
  created_at: now, read_at: null, resolved_at: null, resolution: null, ...over,
});
const DOWN = alert({ payload: QUESTION });
const SHIFT = alert({ notification_id: 'ntf-2', type: 'shift_reminder', title: 'Day Shift starts in 30 minutes', severity: 'MEDIUM', message: 'Be at Loom 3 by 7:00.', machine_name: null, read_at: now });
const OLD = alert({ notification_id: 'ntf-3', type: 'machine_up_config', title: 'Loom 7 is running again', severity: 'MEDIUM', message: 'Up after 12 min.', machine_name: 'Loom 7', created_at: '2026-01-05T04:00:00.000Z', read_at: '2026-01-05T04:05:00.000Z', resolved_at: '2026-01-05T04:10:00.000Z', resolution: 'Plain weave', payload: { ...QUESTION, kind: 'config_selection' } });
const page = (items: MyAlert[]): MyAlertsPage => ({ items, total: items.length, limit: 100, offset: 0, unread: items.filter((a) => !a.read_at).length });

function render(node: ReactNode, seed: (client: QueryClient) => void = () => {}, messages: Record<string, string> | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(client);
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>{node}</LocaleProvider>
    </QueryClientProvider>,
  ).replaceAll('<!-- -->', '');
}
const seedInbox = (items: MyAlert[]) => (c: QueryClient) => c.setQueryData(ALERTS_QUERY_KEY, page(items));

describe('the frame', () => {
  it('names the app, counts the unread ones, and holds Inbox and Settings', () => {
    const html = render(<AlertsAppShell><p>page</p></AlertsAppShell>, seedInbox([DOWN, SHIFT, OLD]));
    expect(html).toContain('FloorBeat Alerts');
    expect(html).toContain('aria-label="1 unread"');
    expect(html).toContain('>Inbox<');
    expect(html).toContain('>Settings<');
    expect(html).toMatch(/aria-current="page"[^>]*href="\/"/);
    expect(html).toContain('href="/settings"');
    expect(html).toContain('<p>page</p>');
  });

  it('links stay under /alerts-app when opened there', () => {
    nav.pathname = '/alerts-app/settings';
    try {
      const html = render(<AlertsAppShell><p>page</p></AlertsAppShell>, seedInbox([]));
      expect(html).toContain('href="/alerts-app"');
      expect(html).toMatch(/aria-current="page"[^>]*href="\/alerts-app\/settings"/);
    } finally {
      nav.pathname = '/';
    }
  });
});

describe('the inbox', () => {
  it('how many are new, the open question first, today\'s alerts, an old day by its date', () => {
    const html = render(<AlertsInbox />, seedInbox([DOWN, SHIFT, OLD]));
    expect(html).toContain('1 new alert');
    expect(html).toContain('Mark all as read');
    expect(html).toContain('Needs your answer');
    expect(html).toContain('🔴 Loom 3 is DOWN');
    expect(html).toContain('Loom 3');
    expect(html).toContain('Day Shift starts in 30 minutes');
    expect(html).toContain('>Today<');
    expect(html).toContain('5 Jan');
    expect(html).toContain('href="/alerts/ntf-1"');
    expect(html.indexOf('Needs your answer')).toBeLessThan(html.indexOf('>Today<'));
    expect(html).not.toContain('Shree Mills');   // one factory: not repeated on every row
  });

  it('names the factory on each row when the alerts come from several', () => {
    const html = render(<AlertsInbox />, seedInbox([DOWN, alert({ notification_id: 'ntf-9', factory_id: 'other', factory_name: 'Surat Unit' })]));
    expect(html).toContain('Loom 3 · Shree Mills');
    expect(html).toContain('Loom 3 · Surat Unit');
  });

  it('nothing yet: all caught up and what will come', () => {
    const html = render(<AlertsInbox />, seedInbox([]));
    expect(html).toContain('All caught up');
    expect(html).toContain('No alerts yet');
    expect(html).not.toContain('Mark all as read');
  });

  it('in Hindi', () => {
    const html = render(<AlertsInbox />, seedInbox([DOWN, SHIFT]), hi);
    expect(html).toContain('1 नया अलर्ट');
    expect(html).toContain('आपके जवाब का इंतज़ार');
    expect(html).toContain('>आज<');
  });

  it('an alert with its facts is said in the person\'s language; one without keeps its English title', () => {
    const facts = alert({ notification_id: 'ntf-v', payload: { ...QUESTION, view: { kind: 'machine_down', machine: 'Loom 3', at: now } } });
    const html = render(<AlertsInbox />, seedInbox([facts, SHIFT]), hi);
    expect(html).toContain('Loom 3 रुक गई');
    expect(html).toContain('Day Shift starts in 30 minutes');
    const detail = render(<AlertDetail id="ntf-v" />, (c) => c.setQueryData(alertQueryKey('ntf-v'), facts), hi);
    expect(detail).toContain('यह क्यों रुकी? नीचे एक जवाब पर टैप करें।');
    expect(detail).toContain('>धागा टूटना<');   // the reason, translated
    expect(detail).not.toContain('Why is it down?');
  });
});

describe('one alert', () => {
  it('what happened, where and when, and the answers it asks for', () => {
    const html = render(<AlertDetail id="ntf-1" />, (c) => c.setQueryData(alertQueryKey('ntf-1'), DOWN));
    expect(html).toContain('Machine stopped');
    expect(html).toContain('🔴 Loom 3 is DOWN');
    expect(html).toContain('Loom 3 · Shree Mills');
    expect(html).toContain('Loom 3 stopped at 10:02.');
    expect(html).toContain('Your answer');
    expect(html).toContain('Why is it down?');
    expect(html).toContain('>Changeover<');
    expect(html).toContain('>Thread break<');
    expect(html).toContain('href="/"');
  });

  it('once answered: the answer, no buttons', () => {
    const html = render(<AlertDetail id="ntf-3" />, (c) => c.setQueryData(alertQueryKey('ntf-3'), OLD));
    expect(html).toContain('Machine running again');
    expect(html).toContain('Answered: Plain weave');
    expect(html).not.toContain('>Changeover<');
  });

  it('a plain alert asks nothing', () => {
    const html = render(<AlertDetail id="ntf-2" />, (c) => c.setQueryData(alertQueryKey('ntf-2'), SHIFT));
    expect(html).toContain('Shift reminder');
    expect(html).not.toContain('Your answer');
  });

  it('in Hindi', () => {
    const html = render(<AlertDetail id="ntf-1" />, (c) => c.setQueryData(alertQueryKey('ntf-1'), DOWN), hi);
    expect(html).toContain('आपका जवाब');
    expect(html).toContain('इनबॉक्स पर वापस');
  });
});

describe('the settings', () => {
  it('notifications, the language, the account at its factory, sign-out, and what to do when alerts do not come', () => {
    const html = render(<AlertsSettings />, (c) => c.setQueryData(PLANTS_QUERY_KEY, { plants: [{ factory_id: 'mill', name: 'Shree Mills' }], current: 'mill' }));
    expect(html).toContain('Notifications');
    expect(html).toContain('Checking…');
    expect(html).toContain('Language');
    expect(html).toContain('Signed in as ravi@mill.in');
    expect(html).toContain('Shree Mills');
    expect(html).toContain('Sign out');
    expect(html).toContain('Alerts not arriving?');
    expect(html).toContain('href="/install"');
  });

  it('in Hindi', () => {
    const html = render(<AlertsSettings />, () => {}, hi);
    expect(html).toContain('नोटिफ़िकेशन');
    expect(html).toContain('साइन आउट');
  });
});

describe('signing in', () => {
  it('asks for the work email and the password, and renews a session first', () => {
    const html = render(<AppLoginForm />);
    expect(html).toContain('FloorBeat Alerts');
    expect(html).toContain('Sign in with your work email.');
    expect(html).toContain('Signing you in…');   // the renewal runs first; the form shows once it fails
    expect(html).toContain('floorbeat.in/privacy');
  });

  it('in Hindi', () => {
    const html = render(<AppLoginForm />, () => {}, hi);
    expect(html).toContain('अपने काम के ईमेल से साइन इन करें।');
  });
});

describe('installing', () => {
  it('the iPhone steps, the Android steps, or both', () => {
    const ios = render(<InstallGuide platform="ios" />);
    expect(ios).toContain('Install FloorBeat Alerts');
    expect(ios).toContain('On iPhone');
    expect(ios).toContain('Add to Home Screen');
    expect(ios).not.toContain('On Android');
    const android = render(<InstallGuide platform="android" />);
    expect(android).toContain('On Android');
    expect(android).toContain('Add to Home screen');
    expect(android).not.toContain('On iPhone');
    const other = render(<InstallGuide platform="other" />);
    expect(other).toContain('On iPhone');
    expect(other).toContain('On Android');
  });

  it('in Hindi', () => {
    const html = render(<InstallGuide platform="ios" />, () => {}, hi);
    expect(html).toContain('FloorBeat Alerts इंस्टॉल करें');
    expect(html).toContain('iPhone पर');
  });
});
