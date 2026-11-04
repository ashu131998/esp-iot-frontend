/**
 * The factory dashboard's subscription bar, rendered for each viewer (server render, so it runs
 * without a browser or a backend).
 */
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { hi } from '@/lib/i18n/messages/hi';
import { LocaleProvider } from '@/lib/i18n/context';
import type { SubscriptionStatus } from '@/lib/subscriptions';

const auth = { canWriteFactory: false, isInternalStaff: false };
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));

const { SubscriptionBar } = await import('@/components/layout/subscription-bar');

function render(status: SubscriptionStatus, viewer: Partial<typeof auth> = {}, locale: 'en' | 'hi' = 'en') {
  Object.assign(auth, { canWriteFactory: false, isInternalStaff: false }, viewer);
  const node: ReactNode = <SubscriptionBar status={status} />;
  return renderToString(locale === 'hi' ? <LocaleProvider locale="hi" messages={hi}>{node}</LocaleProvider> : <LocaleProvider locale="en" messages={{}}>{node}</LocaleProvider>);
}

const ended: SubscriptionStatus = { state: 'ended', ends_on: '2026-12-01', days_left: -2, data_until: '2026-12-01T18:30:00.000Z' };
const ending: SubscriptionStatus = { state: 'ending', ends_on: '2026-12-01', days_left: 5 };

describe('SubscriptionBar', () => {
  it('ended: why the data stops, that nothing is lost, and how to renew', () => {
    const html = render(ended);
    expect(html).toContain('Your FloorBeat subscription ended on 1 Dec 2026.');
    expect(html).toContain('everything recorded since is kept');
    expect(html).toContain('href="mailto:sales@floorbeat.in"');
    expect(html).toContain('bg-red-50');
  });

  it('ended, seen by our staff: they see everything; no renewal line', () => {
    const html = render(ended, { isInternalStaff: true });
    expect(html).toContain('you see everything');
    expect(html).not.toContain('sales@floorbeat.in');
  });

  it('its last days, for an admin: the date and how many days, amber', () => {
    const html = render(ending, { canWriteFactory: true });
    expect(html).toContain('Your FloorBeat subscription ends on 1 Dec 2026, in 5 days.');
    expect(html).toContain('bg-amber-50');
    expect(render({ ...ending, days_left: 1 }, { canWriteFactory: true })).toContain('ends tomorrow, 1 Dec 2026.');
    expect(render({ ...ending, days_left: 0 }, { canWriteFactory: true })).toContain('ends today.');
  });

  it('its last days, for a worker, or a running subscription: nothing', () => {
    expect(render(ending)).toBe('');
    expect(render({ state: 'active', ends_on: '2027-10-31', days_left: 362 }, { canWriteFactory: true })).toBe('');
  });

  it('in Hindi', () => {
    const html = render(ended, {}, 'hi');
    expect(html).toContain('आपकी FloorBeat सदस्यता');
    expect(html).toContain('नवीनीकरण के लिए लिखें:');
  });
});
