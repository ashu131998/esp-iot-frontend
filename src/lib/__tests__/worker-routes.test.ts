import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isFactorySubdomain, parseStaffHostRoles } from '@/lib/hosts';

/**
 * The Workers' addresses (wrangler.jsonc, marketing/wrangler.jsonc). Factories get their own address
 * through the customer Worker's *.floorbeat.in route, and on Cloudflare a route wins over a custom
 * domain: every other address on floorbeat.in therefore needs an exact route of its own, or the
 * factories' route takes it (the staff console, the website, stage, dev). Their names are also
 * kept from factories (hosts.ts), and only the customer Worker may hold the wildcard.
 */
type Route = { pattern: string; custom_domain?: boolean; zone_name?: string };
type WorkerEnv = { name?: string; routes?: Route[]; vars?: Record<string, string> };

/** JSON with comments: comments dropped (never inside strings), trailing commas allowed. */
function readJsonc(path: string): WorkerEnv & { env?: Record<string, WorkerEnv> } {
  const text = readFileSync(path, 'utf8')
    .replace(/"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => (m.startsWith('"') ? m : ''))
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text);
}

const ROOT = join(__dirname, '..', '..', '..');
const FILES = { app: join(ROOT, 'wrangler.jsonc'), site: join(ROOT, 'marketing', 'wrangler.jsonc') };

function workers() {
  const out: Array<{ file: keyof typeof FILES; env: string; routes: Route[]; vars: Record<string, string> }> = [];
  for (const [file, path] of Object.entries(FILES) as Array<[keyof typeof FILES, string]>) {
    const config = readJsonc(path);
    out.push({ file, env: '(default)', routes: config.routes ?? [], vars: config.vars ?? {} });
    for (const [env, cfg] of Object.entries(config.env ?? {})) out.push({ file, env, routes: cfg.routes ?? [], vars: cfg.vars ?? {} });
  }
  return out;
}

const ZONE = 'floorbeat.in';
const subdomainOf = (host: string) => (host.endsWith(`.${ZONE}`) ? host.slice(0, -ZONE.length - 1) : null);

describe('every address on floorbeat.in is safe from the factories\' *.floorbeat.in route', () => {
  it('reads both configs (the scan sees the addresses)', () => {
    const hosts = workers().flatMap((w) => w.routes.filter((r) => r.custom_domain).map((r) => r.pattern));
    expect(hosts).toEqual(expect.arrayContaining([
      'ops.floorbeat.in', 'admin.floorbeat.in', 'superadmin.floorbeat.in',
      'stage-ops.floorbeat.in', 'stage-app.floorbeat.in', 'dev-ops.floorbeat.in', 'dev-app.floorbeat.in',
      'floorbeat.in', 'www.floorbeat.in', 'stage-www.floorbeat.in', 'dev-www.floorbeat.in',
    ]));
  });

  it('each subdomain a Worker answers on has an exact route of its own, on the floorbeat.in zone', () => {
    for (const w of workers()) {
      for (const r of w.routes.filter((x) => x.custom_domain)) {
        if (!subdomainOf(r.pattern)) continue;   // the bare domain is not under *.floorbeat.in
        expect(w.routes, `${w.file} ${w.env}: ${r.pattern} needs "${r.pattern}/*"`)
          .toContainEqual({ pattern: `${r.pattern}/*`, zone_name: ZONE });
      }
    }
  });

  it('their names can never be a factory\'s', () => {
    for (const w of workers()) {
      for (const r of w.routes) {
        const label = subdomainOf(r.pattern.replace(/\/\*$/, ''));
        if (label && !label.includes('*')) expect(isFactorySubdomain(label), `${label} must be reserved`).toBe(false);
      }
    }
  });

  it('app.floorbeat.in is gone: no Worker answers on it by name (the factories\' route forwards its old links)', () => {
    for (const w of workers()) expect(w.routes.map((r) => r.pattern.replace(/\/\*$/, ''))).not.toContain('app.floorbeat.in');
  });

  it('the customer Worker answers on factories\' addresses', () => {
    const app = workers().find((w) => w.file === 'app' && w.env === 'app')!;
    expect(app.routes).toEqual([{ pattern: `*.${ZONE}/*`, zone_name: ZONE }]);
  });

  it('only the customer Worker may take *.floorbeat.in, and nothing wider', () => {
    for (const w of workers()) {
      for (const r of w.routes.filter((x) => x.pattern.includes('*') && !/^[a-z0-9.-]+\/\*$/.test(x.pattern))) {
        expect({ file: w.file, env: w.env, pattern: r.pattern }).toEqual({ file: 'app', env: 'app', pattern: `*.${ZONE}/*` });
      }
    }
  });
});

describe('the staff console\'s addresses', () => {
  const staff = workers().find((w) => w.file === 'app' && w.env === '(default)')!;

  it('serves /internal on ops, admin and superadmin', () => {
    expect(staff.vars.INTERNAL_STAFF_HOSTNAMES.split(',')).toEqual(expect.arrayContaining(['ops.floorbeat.in', 'admin.floorbeat.in', 'superadmin.floorbeat.in']));
  });

  it('superadmin is the super admin\'s alone; admin is the staff\'s', () => {
    const rules = parseStaffHostRoles(staff.vars.STAFF_HOST_ROLES);
    expect(rules.get('superadmin.floorbeat.in')).toEqual(['super_admin']);
    expect(rules.get('admin.floorbeat.in')).toEqual(['internal_admin', 'internal_viewer']);
  });

  it('factories\' own addresses are switched on in production only: the customer Worker and the website', () => {
    const on = (w: { file: string; env: string }) => (w.file === 'app' && w.env === 'app') || (w.file === 'site' && w.env === '(default)');
    for (const w of workers()) {
      expect(w.vars.FACTORY_HOST_SUFFIX ?? null, `${w.file} ${w.env}`).toBe(on(w) ? '.floorbeat.in' : null);
    }
  });
});
