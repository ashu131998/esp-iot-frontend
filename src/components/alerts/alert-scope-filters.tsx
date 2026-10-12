'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { Field, Select } from '@/components/ui/input';
import { api } from '@/lib/api';

function useLineMachineOptions(factoryId: string, lineFilter: string) {
  const linesQuery = useQuery({
    queryKey: ['factory-lines', factoryId],
    enabled: Boolean(factoryId),
    queryFn: ({ signal }) => api.lines(factoryId, { limit: 200, offset: 0 }, { signal }),
  });

  const machinesQuery = useQuery({
    queryKey: ['factory-machines', factoryId, lineFilter],
    enabled: Boolean(factoryId),
    queryFn: ({ signal }) =>
      api.machines(factoryId, lineFilter ? { line_id: lineFilter } : undefined, { signal }),
  });

  const machinesForSelect = useMemo(() => {
    const list = machinesQuery.data?.machines ?? [];
    if (!lineFilter) return list;
    return list.filter((m) => m.line_id === lineFilter);
  }, [machinesQuery.data?.machines, lineFilter]);

  return { linesQuery, machinesForSelect };
}

export function LineMachineAlertFilters({
  factoryId,
  lineFilter,
  machineFilter,
  onChange,
}: {
  factoryId: string;
  lineFilter: string;
  machineFilter: string;
  onChange: (patch: Record<string, string | null>) => void;
}) {
  const { linesQuery, machinesForSelect } = useLineMachineOptions(factoryId, lineFilter);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Line">
        <Select
          value={lineFilter}
          onChange={(e) => onChange({ line_id: e.target.value || null })}
        >
          <option value="">All lines</option>
          {(linesQuery.data?.lines ?? []).map((l) => (
            <option key={l.line_id} value={l.line_id}>
              {l.name ?? l.line_id}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Machine">
        <Select
          value={machineFilter}
          onChange={(e) => onChange({ machine_id: e.target.value || null })}
        >
          <option value="">All machines</option>
          {machinesForSelect.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>
              {m.name ?? m.machine_id}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export function FactoryLineMachineAlertFilters({
  onChange,
}: {
  onChange: (patch: Record<string, string | null>) => void;
}) {
  const searchParams = useSearchParams();
  const factoryFilter = searchParams.get('factory_id') ?? '';
  const lineFilter = searchParams.get('line_id') ?? '';
  const machineFilter = searchParams.get('machine_id') ?? '';

  const factoriesQuery = useQuery({
    queryKey: ['admin-factories'],
    queryFn: ({ signal }) => api.adminFactories({ signal }),
  });

  const { linesQuery, machinesForSelect } = useLineMachineOptions(factoryFilter, lineFilter);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Factory">
        <Select
          value={factoryFilter}
          onChange={(e) => onChange({ factory_id: e.target.value || null })}
        >
          <option value="">All factories</option>
          {(factoriesQuery.data?.factories ?? []).map((f) => (
            <option key={f.factory_id} value={f.factory_id}>
              {f.name ?? f.factory_id}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Line">
        <Select
          value={lineFilter}
          disabled={!factoryFilter}
          onChange={(e) => onChange({ line_id: e.target.value || null })}
        >
          <option value="">{factoryFilter ? 'All lines' : 'Select factory first'}</option>
          {(linesQuery.data?.lines ?? []).map((l) => (
            <option key={l.line_id} value={l.line_id}>
              {l.name ?? l.line_id}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Machine">
        <Select
          value={machineFilter}
          disabled={!factoryFilter}
          onChange={(e) => onChange({ machine_id: e.target.value || null })}
        >
          <option value="">{factoryFilter ? 'All machines' : 'Select factory first'}</option>
          {machinesForSelect.map((m) => (
            <option key={m.machine_id} value={m.machine_id}>
              {m.name ?? m.machine_id}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
