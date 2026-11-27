/**
 * The alerts app's pure rules (lib/alerts-app): its address, what an alert asks and how it is
 * coloured, how the inbox is grouped, the app's inner addresses, whether a phone can receive
 * pushes, and which phone it is.
 */
import { describe, expect, it } from 'vitest';

import { isIOS, isIOSSafari, isStandalone, platformOf } from '@/lib/alerts-app/install';
import {
  afterSignIn, appBase, appPageOf, appPath, asksQuestion, cameraOf, dayKeyOf, dayLabel, factoriesIn, groupAlerts, optionsOf, severityTone, tabActive, titleOf, typeLabel, whereLabel,
} from '@/lib/alerts-app/model';
import { notificationsStep, pushState, pushSupport, subscriptionBody, urlBase64ToUint8Array } from '@/lib/alerts-app/push';
import type { MyAlert } from '@/lib/alerts-app/types';
import { alertsAppHost, isAlertsAppHost, isFactorySubdomain } from '@/lib/hosts';

const alert = (over: Partial<MyAlert> = {}): MyAlert => ({
  notification_id: 'ntf-1', factory_id: 'mill', factory_name: 'Shree Mills', type: 'machine_down', title: '🔴 Loom 3 is DOWN', severity: 'HIGH',
  message: 'Loom 3 stopped at 10:02.\nWhy?', machine_id: 'm3', machine_name: 'Loom 3', payload: null,
  created_at: '2026-11-17T04:32:00.000Z', read_at: null, resolved_at: null, resolution: null, ...over,
});
const QUESTION = { kind: 'downtime_reason', report_id: 'rep-1', prompt: 'Why is it down?', options: [{ id: 'dtr|rep-1|changeover', label: 'Changeover' }, { id: 'dtr|rep-1|thread', label: 'Thread break' }] };

describe('the app\'s address', () => {
  it('alerts.<suffix>, with or without the leading dot; none without a suffix', () => {
    expect(alertsAppHost('.floorbeat.in')).toBe('alerts.floorbeat.in');
    expect(alertsAppHost('stage.floorbeat.in')).toBe('alerts.stage.floorbeat.in');
    expect(alertsAppHost('')).toBeNull();
    expect(alertsAppHost(undefined)).toBeNull();
  });

  it('is that address only, any letter case, with or without a port; a factory\'s is not it', () => {
    expect(isAlertsAppHost('alerts.floorbeat.in', '.floorbeat.in')).toBe(true);
    expect(isAlertsAppHost('ALERTS.floorbeat.in:443', '.floorbeat.in')).toBe(true);
    expect(isAlertsAppHost('alerts.stage.floorbeat.in', '.stage.floorbeat.in')).toBe(true);
    expect(isAlertsAppHost('alerts.stage.floorbeat.in', '.floorbeat.in')).toBe(false);   // stage's app is not production's
    expect(isAlertsAppHost('shree-mills.floorbeat.in', '.floorbeat.in')).toBe(false);
    expect(isAlertsAppHost('alerts.floorbeat.in', null)).toBe(false);
    expect(isAlertsAppHost(null, '.floorbeat.in')).toBe(false);
  });

  it('a local run names it: ALERTS_APP_HOST', () => {
    expect(isAlertsAppHost('alerts.localhost:3000', null, 'alerts.localhost')).toBe(true);
    expect(isAlertsAppHost('localhost:3000', null, 'alerts.localhost')).toBe(false);
  });

  it('no factory can be called alerts', () => {
    expect(isFactorySubdomain('alerts')).toBe(false);
  });
});

