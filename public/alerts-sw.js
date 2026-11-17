/*
 * FloorBeat Alerts: the service worker (registered by components/alerts-app/sw-boot.tsx).
 *
 * It shows each push as a notification (the alert is already in the person's inbox: the push only
 * says to open it), opens the alert when the notification is tapped, subscribes again if the
 * browser changes the subscription, and shows a short offline page when the phone has no network.
 * Nothing is cached: the app is always what the server serves.
 *
 * Plain JavaScript on purpose (no build step); lib/__tests__/alerts-sw.test.ts runs it.
 */
const ICON = '/alerts-icon-192.png';
const BADGE = '/alerts-badge-96.png';
const INBOX = '/';
const APP_NAME = 'FloorBeat Alerts';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** The push's JSON ({ title, body, data }: query-api notify/web-push.js pushPayload), or plain text as the body. */
function parsePush(data) {
  if (!data) return { title: APP_NAME, body: '', data: {} };
  try {
    const json = data.json();
    return {
      title: (json && json.title) || APP_NAME,
      body: (json && json.body) || '',
      data: (json && typeof json.data === 'object' && json.data) || {},
    };
  } catch {
    return { title: APP_NAME, body: data.text(), data: {} };
  }
}

/** Where a tap goes: a page of this app (a path), never another site; the inbox otherwise. */
function targetUrl(data) {
  const url = data && typeof data.url === 'string' ? data.url : INBOX;
  return /^\/(?![/\\])/.test(url) ? url : INBOX;
}

/** The notification for a push: one per alert (its id is the tag), kept on screen for a HIGH one. */
function notificationFor(push) {
  const d = push.data || {};
  const id = typeof d.notification_id === 'string' ? d.notification_id : '';
  return {
    title: push.title,
    options: {
      body: push.body,
      icon: ICON,
      badge: BADGE,
      tag: id ? `alert:${id}` : undefined,
      renotify: Boolean(id),
      requireInteraction: String(d.severity || '').toUpperCase() === 'HIGH',
      data: { url: targetUrl(d), notification_id: id },
      timestamp: Date.now(),
    },
  };
}

async function tellPages(message) {
  const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const page of pages) page.postMessage(message);
}

self.addEventListener('push', (event) => {
  const push = parsePush(event.data);
  const n = notificationFor(push);
  event.waitUntil(Promise.all([
    self.registration.showNotification(n.title, n.options),
    tellPages({ type: 'alert', notification_id: n.options.data.notification_id, url: n.options.data.url }),
  ]));
});

/** An open window of the app goes to the alert and comes to the front; else one is opened. */
async function openAlert(url) {
  const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const page = pages[0];
  if (!page) return self.clients.openWindow(url);
  if (typeof page.navigate === 'function') {
    try {
      await page.navigate(url);
    } catch {
      page.postMessage({ type: 'open', url });
    }
  } else {
    page.postMessage({ type: 'open', url });
  }
  if (typeof page.focus === 'function') await page.focus();
  return page;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openAlert(targetUrl(event.notification.data)));
});

/** The CSRF cookie the BFF wants on a write, where a worker can read cookies (Cookie Store API). */
async function csrfToken() {
  try {
    const cookie = self.cookieStore ? await self.cookieStore.get('esp_csrf') : null;
    return cookie ? cookie.value : '';
  } catch {
    return '';
  }
}

/**
 * The browser changed the subscription (a renewal, a new key): subscribe again with the same key
 * and tell the server. Where cookies cannot be read here, the app sends the subscription again
 * the next time it opens (lib/alerts-app/push-client.ts keepSubscriptionFresh).
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const previous = event.oldSubscription || null;
    const key = (event.newSubscription && event.newSubscription.options && event.newSubscription.options.applicationServerKey)
      || (previous && previous.options && previous.options.applicationServerKey);
    if (!key) return;
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const json = sub.toJSON();
    await fetch('/api/v1/me/push/subscriptions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await csrfToken() },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
  })());
});

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${APP_NAME}</title>
<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center}
h1{font-size:20px;margin:0 0 8px}p{color:#64748b;margin:4px 0}button{margin-top:16px;padding:10px 18px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-size:15px}</style></head>
<body><div><h1>You are offline</h1><p lang="hi">आप ऑफ़लाइन हैं</p><p lang="gu">તમે ઑફલાઇન છો</p><p>Your alerts will show once the phone is back on the network.</p><button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })));
});

// For the tests.
self.__floorbeatAlerts = { parsePush, notificationFor, targetUrl, openAlert };
