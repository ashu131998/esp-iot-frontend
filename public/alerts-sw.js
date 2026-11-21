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
const SETTINGS_CACHE = 'fb-alerts-settings';

// ── the person's language ─────────────────────────────────────────────────────────────────────────
// The page tells the worker the language (sw-boot.tsx); it is kept in the Cache API, which outlives
// the worker. A push carries the facts behind the alert (data.view, from query-api): the words are
// made here in that language, so the phone rings in Hindi or Gujarati even while the app is closed.
async function rememberLocale(locale) {
  try {
    const cache = await caches.open(SETTINGS_CACHE);
    await cache.put('/__locale', new Response(String(locale)));
  } catch {
    // no cache here: English
  }
}

async function readLocale() {
  try {
    const cache = await caches.open(SETTINGS_CACHE);
    const hit = await cache.match('/__locale');
    const value = hit ? (await hit.text()).trim() : '';
    return value === 'hi' || value === 'gu' ? value : 'en';
  } catch {
    return 'en';
  }
}

const WORDS = {
  en: {
    stopped: (m) => `${m} stopped`, stoppedAt: (m, t) => `${m} stopped at ${t}.`, why: 'Why is it down? Tap an answer.',
    running: (m) => `${m} is running again`, back: (m, t, d) => `${m} came back at ${t}${d ? ` after ${d}` : ''}.`,
    which: 'Which configuration is it running? Tap one.', fixed: 'Did you get it running? Tap to answer.',
    shift: (s, t) => `${s} starts at ${t}`, shiftSoon: (s) => `${s} starts soon`, task: (x) => `Task: ${x}`, machines: (x) => `Machines: ${x}`,
    asked: (n) => `${n} has been asked for the reason in the app.`, nobody: 'No operator is assigned to this machine right now.', h: 'h', m: 'm',
    still: (m) => `${m} is still stopped`, waiting: (m, d) => `${m} has been stopped for ${d}. Nobody has said why yet.`, stillNoTime: (m) => `${m} is still stopped. Nobody has said why yet.`,
  },
  hi: {
    stopped: (m) => `${m} रुक गई`, stoppedAt: (m, t) => `${m} ${t} पर रुक गई।`, why: 'यह क्यों रुकी? एक जवाब पर टैप करें।',
    running: (m) => `${m} फिर चल रही है`, back: (m, t, d) => `${m} ${t} पर${d ? ` ${d} के बाद` : ''} फिर चली।`,
    which: 'यह कौन-सा कॉन्फ़िगरेशन चला रही है? एक पर टैप करें।', fixed: 'क्या आपने इसे चला दिया? जवाब के लिए टैप करें।',
    shift: (s, t) => `${s} ${t} पर शुरू होती है`, shiftSoon: (s) => `${s} जल्द शुरू होती है`, task: (x) => `काम: ${x}`, machines: (x) => `मशीनें: ${x}`,
    asked: (n) => `${n} से ऐप में कारण पूछा गया है।`, nobody: 'अभी इस मशीन पर कोई ऑपरेटर नहीं है।', h: 'घं', m: 'मि',
    still: (m) => `${m} अब भी रुकी है`, waiting: (m, d) => `${m} ${d} से रुकी है। अभी तक किसी ने कारण नहीं बताया।`, stillNoTime: (m) => `${m} अब भी रुकी है। अभी तक किसी ने कारण नहीं बताया।`,
  },
  gu: {
    stopped: (m) => `${m} બંધ થઈ`, stoppedAt: (m, t) => `${m} ${t} વાગ્યે બંધ થઈ.`, why: 'તે કેમ બંધ છે? એક જવાબ પર ટૅપ કરો.',
    running: (m) => `${m} ફરી ચાલે છે`, back: (m, t, d) => `${m} ${t} વાગ્યે${d ? ` ${d} પછી` : ''} ફરી ચાલી.`,
    which: 'તે કયું કૉન્ફિગરેશન ચલાવે છે? એક પર ટૅપ કરો.', fixed: 'તમે તેને ચાલુ કરી? જવાબ માટે ટૅપ કરો.',
    shift: (s, t) => `${s} ${t} વાગ્યે શરૂ થાય છે`, shiftSoon: (s) => `${s} જલદી શરૂ થાય છે`, task: (x) => `કામ: ${x}`, machines: (x) => `મશીનો: ${x}`,
    asked: (n) => `${n} ને ઍપમાં કારણ પૂછાયું છે.`, nobody: 'અત્યારે આ મશીન પર કોઈ ઑપરેટર નથી.', h: 'ક', m: 'મિ',
    still: (m) => `${m} હજી બંધ છે`, waiting: (m, d) => `${m} ${d} થી બંધ છે. હજી સુધી કોઈએ કારણ જણાવ્યું નથી.`, stillNoTime: (m) => `${m} હજી બંધ છે. હજી સુધી કોઈએ કારણ જણાવ્યું નથી.`,
  },
};

