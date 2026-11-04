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
  { part: 'site', name: 'www website login', url: `${WWW}/login`, status: 200, endsAt: `${SITE}/login` },
  { part: 'site', name: 'website login with the factory ID', url: `${SITE}/login?factory=${ID}`, firstHop: `${APP}/f/${ID}/login`, status: 200 },
  { part: 'site', name: 'website login with the ID in capitals', url: `${SITE}/login?factory=${UPPER}`, firstHop: `${APP}/f/${ID}/login`, status: 200 },
  { part: 'site', name: 'sign-in link without "app."', url: `${SITE}/f/${ID}/login`, firstHop: `${APP}/f/${ID}/login`, status: 200 },
  { part: 'site', name: 'sign-in link on www without "app."', url: `${WWW}/f/${ID}/login`, firstHop: `${APP}/f/${ID}/login`, status: 200 },
  { part: 'site', name: 'factory reset link without its address', url: `${SITE}/reset-password?token=smoke&factory=${ID}`, firstHop: `${APP}/reset-password?token=smoke&factory=${ID}`, status: 200 },
  { part: 'site', name: 'staff reset link without its address', url: `${SITE}/reset-password?token=smoke`, firstHop: `${STAFF}/reset-password?token=smoke`, status: 200 },
  { part: 'site', name: 'wrong address offers the login', url: `${SITE}/no-such-page-smoke`, status: 404, contains: 'Log in to your factory' },
  // The factory's own address (the email button) and the old app address's links
  { part: 'app', name: 'factory address (the email button)', url: `${APP}/`, status: 200, endsAt: `${APP}/f/${ID}/login`, lacks: 'Factory not found' },
  { part: 'app', name: 'factory address /login', url: `${APP}/login`, status: 200, endsAt: `${APP}/f/${ID}/login` },
  { part: 'app', name: 'factory sign-in page', url: `${APP}/f/${ID}/login`, status: 200, lacks: 'Factory not found' },
  { part: 'app', name: 'sign-in page with the ID in capitals', url: `${APP}/f/${UPPER}/login`, status: 200, endsAt: `${APP}/f/${ID}/login`, lacks: 'Factory not found' },
  { part: 'app', name: 'password reset page', url: `${APP}/reset-password?token=smoke&factory=${ID}`, status: 200 },
  { part: 'app', name: 'old app sign-in link (old emails)', url: `${OLD_APP}/f/${ID}/login`, firstHop: `${APP}/f/${ID}/login`, status: 200 },
  { part: 'app', name: 'old app factory link (old emails)', url: `${OLD_APP}/f/${ID}`, firstHop: `${APP}/f/${ID}`, status: 200, endsAt: `${APP}/f/${ID}/login?next=%2Ff%2F${ID}` },
  { part: 'app', name: 'old app dashboard link (old emails)', url: `${OLD_APP}/factories/${ID}/results`, firstHop: `${APP}/factories/${ID}/results`, status: 200 },
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
