/**
 * The worker roster (server render): each worker's login email with the "app" mark when the
 * worker has a FloorBeat account for the alerts app (or an old AlertOps one), and the add form's
 * explanation naming the FloorBeat Alerts app; Hindi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';
import type { Worker } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { WorkerRoster } = await import('@/components/factory/worker-roster');

const worker = (over: Partial<Worker>): Worker => ({
  worker_id: 'w1', factory_id: 'mill', name: 'Ravi', employee_code: 'EMP-1', role: 'Machine Operator', skills: [], phone: null,
  email: null, alertops_user_id: null, user_id: null, status: 'active', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', ...over,
});

function render(workers: Worker[], messages: Record<string, string> | null = null) {
  const client = new QueryClient();
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>
        <WorkerRoster factoryId="mill" workers={workers} />
      </LocaleProvider>
    </QueryClientProvider>,
  ).replaceAll('<!-- -->', '');
}

describe('the roster', () => {
  it('marks the workers who have the app: a FloorBeat account, or an old AlertOps one', () => {
    const html = render([
      worker({ worker_id: 'w1', name: 'Ravi', email: 'ravi@mill.in', user_id: 'u-ravi' }),
      worker({ worker_id: 'w2', name: 'Sita', email: 'sita@mill.in', alertops_user_id: 'ao-1' }),
      worker({ worker_id: 'w3', name: 'Gita', email: 'gita@mill.in' }),
    ]);
    expect(html).toContain('ravi@mill.in');
    expect(html.match(/title="Has a login for the FloorBeat Alerts app"/g)?.length).toBe(2);
    const gita = html.slice(html.indexOf('gita@mill.in'), html.indexOf('gita@mill.in') + 120);
    expect(gita).not.toContain('>app<');
  });

  it('in Hindi', () => {
    const html = render([worker({ email: 'ravi@mill.in', user_id: 'u-ravi' })], hi);
    expect(html).toContain('FloorBeat Alerts ऐप का लॉगिन है');
    expect(html).toContain('कारीगर');
  });
});
