/**
 * The staff console's "Phone bottom bar" for a factory, rendered (server render): a switch per page
 * the factory has on, what phones show now, and the pages waiting behind "More" when more than fit
 * are chosen.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FactoryBarEditor } from '@/components/admin/factory-display-editor';
import { FACTORY_PAGES } from '@/lib/display';
import type { Factory } from '@/lib/types';

const factory = (display: Record<string, boolean>) => ({ factory_id: 'mill', name: 'Mill', display, features: {} }) as unknown as Factory;
const render = (display: Record<string, boolean>) => renderToString(
  <QueryClientProvider client={new QueryClient()}><FactoryBarEditor factory={factory(display)} pages={[]} /></QueryClientProvider>,
).replace(/<!-- -->/g, '');
const bar = (...on: string[]) => Object.fromEntries(FACTORY_PAGES.map((p) => [`bar.${p.slug}`, on.includes(p.slug)]));
const switched = (html: string, label: string) => new RegExp(`aria-checked="true" aria-label="${label} on the bottom bar"`).test(html);

describe('the phone bottom bar, per factory', () => {
  it('a switch for every page the factory has on, those on the bar switched on; what phones show now', () => {
    const html = render({ ...bar('overview', 'alerts', 'support'), compliance: false, cameras: false });
    expect(html).toContain('Phone bottom bar');
    expect(html).toContain('On phones now: ');
    expect(html).toContain('Overview · Alerts · Support · More (15)');
    expect(switched(html, 'Overview')).toBe(true);
    expect(switched(html, 'Support')).toBe(true);
    expect(switched(html, 'Results')).toBe(false);
    expect(html).toContain('aria-label="Team on the bottom bar"');
    expect(html).not.toContain('aria-label="Compliance on the bottom bar"');   // switched off for this factory
    expect(html).not.toContain('behind &quot;More&quot; until');
  });

  it('more than four chosen: the ones that wait behind More are named', () => {
    const html = render(bar('overview', 'alerts', 'results', 'energy', 'team', 'support'));
    expect(html).toContain('Overview · Alerts · Results · Energy · More (16)');
    expect(html).toContain('Only 4 fit beside &quot;More&quot;: Team, Support are behind &quot;More&quot;');
  });

  it('a factory nobody set a bar for: the first four', () => {
    const html = render({ compliance: false, cameras: false });
    expect(html).toContain('Overview · Alerts · Timeline · Availability · More (14)');
    expect(switched(html, 'Availability')).toBe(true);
  });

  it('nothing on the bar', () => {
    expect(render(bar())).toContain('More (20)');
  });
});
