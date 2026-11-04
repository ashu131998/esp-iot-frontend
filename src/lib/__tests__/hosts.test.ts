import { describe, expect, it } from 'vitest';

import {
  RESERVED_SUBDOMAINS,
  factoryFromHost,
  factorySubdomainProblem,
  isFactorySubdomain,
  parseStaffHostRoles,
  staffHostForRole,
  staffRoleAllowedOnHost,
} from '@/lib/hosts';

const SUFFIX = '.floorbeat.in';

describe('factoryFromHost: <factory>.floorbeat.in is that factory', () => {
  it('a factory\'s address, any case, with or without a port', () => {
    expect(factoryFromHost('shree-mills.floorbeat.in', SUFFIX)).toBe('shree-mills');
    expect(factoryFromHost('Factory-01.FloorBeat.in', SUFFIX)).toBe('factory-01');
    expect(factoryFromHost('demo-mill.localhost:3005', '.localhost')).toBe('demo-mill');
    expect(factoryFromHost('mill.floorbeat.in', 'floorbeat.in')).toBe('mill');   // suffix without the dot
  });

  it('FloorBeat\'s own addresses are never a factory', () => {
    for (const host of ['app', 'ops', 'www', 'api', 'admin', 'superadmin', 'stage-app', 'stage-ops', 'stage-www', 'dev-app', 'dev-ops', 'dev-www', 'api-stage', 'api-dev']) {
      expect(factoryFromHost(`${host}.floorbeat.in`, SUFFIX)).toBeNull();
    }
  });

  it('nothing else is one either', () => {
    expect(factoryFromHost('floorbeat.in', SUFFIX)).toBeNull();                       // the website
    expect(factoryFromHost('a.b.floorbeat.in', SUFFIX)).toBeNull();                   // two levels
    expect(factoryFromHost('esp-iot-frontend-app.ashu131998.workers.dev', SUFFIX)).toBeNull();
    expect(factoryFromHost('evilfloorbeat.in', SUFFIX)).toBeNull();
    expect(factoryFromHost('mill.floorbeat.in', '')).toBeNull();                      // not switched on (stage, dev)
    expect(factoryFromHost('mill.floorbeat.in', undefined)).toBeNull();
    expect(factoryFromHost(null, SUFFIX)).toBeNull();
  });
});

describe('factory IDs that can be addresses', () => {
  it('lowercase letters, digits and hyphens, a letter or digit at each end, up to 63', () => {
    expect(isFactorySubdomain('shree-mills')).toBe(true);
    expect(isFactorySubdomain('factory-01')).toBe(true);
    expect(isFactorySubdomain('a'.repeat(63))).toBe(true);
    expect(isFactorySubdomain('a'.repeat(64))).toBe(false);
    expect(isFactorySubdomain('mill_01')).toBe(false);
    expect(isFactorySubdomain('-mill')).toBe(false);
    expect(isFactorySubdomain('mill-')).toBe(false);
    expect(isFactorySubdomain('')).toBe(false);
  });

  it('reserved names and the environment prefixes are refused, with a reason', () => {
    for (const id of ['admin', 'superadmin', 'app', 'ops', 'www', 'api', 'stage-mill', 'dev-mill', 'api-x', 'xn--abc']) {
      expect(isFactorySubdomain(id)).toBe(false);
      expect(factorySubdomainProblem(id)).toMatch(/kept for FloorBeat/);
    }
    expect(factorySubdomainProblem('mill_01')).toMatch(/Lowercase letters, digits and hyphens/);
    expect(factorySubdomainProblem('devi-textiles')).toBeNull();   // "dev" only with its hyphen
    expect(RESERVED_SUBDOMAINS.has('admin')).toBe(true);
  });
});

describe('staff addresses and who may use them', () => {
  const rules = parseStaffHostRoles('superadmin.floorbeat.in=super_admin; admin.floorbeat.in=internal_admin,internal_viewer');

  it('the super admin\'s address takes only the super admin; the staff address only staff', () => {
    expect(staffRoleAllowedOnHost('superadmin.floorbeat.in', 'super_admin', rules)).toBe(true);
    expect(staffRoleAllowedOnHost('superadmin.floorbeat.in', 'internal_admin', rules)).toBe(false);
    expect(staffRoleAllowedOnHost('admin.floorbeat.in', 'internal_viewer', rules)).toBe(true);
    expect(staffRoleAllowedOnHost('ADMIN.floorbeat.in:443', 'internal_admin', rules)).toBe(true);
    expect(staffRoleAllowedOnHost('admin.floorbeat.in', 'super_admin', rules)).toBe(false);
  });

  it('an address not listed takes every staff role (ops, workers.dev, local)', () => {
    expect(staffRoleAllowedOnHost('ops.floorbeat.in', 'super_admin', rules)).toBe(true);
    expect(staffRoleAllowedOnHost('localhost', 'internal_viewer', parseStaffHostRoles(undefined))).toBe(true);
  });

  it('where each role belongs', () => {
    expect(staffHostForRole('super_admin', rules)).toBe('superadmin.floorbeat.in');
    expect(staffHostForRole('internal_viewer', rules)).toBe('admin.floorbeat.in');
    expect(staffHostForRole('admin', rules)).toBeNull();
  });

  it('a malformed setting is ignored, never half-read', () => {
    expect(parseStaffHostRoles('nothing-here;=super_admin;admin.floorbeat.in=').size).toBe(0);
  });
});