describe('what an alert asks', () => {
  it('its answers, only well-formed ones; none once answered', () => {
    expect(optionsOf(alert({ payload: QUESTION }))).toEqual(QUESTION.options);
    expect(optionsOf(alert({ payload: { options: [{ id: 'x', label: '' }, { id: 1 }, null] as never } }))).toEqual([]);
    expect(optionsOf(alert())).toEqual([]);
    expect(asksQuestion(alert({ payload: QUESTION }))).toBe(true);
    expect(asksQuestion(alert({ payload: QUESTION, resolved_at: '2026-11-17T05:00:00Z' }))).toBe(false);
    expect(asksQuestion(alert())).toBe(false);
  });

  it('the title: as given, else the message\'s first line, else the kind of alert', () => {
    expect(titleOf(alert())).toBe('🔴 Loom 3 is DOWN');
    expect(titleOf(alert({ title: null }))).toBe('Loom 3 stopped at 10:02.');
    expect(titleOf(alert({ title: ' ', message: '', type: 'shift_reminder' }))).toBe('Shift reminder');
    expect(titleOf(alert({ title: null, message: '', type: 'custom_thing' }))).toBe('custom_thing');
  });

  it('red while a HIGH one is open, amber for MEDIUM, green once answered, grey otherwise', () => {
    expect(severityTone(alert())).toBe('bad');
    expect(severityTone(alert({ severity: 'medium' }))).toBe('warn');
    expect(severityTone(alert({ severity: 'LOW' }))).toBe('idle');
    expect(severityTone(alert({ severity: null }))).toBe('idle');
    expect(severityTone(alert({ resolved_at: '2026-11-17T05:00:00Z' }))).toBe('good');
  });

  it('the kind of alert in plain words', () => {
    expect(typeLabel('machine_down')).toBe('Machine stopped');
    expect(typeLabel('owner_machine_down')).toBe('Machine stopped');
    expect(typeLabel('machine_up_config')).toBe('Machine running again');
    expect(typeLabel('shift_reminder')).toBe('Shift reminder');
    expect(typeLabel('test')).toBe('Test alert');
    expect(typeLabel('camera_truck')).toBe('Camera');
    expect(typeLabel('camera_hand')).toBe('Camera');
    expect(typeLabel('camera_blocked')).toBe('Camera');
    expect(typeLabel('something_else')).toBeNull();
    expect(typeLabel(null)).toBeNull();
  });

  it('a camera alert\'s camera, and whether a picture came with it (the alert\'s page shows both)', () => {
    const view = (v: Record<string, unknown>) => alert({ type: String(v.kind), payload: { view: { camera: 'cam-478998', machine: 'Gate 1', at: '2026-11-21T11:12:00Z', ...v } } });
    expect(cameraOf(view({ kind: 'camera_truck', picture_id: 42 }))).toEqual({ deviceId: 'cam-478998', picture: true });
    expect(cameraOf(view({ kind: 'camera_hand', picture_id: '42' }))).toEqual({ deviceId: 'cam-478998', picture: true });
    // its picture came after the alert: found by the camera's event
    expect(cameraOf(view({ kind: 'camera_blocked', picture_id: null, ev: 777 }))).toEqual({ deviceId: 'cam-478998', picture: true });
    // told before the alerts carried their picture: the camera live only
    expect(cameraOf(view({ kind: 'camera_truck' }))).toEqual({ deviceId: 'cam-478998', picture: false });
    expect(cameraOf(view({ kind: 'camera_truck', picture_id: 0 }))).toEqual({ deviceId: 'cam-478998', picture: false });
    expect(cameraOf(view({ kind: 'camera_truck', camera: '' }))).toBeNull();
    expect(cameraOf(view({ kind: 'machine_down', picture_id: 42 }))).toBeNull();
    expect(cameraOf(alert({ payload: null }))).toBeNull();
  });
});

describe('the inbox\'s sections', () => {
  const now = new Date('2026-11-17T09:00:00.000Z');   // 14:30 IST on the 17th

  it('days are factory days (IST): late evening UTC is already tomorrow', () => {
    expect(dayKeyOf('2026-11-17T20:30:00.000Z')).toBe('2026-11-18');
    expect(dayKeyOf('2026-11-17T04:32:00.000Z')).toBe('2026-11-17');
    expect(dayLabel('2026-11-17', now)).toBe('Today');
    expect(dayLabel('2026-11-16', now)).toBe('Yesterday');
    expect(dayLabel('2026-11-10', now)).toBeNull();
  });

  it('open questions first (newest first), then every other alert by day, newest first', () => {
    const items = [
      alert({ notification_id: 'old-answered', payload: QUESTION, resolved_at: '2026-11-10T06:00:00Z', created_at: '2026-11-10T05:00:00.000Z' }),
      alert({ notification_id: 'q-old', payload: QUESTION, created_at: '2026-11-16T05:00:00.000Z' }),
      alert({ notification_id: 'today-1', type: 'shift_reminder', created_at: '2026-11-17T03:00:00.000Z' }),
      alert({ notification_id: 'q-new', payload: QUESTION, created_at: '2026-11-17T04:40:00.000Z' }),
      alert({ notification_id: 'today-2', created_at: '2026-11-17T04:35:00.000Z' }),
    ];
    const groups = groupAlerts(items);
    expect(groups.needsAnswer.map((a) => a.notification_id)).toEqual(['q-new', 'q-old']);
    expect(groups.days.map((d) => [d.key, d.items.map((a) => a.notification_id)])).toEqual([
      ['2026-11-17', ['today-2', 'today-1']],
      ['2026-11-10', ['old-answered']],
    ]);
    expect(groupAlerts([])).toEqual({ needsAnswer: [], days: [] });
  });

  it('names the factory on each row only when the inbox spans several', () => {
    expect(factoriesIn([alert(), alert({ factory_id: 'mill' })])).toBe(1);
    expect(factoriesIn([alert(), alert({ factory_id: 'other' })])).toBe(2);
    expect(whereLabel(alert(), false)).toBe('Loom 3');
    expect(whereLabel(alert(), true)).toBe('Loom 3 · Shree Mills');
    expect(whereLabel(alert({ machine_name: null }), true)).toBe('Shree Mills');
    expect(whereLabel(alert({ machine_name: null, factory_name: null }), true)).toBe('');
  });
});

