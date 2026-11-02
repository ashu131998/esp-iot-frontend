'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Select } from '@/components/ui/input';
import { ListEmpty, ListGroup, ListRow, SummaryCard, type Tone } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { humanMinutes } from '@/lib/plain-words';
import { useRefetchInterval } from '@/lib/refresh-context';
import type { DowntimeReport } from '@/lib/types';

const REFRESH_MS = 30_000;

/** How long a stop lasted (or has lasted so far), in whole minutes. */
function downMinutes(report: DowntimeReport) {
  const end = report.resolved_at ? new Date(report.resolved_at).getTime() : Date.now();
  return Math.max(1, Math.round((end - new Date(report.down_since).getTime()) / 60000));
}

export function DowntimeReportsCard({ factoryId }: { factoryId: string }) {
  const queryClient = useQueryClient();
  const { t, tn, locale } = useT();
  const refetchInterval = useRefetchInterval(REFRESH_MS);

  const { data } = useQuery({
    queryKey: ['downtime-reports', factoryId],
    queryFn: ({ signal }) => api.downtimeReports(factoryId, { limit: 15 }, { signal }),
    refetchInterval,
    staleTime: 0,
  });
  const { data: reasonsData } = useQuery({
    queryKey: ['downtime-reasons', factoryId],
    queryFn: ({ signal }) => api.downtimeReasons(factoryId, { signal }),
    staleTime: Infinity,
  });

  const setReason = useMutation({
    mutationFn: ({ reportId, code }: { reportId: string; code: string }) =>
      api.setDowntimeReason(factoryId, reportId, { reason_code: code }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downtime-reports', factoryId] }),
  });

  const reports = data?.reports ?? [];
  const reasons = reasonsData?.reasons ?? [];
  const open = reports.filter((r) => !r.resolved_at);
  const waitingReason = open.filter((r) => !r.reason_label);

  let tone: Tone = 'good';
  if (open.length > 0) tone = 'warn';
  if (waitingReason.length > 0) tone = 'bad';

  const summaryTitle =
    reports.length === 0
      ? t('No downtime reports yet')
      : waitingReason.length > 0
        ? t('{count} waiting for a reason', { count: waitingReason.length })
        : open.length > 0
          ? tn(open.length, '{count} machine still down', '{count} machines still down')
          : t('Recent downtime is logged');

  const summarySub =
    reports.length === 0
      ? t('When a machine stops, workers can say why on the mobile app.')
      : t('Workers reply on the app — or pick a reason here.');

  return (
    <div className="space-y-6">
      <SummaryCard tone={tone} badge={waitingReason.length || undefined} title={summaryTitle} subtitle={summarySub} />

      <ListGroup title={t('Recent stops')} count={reports.length}>
        {reports.length === 0 ? (
          <ListEmpty>{t('Stops will show up here with time and duration.')}</ListEmpty>
        ) : (
          reports.map((r) => {
            const openRow = !r.resolved_at;
            const rowTone: Tone | undefined = openRow ? 'bad' : 'good';
            const timeLine = `${formatDateTime(r.down_since, locale)} · ${humanMinutes(downMinutes(r), t)}`;
            const reasonLine = r.reason_label
              ? `${r.reason_label}${r.reported_by_name ? ` · ${r.reported_by_name}` : ''}`
              : null;
            const needsReason = !r.reason_label && reasons.length > 0;

            return (
              <ListRow
                key={r.report_id}
                href={needsReason ? undefined : `/factories/${factoryId}/machines/${r.machine_id}`}
                tone={rowTone}
                title={r.machine_name ?? r.machine_id}
                tag={openRow ? t('Still down') : t('Back up')}
                detail={
                  needsReason ? (
                    <span className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span>{timeLine}</span>
                      <Select
                        className="max-w-[200px] py-1 text-xs"
                        defaultValue=""
                        disabled={setReason.isPending}
                        onChange={(e) => {
                          if (e.target.value) {
                            setReason.mutate({ reportId: r.report_id, code: e.target.value });
                          }
                        }}
                      >
                        <option value="" disabled>
                          {t('Set reason…')}
                        </option>
                        {reasons.map((reason) => (
                          <option key={reason.code} value={reason.code}>
                            {reason.title}
                          </option>
                        ))}
                      </Select>
                    </span>
                  ) : (
                    <>
                      {timeLine}
                      {reasonLine ? ` · ${reasonLine}` : ''}
                    </>
                  )
                }
              />
            );
          })
        )}
      </ListGroup>
    </div>
  );
}
