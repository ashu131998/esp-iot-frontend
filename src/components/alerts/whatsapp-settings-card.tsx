'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
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

export function WhatsAppSettingsCard({ factoryId }: { factoryId: string }) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['alert-settings', factoryId],
    queryFn: ({ signal }) => api.alertSettings(factoryId, { signal }),
  });

  const [draft, setDraft] = useState<AlertSettings | null>(null);
  const [newContact, setNewContact] = useState<OwnerContact>({ name: '', phone: '' });
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (settings && !draft) setDraft(settings);
  }, [settings, draft]);

  const save = useMutation({
    mutationFn: (body: Partial<AlertSettings>) => api.updateAlertSettings(factoryId, body),
    onSuccess: (updated) => {
      setDraft({ ...updated, whatsapp_configured: settings?.whatsapp_configured ?? false });
      queryClient.invalidateQueries({ queryKey: ['alert-settings', factoryId] });
    },
  });

  const test = useMutation({
    mutationFn: () => api.sendTestNotification(factoryId, { phone: testPhone }),
    onSuccess: (res) => {
      setTestResult(
        res.ok
          ? res.channel === 'console'
            ? 'Simulated (WhatsApp credentials not configured yet) — logged to the feed.'
            : 'Sent! Check the phone.'
          : `Failed: ${res.error}`,
      );
      queryClient.invalidateQueries({ queryKey: ['notifications', factoryId] });
    },
    onError: (err) => setTestResult(`Failed: ${err.message}`),
  });

  if (!draft) {
    return (
      <Card>
        <CardHeader title="WhatsApp Alerts" description="Loading settings…" />
      </Card>
    );
  }

  const update = (patch: Partial<AlertSettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    save.mutate({
      whatsapp_enabled: next.whatsapp_enabled,
      shift_reminder_minutes: next.shift_reminder_minutes,
      notify_owner_on_down: next.notify_owner_on_down,
      owner_contacts: next.owner_contacts,
    });
  };

  return (
    <Card>
      <CardHeader
        title="WhatsApp Alerts"
        description="Shift reminders, machine down/up alerts and reason capture over WhatsApp"
        action={
          draft.whatsapp_configured ? (
            <Badge className="bg-emerald-50 text-emerald-700">
              <MessageCircle className="mr-1 h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-700">
              <MessageCircle className="mr-1 h-3 w-3" /> Simulation mode
            </Badge>
          )
        }
      />

      <div className="space-y-3">
        <Toggle
          checked={draft.whatsapp_enabled}
          onChange={(v) => update({ whatsapp_enabled: v })}
          label="Enable WhatsApp alerts"
          description="Master switch for all outgoing messages for this factory"
        />
        <Toggle
          checked={draft.notify_owner_on_down}
          onChange={(v) => update({ notify_owner_on_down: v })}
          label="Notify owners on machine down/up"
          description="Owner contacts below get a heads-up whenever a loom stops or restarts"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shift reminder lead time (minutes)">
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
          <p className="mb-2 text-sm font-medium">Owner / manager contacts</p>
          {draft.owner_contacts.length === 0 && (
            <p className="mb-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted">
              No owner numbers yet — add one to receive machine down/up alerts.
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
          <p className="mb-2 text-sm font-medium">Send a test message</p>
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
          {!draft.whatsapp_configured && (
            <p className="mt-2 text-xs text-amber-700">
              WhatsApp Cloud API credentials are not set on the server yet — messages are
              simulated and logged in the feed. Set WHATSAPP_ACCESS_TOKEN and
              WHATSAPP_PHONE_NUMBER_ID to go live.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
