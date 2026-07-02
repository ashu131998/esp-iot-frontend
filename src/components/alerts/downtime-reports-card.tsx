'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useRefetchInterval } from '@/lib/refresh-context';
import type { DowntimeReport } from '@/lib/types';

const REFRESH_MS = 30_000;

function durationLabel(report: DowntimeReport) {
  const end = report.resolved_at ? new Date(report.resolved_at).getTime() : Date.now();
  const min = Math.max(1, Math.round((end - new Date(report.down_since).getTime()) / 60000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}

export function DowntimeReportsCard({ factoryId }: { factoryId: string }) {
  const queryClient = useQueryClient();
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

  return (
    <Card>
      <CardHeader
        title="Downtime Reports"
        description="Why machines went down — answered by workers on WhatsApp, or set here"
        action={<Wrench className="h-4 w-4 text-muted" />}
      />
      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted">
          No downtime recorded yet. When a loom stops, a report is opened here and the
          assigned worker is asked for the reason on WhatsApp.
        </div>
      ) : (
        <ul className="max-h-[480px] divide-y overflow-y-auto rounded-lg border">
          {reports.map((r) => (
            <li key={r.report_id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/factories/${factoryId}/machines/${r.machine_id}`}
                  className="text-sm font-semibold hover:underline"
                >
                  {r.machine_name ?? r.machine_id}
                </Link>
                {r.resolved_at ? (
                  <Badge className="bg-emerald-50 text-emerald-700">resolved</Badge>
                ) : (
                  <Badge className="bg-red-50 text-red-700">still down</Badge>
                )}
                <span className="text-xs text-muted">
                  {new Date(r.down_since).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {durationLabel(r)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {r.reason_label ? (
                  <>
                    <Badge className="bg-blue-50 text-blue-700">{r.reason_label}</Badge>
                    <span className="text-muted">
                      {r.reported_by_name ? `by ${r.reported_by_name}` : ''}
                      {r.reported_via ? ` via ${r.reported_via}` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-muted">Awaiting worker reply · set manually:</span>
                    <Select
                      className="w-auto py-1 text-xs"
                      defaultValue=""
                      disabled={setReason.isPending}
                      onChange={(e) => {
                        if (e.target.value) {
                          setReason.mutate({ reportId: r.report_id, code: e.target.value });
                        }
                      }}
                    >
                      <option value="" disabled>
                        Select reason…
                      </option>
                      {reasons.map((reason) => (
                        <option key={reason.code} value={reason.code}>
                          {reason.title}
                        </option>
                      ))}
                    </Select>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
