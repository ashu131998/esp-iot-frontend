'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const DEFAULT_OWNER_EMAIL = 'khandelwalashutosh73@gmail.com';

function emailsToText(list: string[]) {
  return list.join('\n');
}

function textToEmails(text: string) {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ShiftReportSchedulePanel({ factoryId }: { factoryId: string }) {
  const { canWriteFactory } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shift-report-schedule', factoryId],
    queryFn: ({ signal }) => api.shiftReportSchedule(factoryId, { signal }),
  });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [emailText, setEmailText] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const effectiveEnabled = enabled ?? data?.enabled ?? false;
  const effectiveEmails =
    emailText ??
    emailsToText(data?.recipient_emails?.length ? data.recipient_emails : [DEFAULT_OWNER_EMAIL]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateShiftReportSchedule(factoryId, {
        enabled: effectiveEnabled,
        recipient_emails: textToEmails(effectiveEmails),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['shift-report-schedule', factoryId] });
      setSaveMsg('ok:Saved.');
      setEnabled(null);
      setEmailText(null);
    },
    onError: (e: Error) => setSaveMsg(`err:${e.message}`),
  });

  const testMutation = useMutation({
    mutationFn: () =>
      api.testShiftReportSchedule(factoryId, {
        recipient_emails: textToEmails(effectiveEmails),
      }),
    onSuccess: () => setTestMsg('ok:Test email sent — check the inbox (and spam).'),
    onError: (e: Error) => setTestMsg(`err:${e.message}`),
  });

  if (isLoading) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }
  if (error) {
    return <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader
          title="Email after each shift"
          description="Pick who gets a short email when each shift ends."
        />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Sending:</span>
          {data?.platform_scheduler_enabled ? (
            <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
          ) : (
            <Badge className="bg-slate-100 text-slate-700">Not switched on yet — ask FloorBeat support</Badge>
          )}
          {!data?.email_delivery_configured && (
            <Badge className="bg-amber-100 text-amber-900">Email is not set up yet — ask FloorBeat support</Badge>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={effectiveEnabled}
              disabled={!canWriteFactory}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Send the email after each shift
          </label>

          <div>
            <label className="text-sm font-medium" htmlFor="shift-report-emails">
              Who gets the email
            </label>
            <p className="text-xs text-muted">Write one email address on each line.</p>
            <textarea
              id="shift-report-emails"
              className="mt-1 w-full max-w-lg rounded-lg border border-slate-200 p-2 font-mono text-sm"
              rows={4}
              disabled={!canWriteFactory}
              value={effectiveEmails}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder={DEFAULT_OWNER_EMAIL}
            />
          </div>

          {data?.shifts?.length ? (
            <div className="text-sm text-muted">
              <p className="font-medium text-foreground">Shifts:</p>
              <ul className="mt-1 list-disc pl-5">
                {data.shifts.map((s) => (
                  <li key={s.shift_id}>
                    {s.name ?? s.shift_id} — {s.label ?? `${s.start_hour}:00`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canWriteFactory && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
                disabled={testMutation.isPending}
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? 'Sending…' : 'Send test email'}
              </button>
            </div>
          )}
          {saveMsg && (
            <p className={`text-sm ${saveMsg.startsWith('err:') ? 'text-red-600' : 'text-muted'}`}>
              {saveMsg.replace(/^(ok:|err:)/, '')}
            </p>
          )}
          {testMsg && (
            <p className={`text-sm ${testMsg.startsWith('err:') ? 'text-red-600' : 'text-muted'}`}>
              {testMsg.replace(/^(ok:|err:)/, '')}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
