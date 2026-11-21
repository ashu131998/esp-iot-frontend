#!/usr/bin/env node
/**
 * After a deploy: open the links customers get (the welcome email's button and its backup, reset
 * links) and the ways people mangle them (www, a lost "app." subdomain, capital letters in the
 * factory ID). Every one must reach a working page; any dead end fails the deploy run, and GitHub
 * emails about the failed run.
 *
 *   node scripts/smoke-public-links.mjs [--only site|app]
 *
 * Each factory signs in at its own address (<id>.floorbeat.in); app.floorbeat.in is gone and only
 * forwards old links there. SITE_ORIGIN (https://floorbeat.in), FACTORY_HOST_SUFFIX (.floorbeat.in),
 * OLD_APP_ORIGIN (https://app.floorbeat.in), STAFF_ORIGIN (https://ops.floorbeat.in) and SMOKE_FACTORY_ID
 * (factory-01, the demo factory) can be set for another environment. Each check is retried for about
 * a minute, while a fresh deploy spreads across Cloudflare.
 */
const SITE = (process.env.SITE_ORIGIN ?? 'https://floorbeat.in').replace(/\/$/, '');
const ID = process.env.SMOKE_FACTORY_ID ?? 'factory-01';
const SUFFIX = process.env.FACTORY_HOST_SUFFIX ?? '.floorbeat.in';
/** The factory's own address: its sign-in and everything else. */
const APP = `https://${ID}${SUFFIX}`;
const OLD_APP = (process.env.OLD_APP_ORIGIN ?? 'https://app.floorbeat.in').replace(/\/$/, '');
/** The FloorBeat Alerts app (the phone app): alerts.<suffix>. */
const ALERTS = (process.env.ALERTS_ORIGIN ?? `https://alerts${SUFFIX}`).replace(/\/$/, '');
const STAFF = (process.env.STAFF_ORIGIN ?? 'https://ops.floorbeat.in').replace(/\/$/, '');
const WWW = SITE.replace('://', '://www.');
const UPPER = ID.toUpperCase();
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
/** Tries per check: 6 (about a minute) after a deploy; SMOKE_ATTEMPTS=1 for a quick look. */
const ATTEMPTS = Math.max(1, Number(process.env.SMOKE_ATTEMPTS ?? 6));

/** Fetch without following redirects, then follow them by hand: the first hop and the end. */
async function open(url) {
  const hops = [];
  let current = url;
  for (let i = 0; i < 6; i += 1) {
    const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': 'FloorBeat link check' }, signal: AbortSignal.timeout(20_000) });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, current).toString();
      hops.push({ status: res.status, to: next });
      current = next;
      continue;
    }
    return { hops, status: res.status, url: current, body: await res.text() };
  }
  throw new Error('more than 5 redirects');
}

