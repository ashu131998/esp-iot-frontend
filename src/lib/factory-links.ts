/**
 * Links to a factory's pages. Inside the app they live at /factories/<id>/…; at the factory's own
 * address (<id>.floorbeat.in) the address already says which factory, so the same page is plain:
 * /factories/factory-01/energy is /energy there, /factories/factory-01 is /. The middleware serves
 * the plain address and sends the long one to it. The same holds in the FloorBeat app
 * (dashboard.floorbeat.in), where the factory is the one the person is signed in at.
 */
export function plainFactoryHref(href: string, overview = '/'): string {
  const m = /^\/factories\/[^/?#]+(.*)$/.exec(href);
  if (!m) return href;
  const rest = m[1];
  if (!rest) return overview;
  if (rest.startsWith('/')) return rest;
  return overview === '/' ? `/${rest}` : `${overview}${rest}`;   // "?tab=x" → "/?tab=x" (the app: "/overview?tab=x")
}

/**
 * In the FloorBeat app (dashboard.floorbeat.in) the root is the app's home screen of tiles, so the factory's
 * overview is /overview there (dashboard-app.ts APP_OVERVIEW); its other pages are plain as at its own address.
 */
export function appFactoryHref(href: string): string {
  return plainFactoryHref(href, '/overview');
}

/**
 * A request header the middleware sets where a factory's pages are served at plain addresses without
 * the address naming the factory: the FloorBeat app (dashboard.floorbeat.in), the factory being the one
 * the person is signed in at. The browser's own copy of it is dropped.
 */
export const PLAIN_LINKS_HEADER = 'x-fb-plain-links';

const asIs = (href: string) => href;

const plainAtRoot = (href: string) => plainFactoryHref(href);

/**
 * The links of a page: plain at the factory's own address (`plain`), and in the FloorBeat app too, there with the
 * overview at /overview (`app`); as they are anywhere else (stable functions).
 */
export function factoryHrefFor(plain: boolean, app = false): (href: string) => string {
  if (!plain) return asIs;
  return app ? appFactoryHref : plainAtRoot;
}
