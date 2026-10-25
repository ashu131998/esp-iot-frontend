'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { AlertSettings, OwnerContact } from '@/lib/types';

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left hover:bg-slate-50"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export function MobileSettingsCard({ factoryId }: { factoryId: string }) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['alert-settings', factoryId],
    queryFn: ({ signal }) => api.alertSettings(factoryId, { signal }),
  });

  const [draft, setDraft] = useState<AlertSettings | null>(null);
  const [newContact, setNewContact] = useState<OwnerContact>({ name: '', phone: '' });
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testWorkerId, setTestWorkerId] = useState('');
  const [testPushResult, setTestPushResult] = useState<string | null>(null);

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
            ? 'Simulated (mobile alert bridge not configured yet) — logged to the feed.'
            : 'Sent! Check the phone or mobile app.'
          : `Failed: ${res.error}`,
      );
      queryClient.invalidateQueries({ queryKey: ['notifications', factoryId] });
    },
    onError: (err) => setTestResult(`Failed: ${err.message}`),
  });

  const testPush = useMutation({
    mutationFn: () => api.sendTestPush(factoryId, { worker_id: testWorkerId }),
    onSuccess: (res) => {
      setTestPushResult(
        res.ok
          ? `Push sent to ${selectedWorker?.name ?? 'worker'} only — check their mobile app inbox.`
          : `Failed: ${res.error ?? 'Unknown error'}`,
      );
      queryClient.invalidateQueries({ queryKey: ['notifications', factoryId] });
    },
    onError: (err) => setTestPushResult(`Failed: ${err.message}`),
  });

  if (!draft) {
    return (
      <Card>
        <CardHeader title="Phone alerts" description="Loading settings…" />
      </Card>
    );
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

  return (
    <Card>
      <CardHeader
        title="Phone alerts"
        description="Messages on the phone app when a machine stops or a shift starts"
        action={
          draft.mobile_configured ? (
            <Badge className="bg-emerald-50 text-emerald-700">
              <MessageCircle className="mr-1 h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-700">
              <MessageCircle className="mr-1 h-3 w-3" /> Test mode
            </Badge>
          )
        }
      />

      <div className="space-y-3">
        <Toggle
          checked={draft.mobile_enabled}
          onChange={(v) => update({ mobile_enabled: v })}
          label="Send phone alerts"
          description="Turn off to stop every alert from this factory"
        />
        <Toggle
          checked={draft.notify_owner_on_down}
          onChange={(v) => update({ notify_owner_on_down: v })}
          label="Tell owners when a machine stops or starts"
          description="The numbers below get a message each time"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Remind workers this many minutes before a shift">
            <Input
              type="number"
              min={5}
              max={120}
              value={draft.shift_reminder_minutes}
              onChange={(e) =>
                setDraft({ ...draft, shift_reminder_minutes: Number(e.target.value) })
              }
              onBlur={() => update({})}
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Owner and manager numbers</p>
          {draft.owner_contacts.length === 0 && (
            <p className="mb-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted">
              No numbers yet. Add one to get a message when a machine stops.
            </p>
          )}
          <ul className="space-y-2">
            {draft.owner_contacts.map((c, i) => (
              <li
                key={`${c.phone}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{c.name || 'Owner'}</span>
                  <span className="ml-2 font-mono text-xs text-muted">{c.phone}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${c.name || c.phone}`}
                  onClick={() =>
                    update({ owner_contacts: draft.owner_contacts.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1">
              <Input
                placeholder="Name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <Input
                placeholder="+91 98765 43210"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={!newContact.phone.trim()}
              onClick={() => {
                update({ owner_contacts: [...draft.owner_contacts, newContact] });
                setNewContact({ name: '', phone: '' });
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 p-4">
          <p className="mb-1 text-sm font-medium">Send a test message to a worker</p>
          <p className="mb-3 text-xs text-muted">
            Only this worker gets it.
          </p>
          {!draft.alertops_configured ? (
            <p className="text-xs text-amber-700">
              Phone alerts are not set up yet — ask FloorBeat support.
            </p>
          ) : workers.length === 0 ? (
            <p className="text-xs text-muted">
              No workers yet. Add them on the Scheduling page first.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[220px] flex-1">
                  <Select
                    value={testWorkerId}
                    onChange={(e) => {
                      setTestWorkerId(e.target.value);
                      setTestPushResult(null);
                    }}
                  >
                    <option value="">Select worker…</option>
                    {workers.map((w) => (
                      <option key={w.worker_id} value={w.worker_id}>
                        {w.name}
                        {w.alertops_user_id ? ' · has the app' : ' · no app yet'}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={!testWorkerId || testPush.isPending}
                  onClick={() => {
                    setTestPushResult(null);
                    testPush.mutate();
                  }}
                >
                  <Send className="mr-1 h-4 w-4" />
                  {testPush.isPending ? 'Sending…' : 'Send test'}
                </Button>
              </div>
              {selectedWorker && !selectedWorker.alertops_user_id && (
                <p className="mt-2 text-xs text-amber-700">
                  This worker can&apos;t sign in to the app yet. Add them again on Scheduling
                  with an email and password.
                </p>
              )}
              {testPushResult && <p className="mt-2 text-xs text-muted">{testPushResult}</p>}
            </>
          )}
        </div>

        <div className="rounded-lg border bg-slate-50 p-4">
          <p className="mb-1 text-sm font-medium">Send a test text message</p>
          <p className="mb-3 text-xs text-muted">
            Only works if text messages are set up for your factory.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[180px] flex-1">
              <Input
                placeholder="Phone number"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={!testPhone.trim() || test.isPending}
              onClick={() => {
                setTestResult(null);
                test.mutate();
              }}
            >
              <Send className="mr-1 h-4 w-4" />
              {test.isPending ? 'Sending…' : 'Send test'}
            </Button>
          </div>
          {testResult && <p className="mt-2 text-xs text-muted">{testResult}</p>}
          {!draft.mobile_configured && (
            <p className="mt-2 text-xs text-amber-700">
              Phone alerts are not set up yet, so nothing is really sent — alerts only
              show in the list above. Ask FloorBeat support to switch them on.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