const CHECKS = [
  // The website
  { part: 'site', name: 'website home', url: `${SITE}/`, status: 200, contains: 'Machine Monitoring as a Service' },
  { part: 'site', name: 'website login', url: `${SITE}/login`, status: 200, contains: 'Log in to your factory' },
  { part: 'site', name: 'privacy policy', url: `${SITE}/privacy`, status: 200, contains: 'Grievance Officer' },
  { part: 'site', name: 'terms of service', url: `${SITE}/terms`, status: 200, contains: 'Terms of Service' },
  { part: 'site', name: 'security page', url: `${SITE}/security`, status: 200, contains: 'Security at FloorBeat' },
  { part: 'site', name: 'www website login', url: `${WWW}/login`, status: 200, endsAt: `${SITE}/login` },
  { part: 'site', name: 'website login with the factory ID', url: `${SITE}/login?factory=${ID}`, firstHop: `${APP}/login`, status: 200 },
  { part: 'site', name: 'website login with the ID in capitals', url: `${SITE}/login?factory=${UPPER}`, firstHop: `${APP}/login`, status: 200 },
  { part: 'site', name: 'sign-in link without its address', url: `${SITE}/f/${ID}/login`, firstHop: `${APP}/login`, status: 200 },
  { part: 'site', name: 'sign-in link on www without its address', url: `${WWW}/f/${ID}/login`, firstHop: `${APP}/login`, status: 200 },
  { part: 'site', name: 'factory reset link without its address', url: `${SITE}/reset-password?token=smoke&factory=${ID}`, firstHop: `${APP}/reset-password?token=smoke&factory=${ID}`, status: 200 },
  { part: 'site', name: 'staff reset link without its address', url: `${SITE}/reset-password?token=smoke`, firstHop: `${STAFF}/reset-password?token=smoke`, status: 200 },
  { part: 'site', name: 'wrong address offers the login', url: `${SITE}/no-such-page-smoke`, status: 404, contains: 'Log in to your factory' },
  // The factory's own address: plain addresses (/ and /login), the app's long forms, the old app address's links
  { part: 'app', name: 'factory address (the email button)', url: `${APP}/`, status: 200, endsAt: `${APP}/login`, lacks: 'Factory not found' },
  { part: 'app', name: 'factory sign-in page', url: `${APP}/login`, status: 200, endsAt: `${APP}/login`, lacks: 'Factory not found' },
  { part: 'app', name: 'a factory page while signed out', url: `${APP}/energy`, status: 200, endsAt: `${APP}/login?next=%2Fenergy` },
  { part: 'app', name: 'the long sign-in address', url: `${APP}/f/${ID}/login`, status: 200, endsAt: `${APP}/login` },
  { part: 'app', name: 'the long address with the ID in capitals', url: `${APP}/f/${UPPER}/login`, status: 200, endsAt: `${APP}/login`, lacks: 'Factory not found' },
  { part: 'app', name: 'password reset page', url: `${APP}/reset-password?token=smoke&factory=${ID}`, status: 200 },
  { part: 'app', name: 'old app sign-in link (old emails)', url: `${OLD_APP}/f/${ID}/login`, firstHop: `${APP}/login`, status: 200 },
  { part: 'app', name: 'old app factory link (old emails)', url: `${OLD_APP}/f/${ID}`, firstHop: `${APP}/`, status: 200, endsAt: `${APP}/login` },
  { part: 'app', name: 'old app dashboard link (old emails)', url: `${OLD_APP}/factories/${ID}/results`, firstHop: `${APP}/results`, status: 200, endsAt: `${APP}/login?next=%2Fresults` },
  // The FloorBeat Alerts app: its sign-in, its inbox while signed out, what a phone installs from
  // The alerts app has no sign-in address: signed out, its own address shows the sign-in in place.
  { part: 'app', name: 'alerts app while signed out', url: `${ALERTS}/`, status: 200, endsAt: `${ALERTS}/`, contains: 'FloorBeat Alerts' },
  { part: 'app', name: 'alerts app old sign-in link', url: `${ALERTS}/login`, status: 200, firstHop: `${ALERTS}/`, endsAt: `${ALERTS}/` },
  { part: 'app', name: 'alerts app manifest', url: `${ALERTS}/alerts-app.webmanifest`, status: 200, contains: '"FloorBeat Alerts"' },
  { part: 'app', name: 'alerts app service worker', url: `${ALERTS}/alerts-sw.js`, status: 200, contains: 'showNotification' },
  { part: 'app', name: 'Android asset link', url: `${ALERTS}/.well-known/assetlinks.json`, status: 200, contains: 'in.floorbeat.alerts' },
  { part: 'app', name: 'the staff console is not the app', url: `${ALERTS}/internal/login`, status: 404 },
  { part: 'site', name: 'app download page', url: `${SITE}/app`, status: 200, contains: 'Download for Android' },
  { part: 'site', name: 'Android APK download', url: `${SITE}/downloads/floorbeat-alerts.apk`, status: 200 },
];

function verdict(check, got) {
  const problems = [];
  if (got.status !== check.status) problems.push(`ended with ${got.status}, expected ${check.status}`);
  if (check.firstHop && got.hops[0]?.to !== check.firstHop) problems.push(`first went to ${got.hops[0]?.to ?? 'nowhere'}, expected ${check.firstHop}`);
  if (check.endsAt && got.url !== check.endsAt) problems.push(`ended at ${got.url}, expected ${check.endsAt}`);
  if (check.contains && !got.body.includes(check.contains)) problems.push(`page lacks "${check.contains}"`);
  if (check.lacks && got.body.includes(check.lacks)) problems.push(`page shows "${check.lacks}"`);
  return problems;
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
let failed = 0;
for (const check of CHECKS.filter((c) => !only || c.part === only)) {
  let problems = [];
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      problems = verdict(check, await open(check.url));
    } catch (err) {
      problems = [`could not open: ${err.message}`];
    }
    if (problems.length === 0) break;
    if (attempt < ATTEMPTS) await sleep(10_000);
  }
  if (problems.length === 0) {
    console.log(`ok    ${check.name}  ${check.url}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${check.name}  ${check.url}\n      ${problems.join('\n      ')}`);
  }
}
if (failed) {
  console.error(`\n${failed} link check(s) failed: a customer following these would hit a dead end.`);
  process.exit(1);
}
console.log('\nevery link check passed');
