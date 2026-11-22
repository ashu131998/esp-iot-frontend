/**
 * The phone's side of notifications (lib/alerts-app/push-client.ts), with a stand-in iPhone: whether
 * it is set to ring without asking the server (an iPhone's app opens on that), and a tap on "Turn on
 * notifications" that asks the phone at once (the server's key is known from the look before it:
 * an iPhone shows its "Allow" prompt only right after a tap).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  key: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  testPush: vi.fn(),
}));
vi.mock('@/lib/alerts-app/api', () => ({ alertsApi: api }));

const { currentState, forgetServerKey, keepSubscriptionFresh, subscribedHere, turnOff, turnOn } = await import('@/lib/alerts-app/push-client');

const IPHONE_HOME_SCREEN = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const SUBSCRIPTION = { endpoint: 'https://web.push.apple.com/abc', unsubscribe: vi.fn(async () => true), toJSON: () => ({ endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } }) };

/** An iPhone's Home Screen app: its permission, its subscription (or none), and every call in order. */
function iphone({ permission = 'default', subscribed = false, push = true, failing = false }: {
  permission?: NotificationPermission; subscribed?: boolean; push?: boolean; failing?: boolean;
} = {}) {
  const calls: string[] = [];
  let current: typeof SUBSCRIPTION | null = subscribed ? SUBSCRIPTION : null;
  const notification = {
    permission,
    requestPermission: vi.fn(async () => {
      calls.push('ask the phone');
      notification.permission = 'granted';
      return 'granted' as NotificationPermission;
    }),
  };
  const reg = {
    pushManager: {
      getSubscription: vi.fn(async () => {
        if (failing) throw new Error('push service away');
        return current;
      }),
      subscribe: vi.fn(async () => {
        calls.push('subscribe');
        current = SUBSCRIPTION;
        return SUBSCRIPTION;
      }),
    },
  };
  vi.stubGlobal('navigator', {
    userAgent: IPHONE_HOME_SCREEN,
    standalone: true,
    serviceWorker: { register: vi.fn(async () => reg), ready: Promise.resolve(reg) },
  });
  vi.stubGlobal('Notification', notification);
  vi.stubGlobal('window', {
    ...(push ? { PushManager: class {} } : {}),
    Notification: notification,
    matchMedia: () => ({ matches: true }),
  });
  api.key.mockImplementation(async () => {
    calls.push('server key');
    return { enabled: true, public_key: 'AQID' };
  });
  api.subscribe.mockImplementation(async () => {
    calls.push('tell the server');
    return { subscription_id: 's1', devices: 1 };
  });
  return { calls, notification, reg };
}

beforeEach(() => forgetServerKey());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('set to ring, from the phone alone', () => {
  it('allowed and subscribed: yes, and the server is not asked', async () => {
    const { calls } = iphone({ permission: 'granted', subscribed: true });
    expect(await subscribedHere()).toBe(true);
    expect(calls).toEqual([]);
  });

  it('not yet allowed, allowed but not subscribed, no Web Push, or a failing phone: no', async () => {
    iphone();
    expect(await subscribedHere()).toBe(false);
    iphone({ permission: 'granted' });
    expect(await subscribedHere()).toBe(false);
    iphone({ permission: 'granted', subscribed: true, push: false });
    expect(await subscribedHere()).toBe(false);
    iphone({ permission: 'granted', subscribed: true, failing: true });
    expect(await subscribedHere()).toBe(false);
  });
});

describe('turning notifications on', () => {
  it('the tap asks the phone straight away: the key was fetched when the screen looked', async () => {
    const { calls } = iphone();
    expect(await currentState()).toBe('off');
    expect(calls).toEqual(['server key']);
    calls.length = 0;
    expect(await turnOn()).toBe('on');
    expect(calls).toEqual(['ask the phone', 'subscribe', 'tell the server']);
    expect(await subscribedHere()).toBe(true);
  });

  it('with no key known yet it is fetched first; a server without push is asked again next time', async () => {
    const { calls } = iphone();
    api.key.mockResolvedValueOnce({ enabled: false, public_key: null });
    expect(await turnOn()).toBe('server-off');
    expect(await turnOn()).toBe('on');
    expect(calls).toEqual(['server key', 'ask the phone', 'subscribe', 'tell the server']);
    expect(api.key).toHaveBeenCalledTimes(2);
  });
});

describe('every open, and turning off (an iPhone: web push, not the Android app)', () => {
  it('a phone set up sends its subscription again; turning off unsubscribes it and tells the server', async () => {
    iphone({ permission: 'granted', subscribed: true });
    api.unsubscribe.mockResolvedValue({ removed: true });
    await keepSubscriptionFresh();
    expect(api.subscribe).toHaveBeenCalledWith({ endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } });
    await turnOff();
    expect(SUBSCRIPTION.unsubscribe).toHaveBeenCalled();
    expect(api.unsubscribe).toHaveBeenCalledWith('https://web.push.apple.com/abc');
  });
});
