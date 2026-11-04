'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ServiceForm } from '@/components/factory/service-form';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PHONE_HIDDEN, TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFactoryRefs, useLineName } from '@/lib/factory-refs-context';
import { formatDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { SERVICE_KIND_WORD } from '@/lib/maintenance';
import { useFactoryDateRange } from '@/lib/use-factory-date-range';

/** The services recorded, newest first; admins add and remove. */
export function ServiceLog({ factoryId }: { factoryId: string }) {
  const { t, locale } = useT();
  const { canWriteFactory } = useAuth();
  const { machines } = useFactoryRefs();
  const lineName = useLineName();
  const { machineId } = useFactoryDateRange();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const log = useQuery({
    queryKey: ['maintenance-log', factoryId, machineId ?? ''],
    queryFn: ({ signal }) => api.maintenanceLog(factoryId, { machine_id: machineId }, { signal }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteMaintenanceLog(factoryId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-log'] });
      qc.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });
  const entries = log.data?.entries ?? [];
  const kindWord = (kind: string) => t(SERVICE_KIND_WORD[kind as keyof typeof SERVICE_KIND_WORD] ?? kind);

  return (
    <Card>
      <CardHeader
        title={t('Service log')}
        description={t("Every service recorded, newest first. The running hours since a machine's last service count from here.")}
        action={canWriteFactory ? <Button type="button" size="sm" onClick={() => setAdding(true)}>{t('Record a service')}</Button> : undefined}
      />
      {log.isPending && <p className="text-sm text-muted">{t('Loading…')}</p>}
      {log.error && <p className="text-sm text-red-600">{(log.error as Error).message}</p>}
      {log.isSuccess && entries.length === 0 && <p className="text-sm text-muted">{t('No service recorded yet.')}</p>}
      {entries.length > 0 && (
        <Table className="border-0">
          <THead>
            <TR>
              <TH>{t('Done on')}</TH>
              <TH>{t('Machine')}</TH>
              <TH className={PHONE_HIDDEN}>{t('Line')}</TH>
              <TH>{t('What was done')}</TH>
              <TH className={PHONE_HIDDEN}>{t('Note')}</TH>
              <TH className={PHONE_HIDDEN}>{t('By')}</TH>
              {canWriteFactory && <TH />}
            </TR>
          </THead>
          <TBody>
            {entries.map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap">{formatDateTime(e.done_at, locale)}</TD>
                <TD className="font-medium">{e.machine_name ?? e.machine_id}</TD>
                <TD className={PHONE_HIDDEN}>{lineName(e.line_id)}</TD>
                <TD>{kindWord(e.kind)}</TD>
                <TD className={`${PHONE_HIDDEN} max-w-xs text-xs text-muted`}>{e.note ?? ''}</TD>
                <TD className={`${PHONE_HIDDEN} text-xs text-muted`}>{e.created_by ?? ''}</TD>
                {canWriteFactory && (
                  <TD>
                    <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => { if (window.confirm(t('Remove this entry?'))) remove.mutate(e.id); }}>
                      {t('Remove')}
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {adding && (
        <ServiceForm
          factoryId={factoryId}
          machines={machines.map((m) => ({ machine_id: m.machine_id, machine_name: m.name, service_interval_hours: null }))}
          onClose={() => setAdding(false)}
        />
      )}
    </Card>
  );
}
