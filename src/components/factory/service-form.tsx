'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n/context';
import { SERVICE_KINDS, SERVICE_KIND_WORD } from '@/lib/maintenance';

/** "YYYY-MM-DDTHH:mm" in the browser's clock, what <input type="datetime-local"> takes. */
export function localDateTimeValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Record a service done on a machine (when, what kind, a note), and set how many running hours
 * the machine goes between services. Saved to the service log; the machine's signs refresh.
 */
export function ServiceForm({ factoryId, machines, initialMachineId, onClose }: {
  factoryId: string;
  machines: Array<{ machine_id: string; machine_name: string; service_interval_hours: number | null }>;
  initialMachineId?: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const qc = useQueryClient();
  const [machineId, setMachineId] = useState(initialMachineId ?? machines[0]?.machine_id ?? '');
  const [doneAt, setDoneAt] = useState(localDateTimeValue());
  const [kind, setKind] = useState<(typeof SERVICE_KINDS)[number]>('service');
  const [note, setNote] = useState('');
  const machine = machines.find((m) => m.machine_id === machineId);
  const [interval, setInterval] = useState(machine?.service_interval_hours?.toString() ?? '');

  const save = useMutation({
    mutationFn: async () => {
      await api.addMaintenanceLog(factoryId, { machine_id: machineId, done_at: new Date(doneAt).toISOString(), kind, note: note.trim() || undefined });
      const hours = interval.trim() === '' ? null : Number(interval);
      if (hours !== (machine?.service_interval_hours ?? null)) await api.setServiceInterval(factoryId, machineId, hours);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      qc.invalidateQueries({ queryKey: ['maintenance-log'] });
      onClose();
    },
  });
  const intervalBad = interval.trim() !== '' && !(Number(interval) > 0);

  return (
    <Sheet title={t('Record a service')} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!machineId || intervalBad) return;
          save.mutate();
        }}
      >
        <Field label={t('Machine')}>
          <Select
            value={machineId}
            onChange={(e) => {
              setMachineId(e.target.value);
              setInterval(machines.find((m) => m.machine_id === e.target.value)?.service_interval_hours?.toString() ?? '');
            }}
          >
            {machines.map((m) => <option key={m.machine_id} value={m.machine_id}>{m.machine_name}</option>)}
          </Select>
        </Field>
        <Field label={t('Done on')}>
          <Input type="datetime-local" value={doneAt} max={localDateTimeValue()} onChange={(e) => setDoneAt(e.target.value)} />
        </Field>
        <Field label={t('What was done')}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as (typeof SERVICE_KINDS)[number])}>
            {SERVICE_KINDS.map((k) => <option key={k} value={k}>{t(SERVICE_KIND_WORD[k])}</option>)}
          </Select>
        </Field>
        <Field label={t('Note (optional)')}>
          <Textarea value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} placeholder={t('Which part, by whom, what was found')} />
        </Field>
        <Field label={t('Service every (running hours)')}>
          <Input type="number" min={1} step={1} value={interval} placeholder={t('e.g. 1500')} onChange={(e) => setInterval(e.target.value)} />
          <p className="text-xs text-muted">{t('"Service due" counts the machine\'s running hours against this. Leave empty for no reminder.')}</p>
          {intervalBad && <p className="text-xs text-red-600">{t('A number of hours above 0, or empty')}</p>}
        </Field>
        {save.isError && <p className="text-sm text-red-600">{(save.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" disabled={!machineId || intervalBad || save.isPending}>{save.isPending ? t('Saving…') : t('Save')}</Button>
        </div>
      </form>
    </Sheet>
  );
}
