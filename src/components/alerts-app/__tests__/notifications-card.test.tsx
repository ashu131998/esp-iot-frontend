/**
 * The settings' notifications card once they are on: a test push everywhere; "turn off on this
 * phone" only where the app does not need them (not on an iPhone, whose app opens only with
 * notifications on). The switch is a stand-in that says "on".
 */
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/context';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/alerts-app/use-push-switch', () => ({
  usePushSwitch: () => ({ state: 'on', busy: false, note: null, enable: vi.fn(), disable: vi.fn(), test: vi.fn(), recheck: vi.fn() }),
}));

const { NotificationsCard } = await import('@/components/alerts-app/notifications-card');

const render = (node: ReactNode) => renderToString(<LocaleProvider locale="en" messages={null}>{node}</LocaleProvider>);

describe('the notifications card, on', () => {
  it('an iPhone: a test push, no way to turn them off', () => {
    const html = render(<NotificationsCard required />);
    expect(html).toContain('Notifications are on for this phone.');
    expect(html).toContain('Send a test');
    expect(html).not.toContain('Turn off on this phone');
  });

  it('elsewhere: a test push and turning them off', () => {
    const html = render(<NotificationsCard required={false} />);
    expect(html).toContain('Send a test');
    expect(html).toContain('Turn off on this phone');
    expect(render(<NotificationsCard />)).toContain('Turn off on this phone');   // the server's page: not an iPhone
  });
});
