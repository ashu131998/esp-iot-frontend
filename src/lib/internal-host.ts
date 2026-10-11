import type { NextRequest } from 'next/server';

function parseStaffHostnames(): string[] {
  const raw = process.env.INTERNAL_STAFF_HOSTNAMES?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().split(':')[0] ?? '';
}

function hostMatchesAllowed(hostname: string, allowed: string): boolean {
  const host = normalizeHost(hostname);
  const pattern = allowed.toLowerCase();
  if (host === pattern) return true;
  if (host.endsWith(`.${pattern}`)) return true;
  return false;
}

/**
 * Staff routes (`/internal/*`) may only be served on configured hostnames.
 *
 * - Unset `INTERNAL_STAFF_HOSTNAMES`: allowed everywhere (local dev default).
 * - In production with hostnames set: only those hosts (e.g. `internal.example.com`).
 * - In production with hostnames unset: `/internal` is blocked (public workers.dev safe).
 */
export function internalHostAllowed(req: NextRequest): boolean {
  const allowed = parseStaffHostnames();
  const host = req.nextUrl.hostname;

  if (allowed.length > 0) {
    return allowed.some((a) => hostMatchesAllowed(host, a));
  }

  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

export function internalHostBlockResponse(): Response {
  return new Response('Not Found', { status: 404 });
}
