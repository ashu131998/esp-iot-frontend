import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { internalHostAllowed } from '@/lib/internal-host';

function req(url: string) {
  return new NextRequest(new URL(url));
}

describe('internalHostAllowed', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows any host in non-production when hostnames unset', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('INTERNAL_STAFF_HOSTNAMES', '');
    expect(internalHostAllowed(req('https://esp-iot-frontend.workers.dev/internal'))).toBe(true);
  });

  it('blocks public workers.dev in production when hostnames unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_STAFF_HOSTNAMES', '');
    expect(internalHostAllowed(req('https://esp-iot-frontend.workers.dev/internal'))).toBe(false);
  });

  it('allows listed staff hostname in production (exact match)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_STAFF_HOSTNAMES', 'internal.example.com, ops.example.com');
    expect(internalHostAllowed(req('https://internal.example.com/internal'))).toBe(true);
    expect(internalHostAllowed(req('https://ops.example.com/internal/nodes'))).toBe(true);
    expect(internalHostAllowed(req('https://esp-iot-frontend.workers.dev/internal'))).toBe(false);
  });

  it('does not treat sibling subdomains as allowed when parent is listed', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_STAFF_HOSTNAMES', 'example.com');
    expect(internalHostAllowed(req('https://internal.example.com/internal'))).toBe(false);
    expect(internalHostAllowed(req('https://example.com/internal'))).toBe(true);
  });
});
