'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { resolveDisplay, type DisplayPage } from '@/lib/display';
import type { Factory } from '@/lib/types';
import { cn } from '@/lib/utils';

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/**
 * Staff screen: which pages, and which parts of each page, one factory shows.
 * A page that is off leaves the factory's menu and its data is refused; a part
 * that is off is not shown or loaded. Each switch saves on its own.
 */
export function FactoryDisplayEditor({
  factories,
  pages,
}: {
  factories: Factory[];
  pages: DisplayPage[];
}) {
  const qc = useQueryClient();
  const [factoryId, setFactoryId] = useState(factories[0]?.factory_id ?? '');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const factory = factories.find((f) => f.factory_id === factoryId);
  const display = resolveDisplay(pages, factory?.features);

  const mutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      api.adminUpdateFactoryFeatures(factoryId, { [key]: value }),
    onMutate: ({ key }) => {
      setError(null);
      setPending(key);
    },
    onSuccess: (data) => {
      // Apply the authoritative switches from the PATCH response straight into
      // the cache. Don't refetch here — listFactories reads the read replica,
      // which lags the write and would flip the switch back.
      qc.setQueryData<{ factories: Factory[] }>(['admin-factories'], (prev) =>
        prev
          ? {
              ...prev,
              factories: prev.factories.map((f) =>
                f.factory_id === data.factory_id
                  ? { ...f, features: data.features, display: resolveDisplay(pages, data.features) }
                  : f,
              ),
            }
          : prev,
      );
    },
    onError: (err: Error) => setError(err.message),
    onSettled: () => setPending(null),
  });

  if (factories.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted">No factories found.</p>
      </Card>
    );
  }

  const toggle = (key: string, value: boolean) => mutation.mutate({ key, value });

  return (
    <Card className="p-6">
      <CardHeader
        title="Pages & sections"
        description="Choose which pages, and which parts of each page, this factory sees. A page that is off leaves the factory's menu and its data is refused. Only our staff can change this."
        action={
          <select
            aria-label="Factory"
            value={factoryId}
            onChange={(e) => {
              setError(null);
              setFactoryId(e.target.value);
            }}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            {factories.map((f) => (
              <option key={f.factory_id} value={f.factory_id}>
                {f.name} ({f.factory_id})
              </option>
            ))}
          </select>
        }
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-2 divide-y">
        {pages.map((page) => {
          const pageOn = display[page.key] !== false;
          return (
            <li key={page.key} className="py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-foreground">{page.label}</span>
                {page.fixed ? (
                  <span className="text-xs text-muted">Always on</span>
                ) : (
                  <Switch
                    label={`${page.label} page`}
                    checked={pageOn}
                    disabled={pending !== null}
                    onChange={(value) => toggle(page.key, value)}
                  />
                )}
              </div>
              {page.sections.length > 0 && (
                <ul className="mt-2 space-y-2 border-l pl-4">
                  {page.sections.map((section) => (
                    <li key={section.key} className="flex items-center justify-between gap-4 text-sm">
                      <span className={cn('text-muted', !pageOn && 'opacity-60')}>{section.label}</span>
                      <Switch
                        label={`${page.label}: ${section.label}`}
                        checked={display[section.key] !== false}
                        disabled={pending !== null || !pageOn}
                        onChange={(value) => toggle(section.key, value)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
