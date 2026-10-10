'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { isInternalAdmin } from '@/lib/internal-auth';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';

export function ShiftReportJobPanel() {
  const { user } = useAuth();
  const canWrite = isInternalAdmin(user);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-shift-report-job'],
    queryFn: ({ signal }) => api.adminShiftReportJob({ signal }),
  });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [tickMinutes, setTickMinutes] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const job = data?.job;
  const effectiveEnabled = enabled ?? job?.enabled ?? false;
  const effectiveTick = tickMinutes ?? job?.tick_minutes ?? 15;

  const saveMutation = useMutation({
    mutationFn: () =>
      api.adminUpdateShiftReportJob({
        enabled: effectiveEnabled,
        tick_minutes: effectiveTick,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-shift-report-job'] });
      setMsg('Scheduler settings saved.');
      setEnabled(null);
      setTickMinutes(null);
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const runMutation = useMutation({
    mutationFn: () => api.adminRunShiftReportJob(),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['admin-shift-report-job'] });
      setMsg(`Run completed — ${result.results?.length ?? 0} factory result(s).`);
    },
    onError: (e: Error) => setMsg(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted">Loading shift report job…</p>;
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader
          title="Post-shift email scheduler"
          description="Runs inside the query-api process. When enabled, it checks on an interval and sends reports for each factory that opted in (Shift reports tab under that factory)."
        />
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">Email delivery (Resend):</span>
            {data?.email_configured ? (
              <Badge className="bg-emerald-100 text-emerald-800">Configured</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-900">Set RESEND_API_KEY + SHIFT_REPORT_FROM_EMAIL on API</Badge>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={effectiveEnabled}
              disabled={!canWrite}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable automatic shift report job
          </label>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="tick-minutes">Check every</label>
            <input
              id="tick-minutes"
              type="number"
              min={1}
              max={120}
              disabled={!canWrite}
              className="w-20 rounded border border-slate-200 px-2 py-1"
              value={effectiveTick}
              onChange={(e) => setTickMinutes(Number(e.target.value))}
            />
            <span className="text-muted">minutes (after each shift ends + settle window)</span>
          </div>

          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save scheduler
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
                disabled={runMutation.isPending}
                onClick={() => runMutation.mutate()}
              >
                {runMutation.isPending ? 'Running…' : 'Run now'}
              </button>
            </div>
          )}

          {job?.last_run_at && (
            <p className="text-sm text-muted">
              Last run: {formatDate(job.last_run_at)}
            </p>
          )}
          {job?.last_run_result && Object.keys(job.last_run_result).length > 0 && (
            <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-3 text-xs">
              {JSON.stringify(job.last_run_result, null, 2)}
            </pre>
          )}
          {msg && <p className="text-sm text-muted">{msg}</p>}
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader title="Factory subscriptions" description="Per-factory recipients are configured under each factory → Shift reports." />
        <Table className="mt-4 border-0">
          <THead>
            <TR>
              <TH>Factory</TH>
              <TH>Enabled</TH>
              <TH>Recipients</TH>
              <TH>Last sent</TH>
            </TR>
          </THead>
          <TBody>
            {(data?.factory_schedules ?? []).length === 0 ? (
              <TR>
                <TD className="text-muted">No factory schedules saved yet.</TD>
                <TD>—</TD>
                <TD>—</TD>
                <TD>—</TD>
              </TR>
            ) : (
              data?.factory_schedules.map((s) => (
                <TR key={s.factory_id}>
                  <TD className="font-medium">{s.factory_name ?? s.factory_id}</TD>
                  <TD>{s.enabled ? 'Yes' : 'No'}</TD>
                  <TD className="font-mono text-xs">{s.recipient_emails.join(', ') || '—'}</TD>
                  <TD className="text-xs text-muted">
                    {s.last_sent && Object.keys(s.last_sent).length > 0
                      ? JSON.stringify(s.last_sent)
                      : '—'}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
