/**
 * FloorBeat IMS's screens live at the root of ims.floorbeat.in ('' — /, /scan, /stock) or as the dashboard's
 * Stock tab (its base: /ims on the FloorBeat app and a factory's own address, /factories/<id>/ims on the long
 * addresses). Pure: the IMS screens link through imsHref (components/ims-app/ims-links.tsx).
 */

/** An IMS address ('/', '/stock', '/stock?row=3', '/add') under the screens' base. */
export function imsHref(base: string, to: string): string {
  const b = base.replace(/\/+$/, '');
  if (!b) return to || '/';
  if (to === '/' || to === '') return b;
  return to.startsWith('?') ? `${b}${to}` : `${b}${to.startsWith('/') ? to : `/${to}`}`;
}

/** Which of the Stock tab's screens an address is: '/', '/add' or '/stock' under the tab's base; null for none. */
export function imsScreenOf(pathname: string, base: string): '/' | '/add' | '/stock' | null {
  const b = base.replace(/\/+$/, '');
  if (pathname !== b && !pathname.startsWith(`${b}/`)) return null;
  const path = pathname.slice(b.length) || '/';
  if (path === '/') return '/';
  if (path === '/add' || path.startsWith('/add/')) return '/add';
  if (path === '/stock' || path.startsWith('/stock/')) return '/stock';
  return null;
}