describe('the app\'s inner addresses', () => {
  it('plain on its own address, under /alerts-app when opened there', () => {
    expect(appBase('/settings')).toBe('');
    expect(appBase('/alerts-app/settings')).toBe('/alerts-app');
    expect(appBase('/alerts-app')).toBe('/alerts-app');
    expect(appBase('/alerts-application')).toBe('');
    expect(appBase(null)).toBe('');
    expect(appPath('/alerts-app/settings')).toBe('/settings');
    expect(appPath('/alerts-app')).toBe('/');
    expect(appPath('/alerts/ntf-1')).toBe('/alerts/ntf-1');
    expect(appPath(undefined)).toBe('/');
  });

  it('the bottom bar: the inbox owns / and every alert; settings its page', () => {
    expect(tabActive('inbox', '/')).toBe(true);
    expect(tabActive('inbox', '/alerts/ntf-1')).toBe(true);
    expect(tabActive('inbox', '/alerts-app/alerts/ntf-1')).toBe(true);
    expect(tabActive('inbox', '/settings')).toBe(false);
    expect(tabActive('settings', '/alerts-app/settings')).toBe(true);
    expect(tabActive('settings', '/')).toBe(false);
  });

  it('inside the FloorBeat app the alerts\' screens are under /inbox, links included', () => {
    expect(appBase('/inbox')).toBe('/inbox');
    expect(appBase('/inbox/alerts/ntf-1')).toBe('/inbox');
    expect(appBase('/inboxes')).toBe('');
    expect(appPath('/inbox')).toBe('/');
    expect(appPath('/inbox/settings')).toBe('/settings');
    expect(tabActive('inbox', '/inbox')).toBe(true);
    expect(tabActive('inbox', '/inbox/alerts/ntf-1')).toBe(true);
    expect(tabActive('settings', '/inbox/settings')).toBe(true);
    expect(appPageOf('/inbox/alerts/ntf-1')).toEqual({ page: 'alert', id: 'ntf-1' });
    expect(appPageOf('/inbox')).toEqual({ page: 'inbox' });
  });

  it('which page an address is, so a tap can draw it at once: the inbox, the settings, one alert', () => {
    expect(appPageOf('/')).toEqual({ page: 'inbox' });
    expect(appPageOf('/alerts-app')).toEqual({ page: 'inbox' });
    expect(appPageOf('/settings')).toEqual({ page: 'settings' });
    expect(appPageOf('/alerts-app/settings')).toEqual({ page: 'settings' });
    expect(appPageOf('/alerts/ntf-9572c59b-02b')).toEqual({ page: 'alert', id: 'ntf-9572c59b-02b' });
    expect(appPageOf('/alerts-app/alerts/ntf-1')).toEqual({ page: 'alert', id: 'ntf-1' });
    expect(appPageOf('/alerts/ntf-1?from=push#top')).toEqual({ page: 'alert', id: 'ntf-1' });
    expect(appPageOf('/alerts/a%20b')).toEqual({ page: 'alert', id: 'a b' });
  });

  it('any other address is none of them (the shell then shows a skeleton)', () => {
    for (const other of ['/alerts', '/alerts/', '/alerts/ntf-1/extra', '/settings/sound', '/login', '/install', '/alerts/%E0%A4%A', null, undefined]) {
      expect(appPageOf(other), String(other)).toBeNull();
    }
  });
});

