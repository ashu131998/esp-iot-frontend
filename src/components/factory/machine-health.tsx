'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';

import { SplitCard } from '@/components/charts/donut-chart';
import { ServiceForm } from '@/components/factory/service-form';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SummaryCard, TONE_DOT } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLineName } from '@/lib/factory-refs-context';
import { formatFullDate } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { SERVICE_KIND_WORD, conditionInfo, conditionSlices, nextServiceWords, overviewWords, signText, signTone } from '@/lib/maintenance';
import { useRefetchInterval, useSetRefreshInfo } from '@/lib/refresh-context';
import type { MaintenanceMachine } from '@/lib/types';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';
import { cn } from '@/lib/utils';
import { useFactoryHref } from '@/lib/factory-links-context';

const REFRESH_MS = 60_000;
const TONE_BADGE = {
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-700',
  idle: 'bg-slate-100 text-slate-600',
} as const;

export const maintenanceKey = (factoryId: string, lineId?: string, machineId?: string) => ['maintenance', factoryId, lineId ?? '', machineId ?? ''];

/**
 * Every machine's condition now, worst first: what its signs say (vibration, temperature, motor
 * load, stops, hours since service), its last service and when the next falls due. Admins record
 * a service from here.
 */
export function MachineHealth({ factoryId }: { factoryId: string }) {
  const link = useFactoryHref();
  const { t, tn, locale } = useT();
  const { canWriteFactory } = useAuth();
  const lineName = useLineName();
  const { lineId, machineId } = useFactoryDateRange();
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const { data, dataUpdatedAt } = useSuspenseQuery({
    queryKey: maintenanceKey(factoryId, lineId, machineId),
    queryFn: ({ signal }) => api.maintenance(factoryId, { line_id: lineId, machine_id: machineId }, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  useSetRefreshInfo(dataUpdatedAt, REFRESH_MS / 1000);
  const [recording, setRecording] = useState<MaintenanceMachine | null>(null);
  const words = overviewWords(data, t, tn);
  const withSigns = data.machines.filter((m) => m.condition !== 'no_data');

  return (
    <div className="space-y-6">
      <SummaryCard tone={words.tone} icon={words.tone === 'good' ? undefined : <Wrench className="h-5 w-5" />} title={words.title} subtitle={words.subtitle} />
      {withSigns.length > 0 && (
        <SplitCard
          title={t('Machines by condition')}
          description={t("From each machine's signs: vibration, temperature, motor load, stops and hours since its last service")}
          slices={conditionSlices(data, t)}
          format={(n) => tn(n, '{count} machine', '{count} machines', { count: n })}
          centerLabel={t('Machines')}
          locale={locale}
        />
      )}

      <Card>
        <CardHeader
          title={t('Machines')}
          description={t('Worst first. Each sign reads as the sensors see it; recording a service resets the running hours.')}
          action={canWriteFactory && data.machines.length > 0 ? (
            <Button type="button" size="sm" onClick={() => setRecording(data.machines[0])}>{t('Record a service')}</Button>
          ) : undefined}
        />
        {data.machines.length === 0 ? (
          <p className="text-sm text-muted">{t('No machines yet.')}</p>
        ) : (
          <ul className="divide-y">
            {data.machines.map((m) => {
              const info = conditionInfo(m.condition);
              const next = nextServiceWords(m, t, tn);
              return (
                <li key={m.machine_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="min-w-0 sm:w-56">
                    <Link href={link(`/factories/${factoryId}/machines/${m.machine_id}`)} className="font-medium hover:underline">{m.machine_name}</Link>
                    <div className="text-xs text-muted">{lineName(m.line_id)}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE_BADGE[info.tone])}>{t(info.word)}</span>
                      {m.score !== null && <span className="text-xs text-muted tabular-nums">{t('Health {score}', { score: m.score })}</span>}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    {m.signs.length === 0 ? (
                      <p className="text-sm text-muted">{t('No signs to read yet: no current sensor, probe or vibration sensor is matched to this machine.')}</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {m.signs.map((s) => (
                          <li key={s.kind} className="flex items-start gap-2">
                            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[signTone(s)])} />
                            <span>{signText(s, t)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {m.last_service
                        ? t('Last service {date}: {kind}', { date: formatFullDate(m.last_service.done_at, locale), kind: t(SERVICE_KIND_WORD[m.last_service.kind as keyof typeof SERVICE_KIND_WORD] ?? m.last_service.kind) })
                        : t('No service recorded yet')}
                      {next ? ` · ${next}` : ''}
                    </p>
                  </div>
                  {canWriteFactory && (
                    <div className="shrink-0">
                      <Button type="button" size="sm" variant="secondary" onClick={() => setRecording(m)}>{t('Record service')}</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {recording && (
        <ServiceForm factoryId={factoryId} machines={data.machines} initialMachineId={recording.machine_id} onClose={() => setRecording(null)} />
      )}
    </div>
  );
}
