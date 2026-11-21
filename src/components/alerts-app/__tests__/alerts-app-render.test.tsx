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
const { AppGate } = await import('@/components/alerts-app/app-gate');
const { NotificationsGate, NotificationsStepScreen } = await import('@/components/alerts-app/notifications-gate');
const { LanguageChoice } = await import('@/components/alerts-app/language-choice');
const { PushPrompt } = await import('@/components/alerts-app/push-prompt');

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

  // The user, 2026-11-21: "in the camera alert i want image as well as check camera within the app".
  const TRUCK = alert({
    notification_id: 'ntf-cam', type: 'camera_truck', title: 'A truck at camera cam-478998 at Gate 1 (4:42 pm).', severity: 'MEDIUM',
    message: 'A truck at camera cam-478998 at Gate 1 (4:42 pm).', machine_id: null, machine_name: null,
    payload: { view: { kind: 'camera_truck', camera: 'cam-478998', machine: 'Gate 1', at: '2026-11-21T11:12:00.000Z', count: 1, picture_id: 42 } },
  });

  it('a camera alert: the picture sent with it, and the camera live a tap away, in the app', () => {
    const html = render(<AlertDetail id="ntf-cam" />, (c) => c.setQueryData(alertQueryKey('ntf-cam'), TRUCK));
    expect(html).toContain('>Camera<');
    expect(html).toContain('A truck at cam-478998 at Gate 1');
    expect(html).toContain('Seen at 04:42 pm.');
    expect(html).toContain('src="/api/v1/me/alerts/ntf-cam/picture"');
    expect(html).toContain('alt="The camera&#x27;s picture of this alert"');
    expect(html).toContain('Loading the picture…');
    expect(html).toContain('Check camera');
    expect(html).not.toContain('Cameras page');
    expect(html).not.toContain('Your answer');
  });

  it('a camera alert from before pictures came with them: the camera live only; in Hindi', () => {
    const older = { ...TRUCK, payload: { view: { kind: 'camera_hand', camera: 'cam-478998', machine: null, at: '2026-11-21T11:12:00.000Z' } } };
    const html = render(<AlertDetail id="ntf-cam" />, (c) => c.setQueryData(alertQueryKey('ntf-cam'), older), hi);
    expect(html).not.toContain('/picture');
    expect(html).toContain('कैमरा देखें');
    expect(html).toContain('>कैमरा<');
  });

  it('any other alert has no camera', () => {
    expect(render(<AlertDetail id="ntf-1" />, (c) => c.setQueryData(alertQueryKey('ntf-1'), DOWN))).not.toContain('Check camera');
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
    expect(html).not.toContain('href="/install"');   // the settings open only inside the installed app
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

describe('installing (what the app\'s address shows where the app does not open)', () => {
  it('Safari on an iPhone: the steps to the Home Screen, nothing else', () => {
    const html = render(<InstallGuide access="add-to-home" />);
    expect(html).toContain('Install FloorBeat Alerts');
    expect(html).toContain('On iPhone');
    expect(html).toContain('Tap the Share button at the bottom of Safari.');
    expect(html).toContain('Add to Home Screen');
    expect(html).toContain('Open this page in the Safari app.');   // an app's own Safari view has no Add to Home Screen
    expect(html).not.toContain('Open this page in Safari to install.');
    expect(html).not.toContain('On Android');
    expect(html).not.toContain('Open the app');
  });

  it('another browser on an iPhone: Safari first, with the address to copy', () => {
    const html = render(<InstallGuide access="use-safari" />);
    expect(html).toContain('Open this page in Safari to install.');
    expect(html).toContain('>alerts.floorbeat.in<');
    expect(html).toContain('Copy link');
    expect(html).toContain('Copy the link, open Safari and paste it in the address bar.');
    expect(html).toContain('Add to Home Screen');
  });

  it('a browser on Android: the APK to download, never a Home Screen copy', () => {
    const html = render(<InstallGuide access="get-android-app" />);
    expect(html).toContain('Get the FloorBeat Alerts app');
    expect(html).toContain('On Android, alerts come in the FloorBeat Alerts app, not in the browser.');
    expect(html).toContain('href="https://floorbeat.in/downloads/floorbeat-alerts.apk"');
    expect(html).toContain('Already installed? Open FloorBeat Alerts from your apps.');
    expect(html).toContain('href="https://floorbeat.in/app#android"');
    expect(html).not.toContain('Home Screen');
    expect(html).not.toContain('On iPhone');
  });

  it('a computer: how to get it on either phone', () => {
    const html = render(<InstallGuide access="phone-only" />);
    expect(html).toContain('FloorBeat Alerts is a phone app');
    expect(html).toContain('On your iPhone, open alerts.floorbeat.in in Safari, then tap Share and “Add to Home Screen”.');
    expect(html).toContain('On your Android phone, open floorbeat.in/app and download the app.');
    expect(html).not.toContain('Copy link');
  });

  it('inside the app (its /install page): installed, and where notifications are turned on', () => {
    const html = render(<InstallGuide access="open" />);
    expect(html).toContain('Installed. Open it from your Home Screen.');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('Open the app');
    expect(html).not.toContain('Download for Android');
  });

  it('in Hindi', () => {
    expect(render(<InstallGuide access="add-to-home" />, () => {}, hi)).toContain('FloorBeat Alerts इंस्टॉल करें');
    expect(render(<InstallGuide access="get-android-app" />, () => {}, hi)).toContain('Android के लिए डाउनलोड करें');
    expect(render(<InstallGuide access="phone-only" />, () => {}, hi)).toContain('FloorBeat Alerts फ़ोन का ऐप है');
  });
});

describe('the gate', () => {
  it('sends nothing of the app before the phone has said what it is (the server\'s page)', () => {
    const html = render(<AppGate><p>the inbox</p></AppGate>);
    expect(html).not.toContain('the inbox');
    expect(html).toContain('aria-busy="true"');
  });
});

describe('the first question in the app: the language', () => {
  it('asks in all three languages, with one big button for each', () => {
    const html = render(<LanguageChoice onChosen={() => {}} />);
    expect(html).toContain('Choose your language');
    expect(html).toContain('अपनी भाषा चुनें');
    expect(html).toContain('તમારી ભાષા પસંદ કરો');
    for (const name of ['English', 'हिन्दी', 'ગુજરાતી']) expect(html).toMatch(new RegExp(`<button[^>]*>${name}</button>`));
  });
});

describe('a phone: notifications on before the app (the iPhone app and the Android app alike)', () => {
  type Step = Parameters<typeof NotificationsStepScreen>[0]['step'];
  const screen = (step: Step, extra = {}, messages: Record<string, string> | null = null, phone: 'iphone' | 'android' = 'iphone') =>
    render(<NotificationsStepScreen step={step} phone={phone} onEnable={() => {}} onCheck={() => {}} {...extra} />, () => {}, messages);

  it('not on yet: why, the tap, "Allow", and the button', () => {
    const html = screen('turn-on');
    expect(html).toContain('FloorBeat Alerts works only with notifications on, so your phone rings the moment a machine stops.');
    expect(html).toContain('Tap “Turn on notifications” below.');
    expect(html).toContain('When your phone asks, tap “Allow”.');
    expect(screen('turn-on', {}, null, 'android')).toBe(html);   // the same screen on Android
    expect(html).toMatch(/<button[^>]*>Turn on notifications<\/button>/);
    expect(screen('turn-on', { busy: true })).toMatch(/<button[^>]*disabled=""[^>]*>Turning on…<\/button>/);
    expect(screen('turn-on', { failed: true })).toContain('Could not turn on notifications. Try again.');
    expect(html).not.toContain('Check again');
  });

  it('blocked by the phone: the way through that phone\'s Settings, and a look again', () => {
    const android = screen('blocked', {}, null, 'android');
    expect(android).toContain('Open your phone’s Settings, then “Apps”, then “FloorBeat Alerts”.');
    expect(android).toContain('Tap “Notifications” and turn them on.');
    expect(android).not.toContain('iPhone');
    const html = screen('blocked');
    expect(html).toContain('Notifications are blocked');
    expect(html).toContain('Open the Settings app on your iPhone.');
    expect(html).toContain('Tap “Notifications”, then “FloorBeat Alerts”.');
    expect(html).toContain('Turn on “Allow Notifications”.');
    expect(html).toContain('Come back here and tap “Turn on notifications”.');
    expect(html).toMatch(/<button[^>]*>Check again<\/button>/);
  });

  it('a phone too old for them: update it (the iPhone, or Chrome under the Android app)', () => {
    const android = screen('update', {}, null, 'android');
    expect(android).toContain('Update Chrome');
    expect(android).toContain('Open the Play Store and update Chrome.');
    const html = screen('update');
    expect(html).toContain('Update your iPhone');
    expect(html).toContain('iOS 16.4');
    expect(html).toContain('Open Settings, then General, then Software Update, and install the update.');
    expect(html).not.toContain('Check again');
    expect(html).not.toMatch(/>Turn on notifications</);
  });

  it('in Hindi and Gujarati', () => {
    expect(screen('turn-on', {}, hi)).toContain('जब फ़ोन पूछे, तो “Allow” पर टैप करें।');
    expect(screen('blocked', {}, hi)).toContain('नोटिफ़िकेशन ब्लॉक हैं');
  });

  it('in the server\'s page (not yet known to be a phone), the app as it is', () => {
    expect(render(<NotificationsGate><p>the inbox</p></NotificationsGate>)).toContain('the inbox');
  });
});

describe('the phone will not ring yet', () => {
  const prompt = (state: Parameters<typeof PushPrompt>[0]['state'], extra = {}) => render(<PushPrompt state={state} onEnable={() => {}} installHref="/install" {...extra} />);

  it('notifications off: says so, with the one button that fixes it', () => {
    const html = prompt('off');
    expect(html).toContain('Your phone will not ring yet');
    expect(html).toContain('Turn on notifications so your phone rings the moment a machine stops.');
    expect(html).toContain('>Turn on notifications<');
    expect(prompt('off', { busy: true })).toContain('>Turning on…<');
    expect(prompt('off', { failed: true })).toContain('Could not turn on notifications. Try again.');
  });

  it('an iPhone before the app is on the Home Screen: install first', () => {
    const html = prompt('needs-install');
    expect(html).toContain('Install the app on your Home Screen first');
    expect(html).toContain('href="/install"');
    expect(html).not.toContain('>Turn on notifications<');
  });

  it('blocked by the phone, or a browser that cannot: what to do, no button', () => {
    expect(prompt('blocked')).toContain('Notifications are blocked for this app.');
    expect(prompt('unsupported')).toContain('This browser cannot show notifications.');
    expect(prompt('blocked')).not.toContain('<button');
  });

  it('nothing once they are on, while checking, or when the server has none', () => {
    for (const state of ['on', 'checking', 'ok', 'server-off'] as const) expect(prompt(state)).toBe('');
  });

  it('in Hindi', () => {
    const html = render(<PushPrompt state="off" onEnable={() => {}} installHref="/install" />, () => {}, hi);
    expect(html).toContain('आपका फ़ोन अभी नहीं बजेगा');
  });

  it('the inbox says alerts ring only when they do', () => {
    const html = render(<AlertsInbox />, seedInbox([]));
    expect(html).toContain('New alerts show here.');            // not known to ring yet (still checking)
    expect(html).not.toContain('and ring your phone');
  });
});
