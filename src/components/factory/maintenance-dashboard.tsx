'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { MachineHealth } from '@/components/factory/machine-health';
import { SensorDashboard } from '@/components/factory/sensor-dashboard';
import { ServiceLog } from '@/components/factory/service-log';
import { ChartSkeleton, StatGridSkeleton } from '@/components/ui/page-skeletons';
import { QuerySuspense } from '@/components/ui/query-suspense';
import { useShown } from '@/lib/factory-refs-context';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { useFactoryHref } from '@/lib/factory-links-context';

const TABS = [
  { key: 'health', label: 'Machine health' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'vibration', label: 'Vibration' },
  { key: 'log', label: 'Service log' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/**
 * Predictive maintenance: each machine's condition from its signs, the temperature and vibration
 * pages behind it, and the service log. The tab is in the address (?tab=), so a link lands on it.
 */
export function MaintenanceDashboard({ factoryId }: { factoryId: string }) {
  const link = useFactoryHref();
  const { t } = useT();
  const shown = useShown();
  const sp = useSearchParams();
  const tabs = TABS.filter((tab) => shown(`maintenance.${tab.key}`));
  const asked = sp.get('tab') as Tab | null;
  const tab: Tab = tabs.some((x) => x.key === asked) ? (asked as Tab) : (tabs[0]?.key ?? 'health');
  const hrefFor = (key: Tab) => {
    const p = new URLSearchParams(sp.toString());
    if (key === 'health') p.delete('tab');
    else p.set('tab', key);
    const q = p.toString();
    return link(`/factories/${factoryId}/maintenance${q ? `?${q}` : ''}`);
  };
  const fallback = <><StatGridSkeleton count={2} /><ChartSkeleton /></>;

  return (
    <div className="space-y-6">
      {tabs.length > 1 && (
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={t('Predictive maintenance')}>
          {tabs.map((x) => (
            <Link
              key={x.key}
              href={hrefFor(x.key)}
              scroll={false}
              aria-current={x.key === tab ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium',
                x.key === tab ? 'bg-primary text-primary-foreground' : 'text-muted hover:bg-slate-100',
              )}
            >
              {t(x.label)}
            </Link>
          ))}
        </nav>
      )}
      {tab === 'health' && <QuerySuspense fallback={fallback}><MachineHealth factoryId={factoryId} /></QuerySuspense>}
      {tab === 'temperature' && <QuerySuspense fallback={fallback}><SensorDashboard factoryId={factoryId} kind="temperature" /></QuerySuspense>}
      {tab === 'vibration' && <QuerySuspense fallback={fallback}><SensorDashboard factoryId={factoryId} kind="vibration" /></QuerySuspense>}
      {tab === 'log' && <ServiceLog factoryId={factoryId} />}
    </div>
  );
}
