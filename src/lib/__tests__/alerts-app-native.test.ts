/**
 * The Android app around the pages (lib/alerts-app/native.ts, and the notification switch asking it
 * in push-client.ts), with a stand-in app: the page asks the app over window.FloorBeatAndroid and hears
 * what it saw; notifications are the app's permission and its Firebase registration (the server told
 * the phone's FID on every open, and forgotten at sign-out); the back button closes an open view
 * first; a push the app received refreshes the inbox.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ key: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), testPush: vi.fn(), registerAndroid: vi.fn(), unregisterAndroid: vi.fn() }));
vi.mock('@/lib/alerts-app/api', () => ({ alertsApi: api }));

const { BATTERY_DONE_KEY, batteryStepNeeded, callNative, holdBack, holdBackOnce, inNativeApp, nativeAppVersion, onNativeEvent } = await import('@/lib/alerts-app/native');
const { currentState, followAlerts, forgetThisPhone, keepSubscriptionFresh, subscribedHere, turnOff, turnOn } = await import('@/lib/alerts-app/push-client');
const { accessHere, phoneHere } = await import('@/lib/alerts-app/access-client');

const APP_UA = 'Mozilla/5.0 (Linux; Android 14; SM-A146B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0 Mobile Safari/537.36 FloorBeatAlerts/2.0.0 (Android)';
const HELLO = { version: '2.0.0', notifications: 'on', push: true, maker: 'xiaomi', unrestricted: false, autostart: true, android: 34 };

/** The Android app as the page sees it: its bridge answers each call (`answers`), and can tell the page things. */
function app(answers: Record<string, unknown> = {}, { userAgent = APP_UA, bridge = true } = {}) {
  const listeners = new Set<(event: MessageEvent) => void>();
  const asked: Array<{ call: string; [key: string]: unknown }> = [];
  const send = (data: unknown) => listeners.forEach((fn) => fn({ data: JSON.stringify(data) } as MessageEvent));
  const port = {
    postMessage: vi.fn((message: string) => {
      const request = JSON.parse(message);
      asked.push(request);
      if (request.call in answers) queueMicrotask(() => send({ id: request.id, result: answers[request.call] }));
    }),
    addEventListener: (_: string, fn: (event: MessageEvent) => void) => listeners.add(fn),
  };
  const doc = { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn(), referrer: '', documentElement: { lang: 'hi' } };
  vi.stubGlobal('window', { ...(bridge ? { FloorBeatAndroid: port } : {}), localStorage: { getItem: () => null, setItem: () => {} } });
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 5 });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('caches', undefined);
  vi.stubGlobal('BroadcastChannel', undefined);
  const raw = (data: string) => listeners.forEach((fn) => fn({ data } as MessageEvent));
  return { port, asked, raw, tell: (event: string, value?: string) => send(value === undefined ? { event } : { event, value }) };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the rules', () => {
  it('the app\'s version from its user agent', () => {
    expect(nativeAppVersion(APP_UA)).toBe('2.0.0');
    expect(nativeAppVersion('Mozilla/5.0 (Linux; Android 14) Chrome/140.0 Mobile Safari/537.36')).toBeNull();
    expect(nativeAppVersion(undefined)).toBeNull();
  });

  it('the battery set-up: once, unless Android runs the app unrestricted and the maker has no auto-start screen', () => {
    const hello = HELLO as Parameters<typeof batteryStepNeeded>[0];
    expect(batteryStepNeeded(hello, false)).toBe(true);
    expect(batteryStepNeeded(hello, true)).toBe(false);
    expect(batteryStepNeeded({ ...hello!, unrestricted: true, autostart: false }, false)).toBe(false);
    expect(batteryStepNeeded({ ...hello!, unrestricted: true, autostart: true }, false)).toBe(true);
    expect(batteryStepNeeded(null, false)).toBe(false);
    expect(BATTERY_DONE_KEY).toBe('fb-alerts-battery-done');
  });
});

