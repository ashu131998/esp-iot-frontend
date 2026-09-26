'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import {
  FEATURE_LABELS,
  FEATURE_SLUGS,
  type FeatureSlug,
  isFeatureEnabled,
} from '@/lib/factory-features';
import type { Factory } from '@/lib/types';
import { cn } from '@/lib/utils';

function FeatureSwitch({
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

export function FactoryFeaturesCard({ factories }: { factories: Factory[] }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null); // `${factoryId}:${slug}`
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ factoryId, slug, value }: { factoryId: string; slug: FeatureSlug; value: boolean }) =>
      api.adminUpdateFactoryFeatures(factoryId, { [slug]: value }),
    onMutate: ({ factoryId, slug }) => {
      setError(null);
      setPending(`${factoryId}:${slug}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-factories'] }),
    onError: (err: Error) => setError(err.message),
    onSettled: () => setPending(null),
  });

  return (
    <Card className="p-6">
      <CardHeader
        title="Page Features"
        description="Toggle which optional dashboard pages each factory sees. Vibration and Temperature need REV B sensors; Energy is on by default."
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {factories.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No factories found.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-medium">Factory</th>
                {FEATURE_SLUGS.map((slug) => (
                  <th key={slug} className="px-3 py-2 text-center font-medium">
                    {FEATURE_LABELS[slug]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factories.map((f) => (
                <tr key={f.factory_id} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <span className="block font-medium text-foreground">{f.name}</span>
                    <span className="block text-xs text-muted">{f.factory_id}</span>
                  </td>
                  {FEATURE_SLUGS.map((slug) => {
                    const key = `${f.factory_id}:${slug}`;
                    const checked = isFeatureEnabled(f.features, slug);
                    return (
                      <td key={slug} className="px-3 py-3 text-center">
                        <div className="flex justify-center">
                          <FeatureSwitch
                            label={`${FEATURE_LABELS[slug]} for ${f.name}`}
                            checked={checked}
                            disabled={pending === key}
                            onChange={(value) =>
                              mutation.mutate({ factoryId: f.factory_id, slug, value })
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
