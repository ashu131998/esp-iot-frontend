'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

import { useInSwapScope, useNavigate } from '@/lib/navigation-context';

type AppLinkProps = Omit<ComponentProps<typeof Link>, 'prefetch'>;

/** Whether `href` is a plain path of this site that is another page than the one at `pathname`. */
export function leadsToAnotherPage(href: string, pathname: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  return (href.split(/[?#]/)[0] ?? href) !== pathname;
}

/**
 * A link to another page of the app, in place of Next's own <Link>.
 *
 * Next's link asks the server for its page as soon as the link is on screen. A table of twenty machines
 * so asked for twenty pages nobody had opened: 10 to 27 such requests on every page view (measured
 * 2026-11-24), each one a page drawn on Cloudflare, which counts processor time per request. This link
 * fetches nothing until it is clicked.
 *
 * Inside a shell that swaps its pages (PageSwap: the factory dashboard, the alerts app) the click goes
 * through navigate(), so the next page's skeleton, or the page itself, shows on the same frame. Elsewhere
 * it is an ordinary client-side link. A click that opens a new tab, or a download, is the browser's as ever.
 */
export function AppLink({ href, onNavigate, ...props }: AppLinkProps) {
  const navigate = useNavigate();
  const swaps = useInSwapScope();
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onNavigate={(event) => {
        onNavigate?.(event);
        // Another page of this shell: through navigate(). The same page with other filters, or an address
        // that is not a plain path, stays the router's own.
        if (!swaps || typeof href !== 'string' || !leadsToAnotherPage(href, window.location.pathname)) return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}
