import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { internalHostAllowed } from '@/lib/internal-host';

function req(url: string) {
  return new NextRequest(new URL(url));
}

describe('internalHostAllowed', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('allows any host in non-production when hostnames unset', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.INTERNAL_STAFF_HOSTNAMES;
    expect(internalHostAllowed(req('https://esp-iot-frontend.workers.dev/internal'))).toBe(true);
  });

  it('blocks public workers.dev in production when hostnames unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.INTERNAL_STAFF_HOSTNAMES;
    expect(internalHostAllowed(req('https://esp-iot-frontend.workers.dev/internal'))).toBe(false);
  });

  it('allows listed staff hostname in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_STAFF_HOSTNAMES = 'internal.example.com, ops.example.com';
    expect(internalHostAllowed(req('https://internal.example.com/internal'))).toBe(true);
    expect(internalHostAllowed(req('https://ops.example.com/internal/nodes'))).toBe(true);
    expect(internalHostAllowed(req('https://esp-iot-frontend.workers.dev/internal'))).toBe(false);
  });

  it('matches subdomains of an allowed hostname', () => {
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_STAFF_HOSTNAMES = 'example.com';
    expect(internalHostAllowed(req('https://internal.example.com/internal'))).toBe(true);
  });
});
