/**
 * Links to a factory's pages. Inside the app they live at /factories/<id>/…; at the factory's own
 * address (<id>.floorbeat.in) the address already says which factory, so the same page is plain:
 * /factories/factory-01/energy is /energy there, /factories/factory-01 is /. The middleware serves
 * the plain address and sends the long one to it.
 */
export function plainFactoryHref(href: string): string {
  const m = /^\/factories\/[^/?#]+(.*)$/.exec(href);
  if (!m) return href;
  const rest = m[1];
  if (!rest) return '/';
  return rest.startsWith('/') ? rest : `/${rest}`;   // "?tab=x" → "/?tab=x"
}

const asIs = (href: string) => href;

/** The links of a page: plain at the factory's own address, as they are anywhere else (stable functions). */
export function factoryHrefFor(plain: boolean): (href: string) => string {
  return plain ? plainFactoryHref : asIs;
}