describe('asking the app', () => {
  it('a call is answered by its id; what the app tells the page is heard; outside the app, nothing', async () => {
    const a = app({ hello: HELLO });
    expect(inNativeApp()).toBe(true);
    expect(await callNative('hello')).toEqual(HELLO);
    expect(a.asked).toEqual([{ id: expect.any(Number), call: 'hello' }]);
    const heard: string[] = [];
    const stop = onNativeEvent((event, value) => heard.push(`${event}:${value}`));
    a.tell('push', 'ntf-1');
    stop();
    a.tell('push', 'ntf-2');
    expect(heard).toEqual(['push:ntf-1']);
    app({}, { bridge: false, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/140.0' });
    expect(inNativeApp()).toBe(false);
    expect(await callNative('hello')).toBeNull();
  });

  it('no answer in time: null; an app too old for the bridge is still known by its user agent', async () => {
    vi.useFakeTimers();
    app({});
    const asking = callNative('hello', {}, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await asking).toBeNull();
    app({}, { bridge: false });
    expect(inNativeApp()).toBe(true);
  });

  it('whatever else comes over the bridge is passed over; a bridge that will not take a message answers nothing', async () => {
    const a = app({ hello: HELLO });
    const heard: string[] = [];
    const stop = onNativeEvent((event, value) => heard.push(`${event}:${value}`));
    a.raw('not json');
    a.raw(JSON.stringify({ something: 'else' }));
    a.tell('notifications');   // an event without a value
    expect(heard).toEqual(['notifications:']);
    stop();
    a.port.postMessage.mockImplementationOnce(() => { throw new Error('gone'); });
    expect(await callNative('hello')).toBeNull();
    a.port.postMessage.mockImplementationOnce((message: string) => a.raw(JSON.stringify({ id: JSON.parse(message).id })));
    expect(await callNative('hello')).toBeNull();   // an answer without a result
  });

  it('the back button closes the latest held view first, then lets the app go back', () => {
    app();
    const closeLive = vi.fn();
    const closeSheet = vi.fn();
    const releaseLive = holdBack(closeLive);
    const releaseSheet = holdBack(closeSheet);
    const back = (window as unknown as { floorbeatBack: () => boolean }).floorbeatBack;
    expect(back()).toBe(true);
    expect(closeSheet).toHaveBeenCalledTimes(1);
    releaseSheet();
    expect(back()).toBe(true);
    expect(closeLive).toHaveBeenCalledTimes(1);
    releaseLive();
    releaseLive();   // released twice: nothing more
    expect(back()).toBe(false);
  });

  it('a sheet or a menu holds it once: a second press straight after is not taken by what has just closed', () => {
    app();
    const closeLive = vi.fn();
    const closeSheet = vi.fn();
    holdBack(closeLive);
    const releaseSheet = holdBackOnce(closeSheet);
    const back = (window as unknown as { floorbeatBack: () => boolean }).floorbeatBack;
    expect(back()).toBe(true);
    expect(closeSheet).toHaveBeenCalledTimes(1);
    expect(back()).toBe(true);                       // the next press goes to what is under it
    expect(closeSheet).toHaveBeenCalledTimes(1);
    expect(closeLive).toHaveBeenCalledTimes(1);
    releaseSheet();   // its own release (the sheet gone from the page) after it was used: nothing more
    expect(back()).toBe(true);
    expect(closeLive).toHaveBeenCalledTimes(2);
    const releaseMenu = holdBackOnce(closeSheet);   // closed another way (its X): released, never used
    releaseMenu();
    expect(back()).toBe(true);
    expect(closeSheet).toHaveBeenCalledTimes(1);
  });
});

describe('notifications in the app', () => {
  it('the switch is the app\'s permission: on (and pushable), off, blocked, a build without push, an app too old', async () => {
    app({ hello: HELLO });
    expect(await currentState()).toBe('on');
    expect(await subscribedHere()).toBe(true);
    app({ hello: { ...HELLO, notifications: 'off' } });
    expect(await currentState()).toBe('off');
    expect(await subscribedHere()).toBe(false);
    app({ hello: { ...HELLO, notifications: 'blocked' } });
    expect(await currentState()).toBe('blocked');
    app({ hello: { ...HELLO, push: false } });
    expect(await currentState()).toBe('server-off');
    app({}, { bridge: false });
    vi.useFakeTimers();
    const old = currentState();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await old).toBe('unsupported');
  });

  it('turning on: the phone asks; allowed, the server is told where to push (the FID, the language, the version)', async () => {
    api.registerAndroid.mockResolvedValue({ registered: true, replaced: 0, devices: 1 });
    const a = app({ askNotifications: { state: 'on' }, hello: HELLO, installation: { fid: 'fid-abc123' } });
    expect(await turnOn()).toBe('on');
    expect(a.asked.map((r) => r.call)).toEqual(['askNotifications', 'hello', 'installation']);
    expect(api.registerAndroid).toHaveBeenCalledWith({ fid: 'fid-abc123', locale: 'hi', app_version: '2.0.0' });
    app({ askNotifications: { state: 'blocked' } });
    expect(await turnOn()).toBe('blocked');
    app({ askNotifications: { state: 'off' } });
    expect(await turnOn()).toBe('off');
    expect(api.registerAndroid).toHaveBeenCalledTimes(1);
  });

  it('every open tells the server again (only when notifications are on); sign-out and turning off forget the phone', async () => {
    api.registerAndroid.mockResolvedValue({});
    api.unregisterAndroid.mockResolvedValue({ removed: true });
    app({ hello: HELLO, installation: { fid: 'fid-abc123' } });
    await keepSubscriptionFresh();
    expect(api.registerAndroid).toHaveBeenCalledTimes(1);
    await forgetThisPhone();
    await turnOff();
    expect(api.unregisterAndroid.mock.calls).toEqual([['fid-abc123'], ['fid-abc123']]);
    app({ hello: { ...HELLO, notifications: 'off' }, installation: { fid: 'fid-abc123' } });
    await keepSubscriptionFresh();
    expect(api.registerAndroid).toHaveBeenCalledTimes(1);
    app({ hello: HELLO, installation: { fid: '' } });
    await keepSubscriptionFresh();
    expect(api.registerAndroid).toHaveBeenCalledTimes(1);   // no FID yet: nothing to tell
    app({}, { bridge: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' });
    await forgetThisPhone();
    expect(api.unregisterAndroid).toHaveBeenCalledTimes(2);   // not the app: nothing
  });

  it('a build without push, or an app too old for the question: never told to the server', async () => {
    api.registerAndroid.mockResolvedValue({});
    app({ askNotifications: { state: 'on' }, hello: { ...HELLO, push: false }, installation: { fid: 'fid-abc123' } });
    expect(await turnOn()).toBe('server-off');
    app({}, { bridge: false });
    expect(await turnOn()).toBe('unsupported');
    expect(api.registerAndroid).not.toHaveBeenCalled();
  });

  it('the language told with the FID: Gujarati, or English for anything else; a bridge without the user-agent mark: no version', async () => {
    api.registerAndroid.mockResolvedValue({});
    app({ hello: HELLO, installation: { fid: 'fid-abc123' } });
    (document as unknown as { documentElement: { lang: string } }).documentElement.lang = 'gu';
    await keepSubscriptionFresh();
    app({ hello: HELLO, installation: { fid: 'fid-abc123' } }, { userAgent: 'Mozilla/5.0 (Linux; Android 14; wv) Chrome/140.0' });
    (document as unknown as { documentElement: { lang: string } }).documentElement.lang = 'fr';
    await keepSubscriptionFresh();
    expect(api.registerAndroid.mock.calls).toEqual([
      [{ fid: 'fid-abc123', locale: 'gu', app_version: '2.0.0' }],
      [{ fid: 'fid-abc123', locale: 'en', app_version: undefined }],
    ]);
  });

  it('forgetting the phone: nothing to forget before Firebase has an FID; the server refusing is not an error', async () => {
    app({ installation: { fid: '' } });
    await forgetThisPhone();
    expect(api.unregisterAndroid).not.toHaveBeenCalled();
    api.unregisterAndroid.mockRejectedValueOnce(new Error('offline'));
    app({ installation: { fid: 'fid-abc123' } });
    await expect(forgetThisPhone()).resolves.toBeUndefined();
  });

  it('a push the app received refreshes the open inbox, and again a few seconds later; a new registration is told', async () => {
    vi.useFakeTimers();
    api.registerAndroid.mockResolvedValue({});
    const a = app({ hello: HELLO, installation: { fid: 'fid-new' } });
    const refresh = vi.fn();
    const stop = followAlerts({ refresh, go: vi.fn(), here: () => '/' });
    a.tell('push', 'ntf-1');
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    a.tell('installation', 'fid-new');
    await vi.advanceTimersByTimeAsync(10);
    expect(api.registerAndroid).toHaveBeenCalledWith(expect.objectContaining({ fid: 'fid-new' }));
    a.tell('notifications', 'on');   // not for the inbox
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('who may use the app', () => {
  it('the Android app is the app, on Android', () => {
    app();
    expect(accessHere()).toBe('open');
    expect(phoneHere()).toBe('android');
  });
});
