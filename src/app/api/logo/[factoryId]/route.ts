import { internalApiBase } from '@/lib/server/bff';

const IMAGE_TYPE = /^image\/(png|jpeg|webp)$/;

/**
 * A factory's logo (set by our staff), served from our own origin so the
 * dashboard and the sign-in page can show it under their CSP. Public: the
 * sign-in page needs it before anyone has logged in. Pages request it with
 * `?v=<logo_version>`, which changes on every save, so each version can be
 * cached for a day.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ factoryId: string }> },
): Promise<Response> {
  const { factoryId } = await params;
  let upstream: Response;
  try {
    upstream = await fetch(
      `${internalApiBase()}/v1/public/factories/${encodeURIComponent(factoryId)}/logo`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    );
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
  const type = upstream.headers.get('content-type') ?? '';
  if (!IMAGE_TYPE.test(type)) return new Response(null, { status: 502 });
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      'content-type': type,
      'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
    },
  });
}
