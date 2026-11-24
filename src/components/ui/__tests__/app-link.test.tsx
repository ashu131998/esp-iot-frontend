/**
 * The app's link (components/ui/app-link.tsx): it never fetches a page before the click, and inside a
 * shell that swaps its pages a click on another page goes through navigate() (the skeleton at once).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

type LinkProps = { href: string; prefetch?: boolean; onNavigate?: (e: { preventDefault: () => void }) => void; children?: ReactNode; className?: string };
let given: LinkProps | null = null;
vi.mock('next/link', () => ({
  default: (props: LinkProps) => {
    given = props;
    return <a href={props.href} className={props.className}>{props.children}</a>;
  },
}));
const navigate = vi.fn();
const scope = { inside: true };
vi.mock('@/lib/navigation-context', () => ({ useNavigate: () => navigate, useInSwapScope: () => scope.inside }));

const { AppLink, leadsToAnotherPage } = await import('@/components/ui/app-link');

function click(href: string, at: string, onNavigate?: (e: { preventDefault: () => void }) => void) {
  given = null;
  navigate.mockClear();
  vi.stubGlobal('window', { location: { pathname: at } });
  renderToString(<AppLink href={href} onNavigate={onNavigate}>Loom 3</AppLink>);
  const event = { preventDefault: vi.fn() };
  given!.onNavigate!(event);
  return event;
}
afterEach(() => {
  vi.unstubAllGlobals();
  scope.inside = true;
});

describe('another page, or the same one', () => {
  it('a plain path that is not the page shown is another page', () => {
    expect(leadsToAnotherPage('/machines/loom-3', '/alerts')).toBe(true);
    expect(leadsToAnotherPage('/machines/loom-3?from=a#x', '/alerts')).toBe(true);
    expect(leadsToAnotherPage('/', '/alerts')).toBe(true);
  });
  it('the same page with other filters, a place on it, or an address that is no plain path, is not', () => {
    expect(leadsToAnotherPage('/alerts?line_id=l1', '/alerts')).toBe(false);
    expect(leadsToAnotherPage('/alerts#feed', '/alerts')).toBe(false);
    expect(leadsToAnotherPage('?line_id=l1', '/alerts')).toBe(false);
    expect(leadsToAnotherPage('#feed', '/alerts')).toBe(false);
    expect(leadsToAnotherPage('https://floorbeat.in/app', '/alerts')).toBe(false);
    expect(leadsToAnotherPage('//elsewhere.example/x', '/alerts')).toBe(false);
  });
});

describe('the link', () => {
  it('is an ordinary link on the page, and asks the server for nothing before the click', () => {
    const html = renderToString(<AppLink href="/machines/loom-3" className="row">Loom 3</AppLink>);
    expect(html).toBe('<a href="/machines/loom-3" class="row">Loom 3</a>');
    expect(given!.prefetch).toBe(false);
  });

  it('in a shell that swaps its pages: a click on another page goes through navigate()', () => {
    const event = click('/machines/loom-3', '/alerts');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/machines/loom-3');
  });

  it('the same page with other filters stays the router\'s own', () => {
    const event = click('/alerts?line_id=l1', '/alerts');
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('outside such a shell it is the router\'s own link (still with nothing fetched ahead)', () => {
    scope.inside = false;
    const event = click('/machines/loom-3', '/alerts');
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(given!.prefetch).toBe(false);
  });

  it('the caller\'s own onNavigate still runs', () => {
    const own = vi.fn();
    click('/machines/loom-3', '/alerts', own);
    expect(own).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe('every link in the app is this one', () => {
  // Next's own <Link> fetches its page as soon as it is on screen: 10 to 27 background page requests on
  // every page view before this (2026-11-24). One import of it anywhere brings that back for that list.
  const SRC = join(__dirname, '..', '..', '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(path); } else if (/\.tsx?$/.test(name)) files.push(path);
    }
  };
  walk(SRC);

  it('nothing but the link itself imports next/link', () => {
    const users = files.filter((f) => /from 'next\/link'/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(SRC.length + 1));
    expect(users).toEqual(['components/ui/app-link.tsx']);
  });

  it('and nothing asks a link to fetch its page ahead', () => {
    const asking = files.filter((f) => /<AppLink[^>]*\sprefetch[\s=>]/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(SRC.length + 1));
    expect(asking).toEqual([]);
  });
});
