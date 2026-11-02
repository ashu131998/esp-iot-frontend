'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { ListEmpty, ListGroup, ListRow, SummaryCard, type Tone } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n/context';
import type { AlertSettings, OwnerContact } from '@/lib/types';

export function MobileSettingsCard({ factoryId }: { factoryId: string }) {
  const queryClient = useQueryClient();
  const { t } = useT();
  const { data: settings } = useQuery({
    queryKey: ['alert-settings', factoryId],
    queryFn: ({ signal }) => api.alertSettings(factoryId, { signal }),
  });

  const [draft, setDraft] = useState<AlertSettings | null>(null);
  const [newContact, setNewContact] = useState<OwnerContact>({ name: '', phone: '' });
  const [addingPhone, setAddingPhone] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testWorkerId, setTestWorkerId] = useState('');
  const [testPushResult, setTestPushResult] = useState<string | null>(null);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  const { data: workersData } = useQuery({
    queryKey: ['workers', factoryId, 'alert-test'],
    queryFn: ({ signal }) => api.workers(factoryId, { limit: 200, status: 'active' }, { signal }),
    enabled: Boolean(settings?.alertops_configured),
  });
  const workers = workersData?.workers ?? [];
  const selectedWorker = workers.find((w) => w.worker_id === testWorkerId);

  useEffect(() => {
    if (settings && !draft) setDraft(settings);
  }, [settings, draft]);

  const save = useMutation({
    mutationFn: (body: Partial<AlertSettings>) => api.updateAlertSettings(factoryId, body),
    onSuccess: (updated) => {
      setDraft({
        ...updated,
        mobile_configured: settings?.mobile_configured ?? false,
        alertops_configured: settings?.alertops_configured ?? false,
      });
      queryClient.invalidateQueries({ queryKey: ['alert-settings', factoryId] });
    },
  });

  const test = useMutation({
    mutationFn: () => api.sendTestNotification(factoryId, { phone: testPhone }),
    onSuccess: (res) => {
      setTestResult(
        res.ok
          ? res.channel === 'console' || res.channel === 'console-mode'
            ? t('Logged to the feed (mobile bridge not live yet).')
            : t('Sent — check the phone or app.')
          : t('Failed: {error}', { error: res.error }),
      );
      queryClient.invalidateQueries({ queryKey: ['notifications', factoryId] });
    },
    onError: (err) => setTestResult(t('Failed: {error}', { error: err.message })),
  });

  const testBoardEmail = useMutation({
    mutationFn: () => api.sendTestBoardAlertEmail(factoryId),
    onSuccess: (res) => {
      if (res.ok) {
        setTestEmailResult(
          t('Sent {count} test email(s) from {from}. Check inbox and spam.', { count: res.sent, from: res.from_email }),
        );
      } else {
        const err = res.results?.find((r) => r.error)?.error ?? t('Send failed');
        setTestEmailResult(t('Failed: {error}', { error: err }));
      }
      queryClient.invalidateQueries({ queryKey: ['notifications', factoryId] });
    },
    onError: (err) => setTestEmailResult(t('Failed: {error}', { error: err.message })),
  });

  const testPush = useMutation({
    mutationFn: () => api.sendTestPush(factoryId, { worker_id: testWorkerId }),
    onSuccess: (res) => {
      setTestPushResult(
        res.ok
          ? t('Push sent to {name}.', { name: selectedWorker?.name ?? t('worker') })
          : t('Failed: {error}', { error: res.error ?? t('Unknown error') }),
      );
      queryClient.invalidateQueries({ queryKey: ['notifications', factoryId] });
    },
    onError: (err) => setTestPushResult(t('Failed: {error}', { error: err.message })),
  });

  if (!draft) {
    return <p className="text-sm text-muted">{t('Loading mobile settings…')}</p>;
  }

  const update = (patch: Partial<AlertSettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    save.mutate({
      mobile_enabled: next.mobile_enabled,
      shift_reminder_minutes: next.shift_reminder_minutes,
      notify_owner_on_down: next.notify_owner_on_down,
      owner_contacts: next.owner_contacts,
    });
  };

  let tone: Tone = draft.mobile_enabled ? 'good' : 'idle';
  if (draft.mobile_enabled && !draft.mobile_configured) tone = 'warn';

  const statusTitle = !draft.mobile_enabled
    ? t('Mobile alerts are off')
    : draft.mobile_configured
      ? t('Mobile alerts are on')
      : t('Mobile alerts on (simulation)');

  const statusSub = draft.mobile_enabled
    ? t('Shift reminders and machine stop/start go to workers on the app.')
    : t('Turn on to send reminders and machine alerts to the mobile app.');

  // Owner phone fields, in the Add phone sheet (Add also closes it).
  const ownerFields = (
    <>
      <Input
        placeholder={t('Name')}
        className="min-w-[100px] flex-1"
        value={newContact.name}
        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
      />
      <Input
        placeholder={t('+91 phone')}
        className="min-w-[120px] flex-1"
        value={newContact.phone}
        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={!newContact.phone.trim()}
        onClick={() => {
          update({ owner_contacts: [...draft.owner_contacts, newContact] });
          setNewContact({ name: '', phone: '' });
          setAddingPhone(false);
        }}
      >
        {t('Add')}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <SummaryCard tone={tone} title={statusTitle} subtitle={statusSub} />

      <div className="space-y-2 px-1 text-sm text-muted">
        <p>
          {t('Board offline emails go to the same people as the shift reports.')}{' '}
          {settings?.board_email_from && (
            <>
              {t('Sender:')} <span className="font-mono text-foreground">{settings.board_email_from}</span>.{' '}
            </>
          )}
          <Link href={`/factories/${factoryId}/shift-reports`} className="font-medium text-primary hover:underline">
            {t('Shift reports')} →
          </Link>
        </p>
        {settings?.board_email_configured ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={testBoardEmail.isPending}
              onClick={() => {
                setTestEmailResult(null);
                testBoardEmail.mutate();
              }}
            >
              {testBoardEmail.isPending ? t('Sending…') : t('Send test board alert email')}
            </Button>
            {testEmailResult && <p className="text-xs">{testEmailResult}</p>}
          </div>
        ) : (
          <p className="text-xs text-amber-700">{t('Board email is not configured on the server yet.')}</p>
        )}
      </div>

      <ListGroup title={t('Settings')}>
        <SettingRow
          label={t('Mobile alerts')}
          hint={t('Master switch for this factory')}
          checked={draft.mobile_enabled}
          onChange={(v) => update({ mobile_enabled: v })}
        />
        <SettingRow
          label={t('Notify owners when a machine stops or starts')}
          hint={t('Uses the phone numbers below')}
          checked={draft.notify_owner_on_down}
          onChange={(v) => update({ notify_owner_on_down: v })}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="font-medium text-foreground">{t('Reminder before shift')}</p>
            <p className="text-sm text-muted">{t('Minutes before shift start')}</p>
          </div>
          <Input
            type="number"
            min={5}
            max={120}
            className="w-20 text-center tabular-nums"
            value={draft.shift_reminder_minutes}
            onChange={(e) => setDraft({ ...draft, shift_reminder_minutes: Number(e.target.value) })}
            onBlur={() => update({})}
          />
        </div>
      </ListGroup>

      <ListGroup title={t('Owner phones')} count={draft.owner_contacts.length}>
        {draft.owner_contacts.length === 0 ? (
          <ListEmpty>{t('Add a number to get owner alerts when machines stop.')}</ListEmpty>
        ) : (
          draft.owner_contacts.map((c, i) => (
            <ListRow
              key={`${c.phone}-${i}`}
              title={c.name || t('Owner')}
              detail={
                <>
                  {c.phone}
                  <button
                    type="button"
                    className="ml-2 text-xs font-medium text-red-600 hover:underline"
                    onClick={() => update({ owner_contacts: draft.owner_contacts.filter((_, j) => j !== i) })}
                  >
                    {t('Remove')}
                  </button>
                </>
              }
            />
          ))
        )}
        <div className="border-t border-gray-100 px-4 py-3">
          <Button variant="secondary" size="sm" onClick={() => setAddingPhone(true)}>
            + {t('Add phone')}
          </Button>
        </div>
        {addingPhone && (
          <Sheet title={t('Add owner phone')} onClose={() => setAddingPhone(false)}>
            <div className="flex flex-col gap-3">{ownerFields}</div>
          </Sheet>
        )}
      </ListGroup>

      <details className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">{t('Test alerts')}</summary>
        <div className="mt-3 space-y-4 border-t border-gray-100 pt-3 text-sm">
          {!draft.alertops_configured ? (
            <p className="text-muted">{t('Test push needs the mobile app bridge on the server.')}</p>
          ) : workers.length === 0 ? (
            <p className="text-muted">{t('Add workers on Team first.')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-muted">{t('Send one test push to a worker.')}</p>
              <div className="flex flex-wrap gap-2">
                <Select
                  className="min-w-[200px] flex-1"
                  value={testWorkerId}
                  onChange={(e) => {
                    setTestWorkerId(e.target.value);
                    setTestPushResult(null);
                  }}
                >
                  <option value="">{t('Choose worker…')}</option>
                  {workers.map((w) => (
                    <option key={w.worker_id} value={w.worker_id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  disabled={!testWorkerId || testPush.isPending}
                  onClick={() => {
                    setTestPushResult(null);
                    testPush.mutate();
                  }}
                >
                  {testPush.isPending ? t('Sending…') : t('Send push')}
                </Button>
              </div>
              {testPushResult && <p className="text-xs text-muted">{testPushResult}</p>}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-muted">{t('Legacy phone test (WhatsApp if configured).')}</p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder={t('Phone number')}
                className="min-w-[160px] flex-1"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!testPhone.trim() || test.isPending}
                onClick={() => {
                  setTestResult(null);
                  test.mutate();
                }}
              >
                {test.isPending ? t('Sending…') : t('Send test')}
              </Button>
            </div>
            {testResult && <p className="text-xs text-muted">{testResult}</p>}
          </div>
        </div>
      </details>
    </div>
  );
}

function SettingRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-gray-300"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