function timeIn(locale, iso) {
  try {
    const tag = locale === 'hi' ? 'hi-IN' : locale === 'gu' ? 'gu-IN' : 'en-IN';
    return new Intl.DateTimeFormat(tag, { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
}

function durationIn(locale, minutes) {
  const w = WORDS[locale] || WORDS.en;
  const total = Math.max(1, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h} ${w.h} ${m} ${w.m}`;
  if (h > 0) return `${h} ${w.h}`;
  return `${m} ${w.m}`;
}

/** The title and body for a push in the person's language, from the facts; null for a push without them. */
function wordsFor(view, locale, asks) {
  if (!view || typeof view !== 'object' || typeof view.kind !== 'string') return null;
  const w = WORDS[locale] || WORDS.en;
  const machine = view.machine || '';
  const time = view.at ? timeIn(locale, view.at) : '';
  const after = view.down_for_min ? durationIn(locale, view.down_for_min) : '';
  switch (view.kind) {
    case 'machine_down':
      return { title: w.stopped(machine), body: [time ? w.stoppedAt(machine, time) : '', asks ? w.why : ''].filter(Boolean).join(' ') };
    case 'machine_up':
      return { title: w.running(machine), body: [time ? w.back(machine, time, after) : '', asks ? (view.asks === 'fix' ? w.fixed : w.which) : ''].filter(Boolean).join(' ') };
    case 'shift_reminder': {
      const start = view.start ? timeIn(locale, view.start) : '';
      const body = [view.task ? w.task(view.task) : '', view.machines && view.machines.length ? w.machines(view.machines.join(', ')) : ''].filter(Boolean).join(' · ');
      return { title: start ? w.shift(view.shift || '', start) : w.shiftSoon(view.shift || ''), body };
    }
    case 'owner_down': {
      const names = (view.operators || []).filter(Boolean);
      return { title: w.stopped(machine), body: [time ? w.stoppedAt(machine, time) : '', names.length ? w.asked(names.join(', ')) : w.nobody].filter(Boolean).join(' ') };
    }
    case 'owner_up':
      return { title: w.running(machine), body: time ? w.back(machine, time, after) : '' };
    // Nobody answered: the supervisor gets the question, the owner is told.
    case 'machine_down_waiting':
    case 'owner_unanswered': {
      const waited = view.waiting_min ? w.waiting(machine, durationIn(locale, view.waiting_min)) : w.stillNoTime(machine);
      return { title: w.still(machine), body: [waited, asks ? w.why : ''].filter(Boolean).join(' ') };
    }
    default:
      return null;
  }
}

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

/** The notification for a push: one per alert (its id is the tag), kept on screen for a HIGH one; in the person's language when the facts came. */
function notificationFor(push, locale) {
  const d = push.data || {};
  const id = typeof d.notification_id === 'string' ? d.notification_id : '';
  const words = wordsFor(d.view, locale || 'en', Boolean(d.asks));
  return {
    title: words ? words.title : push.title,
    options: {
      body: words ? words.body : push.body,
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
  event.waitUntil(readLocale().then((locale) => {
    const n = notificationFor(push, locale);
    return Promise.all([
      self.registration.showNotification(n.title, n.options),
      tellPages({ type: 'alert', notification_id: n.options.data.notification_id, url: n.options.data.url }),
    ]);
  }));
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'locale') event.waitUntil(rememberLocale(data.locale));
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
self.__floorbeatAlerts = { parsePush, notificationFor, targetUrl, openAlert, wordsFor, readLocale };
