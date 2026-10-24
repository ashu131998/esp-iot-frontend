import { factoryExists, factoryLoginUrl, signedInHome, type Origins } from './redirect';

interface Env extends Origins {
  ASSETS: Fetcher;
  API_ORIGIN: string;
}

const ASSET_EXT_RE = /\.(?!html?$)[a-z0-9]+$/i;

function isPageRequest(req: Request, url: URL): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  return !ASSET_EXT_RE.test(url.pathname);
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  });
}

function withPageHeaders(res: Response, env: Origins): Response {
  const out = new Response(res.body, res);
  // Pages are revalidated on every visit so a cached copy never hides the
  // signed-in redirect.
  out.headers.set('Cache-Control', 'no-cache');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // form-action also governs where a submitted form may be redirected, and the
  // factory login form is answered with a redirect to the app host.
  out.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' ${env.APP_ORIGIN} mailto:`,
  );
  return out;
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);

    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    if (!isPageRequest(req, url)) return env.ASSETS.fetch(req);

    const home = signedInHome(req.headers.get('cookie'), env);
    if (home) return redirect(home);

    if (url.pathname === '/login' && url.searchParams.has('factory')) {
      const factoryId = url.searchParams.get('factory')?.trim() ?? '';
      const target = factoryLoginUrl(factoryId, env);
      if (!target) return redirect('/login#invalid');
      if ((await factoryExists(factoryId, env.API_ORIGIN)) === false) return redirect('/login#not-found');
      return redirect(target);
    }

    if (url.pathname === '/login/staff') return redirect(`${env.STAFF_ORIGIN}/internal/login`);

    return withPageHeaders(await env.ASSETS.fetch(req), env);
  },
} satisfies ExportedHandler<Env>;
