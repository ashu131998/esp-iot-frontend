import { describe, expect, it } from 'vitest';

import { lookupFactory } from '@/lib/server/factory-lookup';

function respond(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

describe('lookupFactory', () => {
  it('returns the factory name when it exists (no branding from an older API)', async () => {
    const res = await lookupFactory('factory-01', respond(200, { factory_id: 'factory-01', name: 'Demo Textile Mill' }));
    expect(res).toEqual({ status: 'found', name: 'Demo Textile Mill', branding: null });
  });

  it('returns the branding for the sign-in page, ignoring malformed fields', async () => {
    const branded = await lookupFactory('factory-01', respond(200, {
      factory_id: 'factory-01', name: 'Demo', branding: { accent_color: '#1a73e8', logo_version: 42 },
    }));
    expect(branded).toEqual({ status: 'found', name: 'Demo', branding: { accent_color: '#1a73e8', logo_version: 42 } });
    const odd = await lookupFactory('factory-01', respond(200, {
      name: 'Demo', branding: { accent_color: 7, logo_version: 'x' },
    }));
    expect(odd).toEqual({ status: 'found', name: 'Demo', branding: { accent_color: null, logo_version: null } });
  });

  it('reports missing only for the API\'s factory-not-found answer', async () => {
    const res = await lookupFactory('factory-nope', respond(404, { error: 'Factory not found' }));
    expect(res).toEqual({ status: 'missing' });
  });

  it('treats a 404 for an unknown route (older API) as unknown, not missing', async () => {
    const res = await lookupFactory(
      'factory-01',
      respond(404, { message: 'Route GET:/v1/public/factories/factory-01 not found', error: 'Not Found', statusCode: 404 }),
    );
    expect(res).toEqual({ status: 'unknown' });
  });

  it('treats an unreadable answer as unknown', async () => {
    const garbled = (async () => new Response('<html>', { status: 200 })) as typeof fetch;
    expect(await lookupFactory('factory-01', garbled)).toEqual({ status: 'unknown' });
  });

  it('treats server and network errors as unknown', async () => {
    expect(await lookupFactory('factory-01', respond(500, { error: 'boom' }))).toEqual({ status: 'unknown' });
    const failing = (async () => { throw new Error('offline'); }) as typeof fetch;
    expect(await lookupFactory('factory-01', failing)).toEqual({ status: 'unknown' });
  });
});
