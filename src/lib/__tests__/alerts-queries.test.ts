/**
 * The factory Alerts page's shared names (lib/alerts-queries.ts): the page fetches on the server what
 * its sections read in the browser, and both go by these. A name or a window that differed between
 * the two made the browser fetch everything again behind a skeleton that then jumped.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DOWNTIME_REPORTS_LIMIT, FOLLOW_UP_DAYS, NOTIFICATIONS_LIMIT, alertsMachinesWindow, alertsQueryKeys, stopFollowUpWindow,
} from '@/lib/alerts-queries';
import { JUST_FETCHED_MS } from '@/lib/query-freshness';

const SRC = join(__dirname, '..', '..');
const read = (file: string) => readFileSync(join(SRC, file), 'utf8');

afterEach(() => vi.useRealTimers());

describe('the names', () => {
  it('the machine section is named by the factory and the end of what the viewer may see', () => {
    expect(alertsQueryKeys.machines('mill', null)).toEqual(['availability-factory-alerts', 'mill', null]);
    expect(alertsQueryKeys.machines('mill', '2026-10-31T18:30:00.000Z')).toEqual(['availability-factory-alerts', 'mill', '2026-10-31T18:30:00.000Z']);
  });
  it('the other sections by the factory (and what they are of)', () => {
    expect(alertsQueryKeys.settings('mill')).toEqual(['alert-settings', 'mill']);
    expect(alertsQueryKeys.testWorkers('mill')).toEqual(['workers', 'mill', 'alert-test']);
    expect(alertsQueryKeys.downtimeReports('mill')).toEqual(['downtime-reports', 'mill']);
    expect(alertsQueryKeys.downtimeReasons('mill')).toEqual(['downtime-reasons', 'mill']);
    expect(alertsQueryKeys.stopFollowUp('mill')).toEqual(['stop-follow-up', 'mill', FOLLOW_UP_DAYS]);
    expect(alertsQueryKeys.stopFollowUpAll('mill')).toEqual(['stop-follow-up', 'mill']);
    expect(alertsQueryKeys.notifications('mill')).toEqual(['notifications', 'mill']);
    expect(alertsQueryKeys.filterLines('mill')).toEqual(['factory-lines', 'mill']);
    expect(alertsQueryKeys.filterMachines('mill', '')).toEqual(['factory-machines', 'mill', '']);
    expect(alertsQueryKeys.filterMachines('mill', 'line-2')).toEqual(['factory-machines', 'mill', 'line-2']);
  });
});

describe('the windows', () => {
  it('machines: the last 24 hours up to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T10:00:00.000Z'));
    expect(alertsMachinesWindow(null)).toEqual({ from: '2026-11-23T10:00:00.000Z', to: '2026-11-24T10:00:00.000Z' });
  });
  it('machines, for a factory whose subscription ended: the 24 hours up to that end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T10:00:00.000Z'));
    expect(alertsMachinesWindow('2026-10-31T18:30:00.000Z')).toEqual({ from: '2026-10-30T18:30:00.000Z', to: '2026-10-31T18:30:00.000Z' });
  });
  it('machines: an end that has not come yet changes nothing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T10:00:00.000Z'));
    expect(alertsMachinesWindow('2027-01-31T18:30:00.000Z').to).toBe('2026-11-24T10:00:00.000Z');
  });
  it('follow-up: the last week up to the moment asked', () => {
    expect(FOLLOW_UP_DAYS).toBe(7);
    expect(stopFollowUpWindow(new Date('2026-11-24T10:00:00.000Z'))).toEqual({ from: '2026-11-17T10:00:00.000Z', to: '2026-11-24T10:00:00.000Z' });
  });
});

describe('the page and its sections go by the same names and sizes', () => {
  // the Alerts page (our staff's): machines, who gets alerts and how, the downtime reasons, the alerts sent
  const pages = { alerts: read('app/factories/[factoryId]/alerts/page.tsx') };
  const page = pages.alerts;
  const sections = {
    machines: read('components/factory/factory-alerts-dashboard.tsx'),
    filters: read('components/alerts/alert-scope-filters.tsx'),
    settings: read('components/alerts/mobile-settings-card.tsx'),
    downtime: read('components/alerts/downtime-reports-card.tsx'),
    feed: read('components/alerts/notification-feed.tsx'),
  };

  it('each name is used on both sides, and none is spelled out by hand any more', () => {
    const uses: Array<[string, keyof typeof sections, keyof typeof pages]> = [
      ['machines', 'machines', 'alerts'], ['filterLines', 'filters', 'alerts'], ['filterMachines', 'filters', 'alerts'],
      ['settings', 'settings', 'alerts'], ['testWorkers', 'settings', 'alerts'],
      ['downtimeReports', 'downtime', 'alerts'], ['downtimeReasons', 'downtime', 'alerts'], ['stopFollowUp', 'downtime', 'alerts'],
      ['notifications', 'feed', 'alerts'],
    ];
    for (const [name, section, on] of uses) {
      expect(pages[on], `${on} page: ${name}`).toMatch(new RegExp(`(keys|alertsQueryKeys)\\.${name}\\(`));
      expect(sections[section], `${section}: ${name}`).toContain(`alertsQueryKeys.${name}(`);
    }
    const byHand = /queryKey: \['(availability-factory-alerts|alert-settings|workers|downtime-reports|downtime-reasons|stop-follow-up|notifications|factory-lines|factory-machines)'/;
    for (const [section, source] of Object.entries(sections)) {
      expect(source, section).not.toMatch(byHand);
    }
    for (const [name, source] of Object.entries(pages)) expect(source, name).not.toMatch(/queryKey: \[/);
  });

  it('the sizes and windows too', () => {
    expect(DOWNTIME_REPORTS_LIMIT).toBe(15);
    expect(NOTIFICATIONS_LIMIT).toBe(30);
    expect(page).toContain('serverApi.downtimeReports(factoryId, DOWNTIME_REPORTS_LIMIT)');
    expect(sections.downtime).toContain('api.downtimeReports(factoryId, { limit: DOWNTIME_REPORTS_LIMIT }');
    expect(page).toContain('serverApi.notifications(factoryId, NOTIFICATIONS_LIMIT)');
    expect(sections.feed).toContain('api.notifications(factoryId, { limit: NOTIFICATIONS_LIMIT }');
    expect(page).toContain('alertsMachinesWindow(maxDate)');
    expect(sections.machines).toContain('alertsMachinesWindow(maxDate)');
    expect(page).toContain('stopFollowUpWindow()');
    expect(sections.downtime).toContain('stopFollowUpWindow()');
  });

  it('the machine section is drawn on the server only with its figures in hand', () => {
    expect(page).toContain('const machinesReady = machinesKey !== null && queryClient.getQueryData(machinesKey) !== undefined;');
    expect(page).toContain('<QuerySuspense ssr={machinesReady}');
  });
});

describe('figures that came with the page are not fetched again as it opens', () => {
  it('ten seconds count as just fetched', () => {
    expect(JUST_FETCHED_MS).toBe(10_000);
  });
  it('for the Alerts page\'s sections and the Overview\'s figures', () => {
    for (const file of [
      'components/factory/factory-alerts-dashboard.tsx', 'components/alerts/downtime-reports-card.tsx', 'components/alerts/notification-feed.tsx',
      'components/factory/factory-overview-stat-cards.tsx', 'components/factory/period-splits.tsx', 'components/factory/factory-overview-machines-table.tsx',
    ]) {
      expect(read(file), file).toContain('staleTime: JUST_FETCHED_MS');
    }
    expect(read('components/factory/factory-overview-stat-cards.tsx')).not.toContain('staleTime: 0');
  });
});

describe('how long a stop has lasted, on the Alerts page', () => {
  it('a stop that ended: from its start to its end, whatever the time is', async () => {
    const { downMinutes } = await import('@/components/alerts/downtime-reports-card');
    const ended = { down_since: '2026-11-24T09:00:00.000Z', resolved_at: '2026-11-24T09:37:20.000Z' };
    expect(downMinutes(ended, Date.parse('2026-11-24T10:00:00.000Z'))).toBe(37);
    expect(downMinutes(ended, Date.parse('2026-11-25T10:00:00.000Z'))).toBe(37);
  });
  it('a stop still on: as of when the list was fetched, so the server\'s drawing and the browser\'s agree', async () => {
    const { downMinutes } = await import('@/components/alerts/downtime-reports-card');
    const open = { down_since: '2026-11-24T09:00:00.000Z', resolved_at: null };
    const fetched = Date.parse('2026-11-24T09:41:50.000Z');
    expect(downMinutes(open, fetched)).toBe(42);
    expect(downMinutes(open, fetched)).toBe(downMinutes(open, fetched));
  });
  it('never under a minute', async () => {
    const { downMinutes } = await import('@/components/alerts/downtime-reports-card');
    expect(downMinutes({ down_since: '2026-11-24T09:00:00.000Z', resolved_at: '2026-11-24T09:00:05.000Z' }, 0)).toBe(1);
  });
});