describe('where the app goes once signed in (the sign-in has no address of its own)', () => {
  it('the page named in ?next=, else the page the sign-in was shown on, else the inbox', () => {
    expect(afterSignIn('/settings', '/')).toBe('/settings');
    expect(afterSignIn(null, '/alerts/ntf-1')).toBe('/alerts/ntf-1');
    expect(afterSignIn(null, '/alerts/ntf-1?x=1')).toBe('/alerts/ntf-1?x=1');
    expect(afterSignIn(null, '/')).toBe('/');
    expect(afterSignIn(null, null)).toBe('/');
  });

  it('never the sign-in itself, never another site', () => {
    expect(afterSignIn('/login', '/login')).toBe('/');
    expect(afterSignIn('/login?next=%2Fsettings', null)).toBe('/');
    expect(afterSignIn(null, '/alerts-app/login', '/alerts-app')).toBe('/alerts-app');   // the app's inner address: its own inbox
    expect(afterSignIn('//evil.example', '/settings')).toBe('/settings');
    expect(afterSignIn('https://evil.example/', null)).toBe('/');
  });
});

describe('whether this phone can receive pushes', () => {
  const full = { serviceWorker: true, pushManager: true, notification: true, ios: false, standalone: false };

  it('Android Chrome and desktop browsers as they are; an iPhone only once on the Home Screen', () => {
    expect(pushSupport(full)).toBe('ok');
    expect(pushSupport({ ...full, ios: true })).toBe('needs-install');
    expect(pushSupport({ ...full, ios: true, standalone: true })).toBe('ok');
    expect(pushSupport({ ...full, ios: true, standalone: true, pushManager: false })).toBe('needs-install');   // an old iOS: still "install" rather than "never"
    expect(pushSupport({ ...full, pushManager: false })).toBe('unsupported');
    expect(pushSupport({ ...full, serviceWorker: false })).toBe('unsupported');
    expect(pushSupport({ ...full, notification: false })).toBe('unsupported');
  });

  it('the switch\'s state', () => {
    expect(pushState('ok', 'granted', true, true)).toBe('on');
    expect(pushState('ok', 'granted', false, true)).toBe('off');
    expect(pushState('ok', 'default', false, true)).toBe('off');
    expect(pushState('ok', 'denied', false, true)).toBe('blocked');
    expect(pushState('ok', 'granted', true, false)).toBe('server-off');
    expect(pushState('needs-install', 'default', false, true)).toBe('needs-install');
    expect(pushState('unsupported', null, false, true)).toBe('unsupported');
  });

  it('a phone\'s app opens once notifications are on; until then the step that gets them on', () => {
    expect(notificationsStep('on')).toBe('app');
    expect(notificationsStep('off')).toBe('turn-on');
    expect(notificationsStep('blocked')).toBe('blocked');
    expect(notificationsStep('unsupported')).toBe('update');
    expect(notificationsStep('needs-install')).toBe('update');   // inside the installed app: an iOS before 16.4
    expect(notificationsStep('server-off')).toBe('app');             // the server cannot send: the phone is not held back
    expect(notificationsStep('checking')).toBe('checking');
    expect(notificationsStep('ok')).toBe('checking');
  });

  it('the server\'s key as bytes (base64url, unpadded)', () => {
    expect([...urlBase64ToUint8Array('AQID')]).toEqual([1, 2, 3]);
    expect([...urlBase64ToUint8Array('AQI-_w')]).toEqual([1, 2, 62, 255]);
  });

  it('the subscription as the server takes it; nothing without an https endpoint and both keys', () => {
    expect(subscriptionBody({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } })).toEqual({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } });
    expect(subscriptionBody({ endpoint: 'http://push.example/abc', keys: { p256dh: 'p', auth: 'a' } })).toBeNull();
    expect(subscriptionBody({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p' } })).toBeNull();
    expect(subscriptionBody(null)).toBeNull();
  });
});

describe('which phone this is', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0 Mobile/15E148 Safari/604.1';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

  it('iPhone, Android, other', () => {
    expect(platformOf(IPHONE)).toBe('ios');
    expect(platformOf(IPHONE_CHROME)).toBe('ios');
    expect(platformOf(ANDROID)).toBe('android');
    expect(platformOf(MAC)).toBe('other');
    expect(platformOf(null)).toBe('other');
    expect(isIOS(IPHONE)).toBe(true);
    expect(isIOS(ANDROID)).toBe(false);
  });

  it('Safari itself on an iPhone, not Chrome for iOS', () => {
    expect(isIOSSafari(IPHONE)).toBe(true);
    expect(isIOSSafari(IPHONE_CHROME)).toBe(false);
    expect(isIOSSafari(MAC)).toBe(false);
  });

  it('on the Home Screen: iOS says so on navigator, others through the display mode', () => {
    expect(isStandalone({ navigatorStandalone: true })).toBe(true);
    expect(isStandalone({ displayModeStandalone: true })).toBe(true);
    expect(isStandalone({ navigatorStandalone: false, displayModeStandalone: false })).toBe(false);
    expect(isStandalone({})).toBe(false);
  });
});
