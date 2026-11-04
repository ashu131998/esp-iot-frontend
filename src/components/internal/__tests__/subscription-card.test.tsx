/**
 * The staff subscription card and badge rendered with fixed data (server render, so it runs
 * without a browser or a backend).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SubscriptionBadge } from '@/components/internal/subscription-badge';
import { SubscriptionCard } from '@/components/internal/subscription-card';
import type { SubscriptionResponse } from '@/lib/subscriptions';

const F = 'mill-01';

function render(node: ReactNode, data?: SubscriptionResponse) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (data) client.setQueryData(['admin-subscription', F], data);
  return renderToString(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const subscribed: SubscriptionResponse = {
  factory_id: F,
  status: { state: 'ending', period_id: 2, starts_on: '2026-11-01', ends_on: '2026-12-01', days_left: 5, data_until: '2026-12-01T18:30:00.000Z' },
  periods: [
    {
      id: 2, factory_id: F, starts_on: '2026-11-01', ends_on: '2026-12-01', plan: 'Standard', machines: 40, monthly_amount: 24000,
      notes: 'Paid by NEFT', reminders_sent: {}, created_by: 'staff', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 1, factory_id: F, starts_on: '2026-10-01', ends_on: '2026-10-31', plan: 'Pilot', machines: 10, monthly_amount: null,
      notes: null, reminders_sent: {}, created_by: 'staff', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    },
  ],
};

describe('SubscriptionCard', () => {
  it('shows where it stands, every period, which is current, and offers a renewal', () => {
    const html = render(<SubscriptionCard factoryId={F} />, subscribed);
    expect(html).toContain('Ends in 5 days (1 Dec 2026)');
    expect(html).toContain('1 Nov – 1 Dec 2026');
    expect(html).toContain('1 Oct – 31 Oct 2026');
    expect(html).toContain('current');
    expect(html).toContain('₹24,000');
    expect(html).toContain('Paid by NEFT');
    expect(html).toContain('Renew');
  });

  it('none yet: says the factory is not limited, offers its first period', () => {
    const html = render(<SubscriptionCard factoryId={F} />, { factory_id: F, status: { state: 'none' }, periods: [] });
    expect(html).toContain('No subscription');
    expect(html).toContain('the factory is not limited');
    expect(html).toContain('Add period');
  });
});

describe('SubscriptionBadge', () => {
  it('one pill per state', () => {
    expect(render(<SubscriptionBadge status={{ state: 'ended', ends_on: '2026-12-01', days_left: -2 }} />)).toContain('Ended 1 Dec 2026');
    expect(render(<SubscriptionBadge status={undefined} />)).toContain('No subscription');
  });
});
