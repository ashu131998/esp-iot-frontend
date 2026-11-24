/**
 * What makes a tap feel instant: the skeleton that takes the leaving page's place at once
 * (lib/navigation-context.tsx PageSwap), who is not sent pages ahead (lib/prefetch-pages.ts), how long
 * a page already given is kept (next.config.ts), and that the built files are kept for good
 * (public/_headers) while the server code runs beside the API (wrangler.jsonc).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/alerts', useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }) }));

const { PageSwap, PageSwapView, usePendingPath } = await import('@/lib/navigation-context');
const { savingData } = await import('@/lib/prefetch-pages');

const ROOT = join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

describe('a tab tapped: its skeleton at once', () => {
  const page = <p>the page that is leaving</p>;
  const skeleton = <p>skeleton</p>;

  it('nothing on its way: the page, no skeleton', () => {
    const html = renderToString(<PageSwapView pending={false} skeleton={skeleton}>{page}</PageSwapView>);
    expect(html).toContain('the page that is leaving');
    expect(html).not.toContain('skeleton');
    expect(html).not.toContain('hidden');
  });

  it('another page on its way: the skeleton shows, the leaving page stays mounted but hidden', () => {
    const html = renderToString(<PageSwapView pending skeleton={skeleton}>{page}</PageSwapView>);
    expect(html).toContain('data-page-skeleton');
    expect(html).toContain('aria-busy="true"');
    expect(html.indexOf('skeleton')).toBeLessThan(html.indexOf('the page that is leaving'));
    expect(html).toMatch(/<div hidden="">.*the page that is leaving/);
  });

  it('outside a move (and before the page\'s script runs) nothing is pending', () => {
    function Probe() {
      return <span>{String(usePendingPath())}</span>;
    }
    expect(renderToString(<Probe />)).toContain('null');
    expect(renderToString(<PageSwap skeleton={skeleton}>{page}</PageSwap>)).not.toContain('data-page-skeleton');
  });
});

describe('pages fetched ahead', () => {
  it('not for someone saving data or on a 2G link', () => {
    expect(savingData({ saveData: true })).toBe(true);
    expect(savingData({ effectiveType: '2g' })).toBe(true);
    expect(savingData({ effectiveType: 'slow-2g' })).toBe(true);
    for (const ok of [{ effectiveType: '4g' }, { effectiveType: '3g' }, { saveData: false }, {}, null, undefined]) expect(savingData(ok), JSON.stringify(ok)).toBe(false);
  });
});

describe('what the settings say', () => {
  it('the built files, named by their content, are kept by the browser for good', () => {
    const rules = read('public/_headers').split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    expect(rules).toEqual(['/_next/static/*', '  Cache-Control: public,max-age=31536000,immutable']);
  });

  it('a page already given is kept two minutes, one fetched ahead five', () => {
    expect(read('next.config.ts')).toMatch(/staleTimes: \{ dynamic: 120, static: 300 \}/);
  });

  it('the server code runs beside the API, named outright, in every environment', () => {
    const config = read('wrangler.jsonc');
    expect(config).toContain('"placement": { "region": "aws:eu-central-1" }');
    expect(config.match(/"placement"/g)).toHaveLength(1);   // set once, at the top: the environments take it from there
    expect(config).not.toContain('"mode": "smart"');
  });
});
