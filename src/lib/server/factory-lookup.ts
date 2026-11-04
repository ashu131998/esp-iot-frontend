import type { FactoryBranding } from '@/lib/branding';
import { internalApiBase } from '@/lib/server/bff';

export type FactoryLookup =
  /** factoryId: the factory's real ID; the API also finds one typed in other letters. */
  | { status: 'found'; factoryId: string; name: string; branding: FactoryBranding | null }
  | { status: 'missing' }
  | { status: 'unknown' };

const NOT_FOUND_ERROR = 'Factory not found';

/** The lookup's branding, if it has the expected shape (older APIs send none). */
function brandingOf(value: unknown): FactoryBranding | null {
  const b = value as { accent_color?: unknown; logo_version?: unknown } | null;
  if (!b || typeof b !== 'object') return null;
  return {
    accent_color: typeof b.accent_color === 'string' ? b.accent_color : null,
    logo_version: typeof b.logo_version === 'number' ? b.logo_version : null,
  };
}

/**
 * Public existence check for the factory sign-in page. Anything other than a
 * definite answer (network error, timeout, an API without the endpoint) is
 * 'unknown', so a backend problem never stops someone from signing in.
 */
export async function lookupFactory(
  factoryId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FactoryLookup> {
  try {
    const res = await fetchImpl(
      `${internalApiBase()}/v1/public/factories/${encodeURIComponent(factoryId)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(3000) },
    );
    const body = (await res.json().catch(() => null)) as
      | { factory_id?: unknown; name?: unknown; error?: unknown; branding?: unknown }
      | null;
    // A 404 for an unknown *route* has a different body; only this one means the factory is missing.
    if (res.status === 404 && body?.error === NOT_FOUND_ERROR) return { status: 'missing' };
    if (res.ok && typeof body?.name === 'string') {
      const real = typeof body.factory_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.factory_id)
        ? body.factory_id
        : factoryId;
      return { status: 'found', factoryId: real, name: body.name, branding: brandingOf(body.branding) };
    }
    return { status: 'unknown' };
  } catch {
    return { status: 'unknown' };
  }
}
