'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { brandStyle, logoUrl, type FactoryBranding } from '@/lib/branding';
import type { Factory } from '@/lib/types';

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX_BYTES = 200 * 1024;
const STANDARD_COLOR = '#2563eb';

type LogoChange = { type: string; data: string; preview: string } | null | undefined;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Staff screen: the factory's accent colour and logo, shown in its dashboard
 * and on its sign-in page. Changes are previewed here and saved together.
 */
export function FactoryBrandingCard({ factory }: { factory: Factory }) {
  const qc = useQueryClient();
  const saved: FactoryBranding = factory.branding ?? { accent_color: null, logo_version: null };
  // undefined = unchanged; null = clear / remove
  const [color, setColor] = useState<string | null | undefined>(undefined);
  const [logo, setLogo] = useState<LogoChange>(undefined);
  const [error, setError] = useState<string | null>(null);

  const shownColor = color === undefined ? saved.accent_color : color;
  const shownLogo =
    logo === undefined ? logoUrl(factory.factory_id, saved) : logo === null ? null : logo.preview;
  const changed = color !== undefined || logo !== undefined;

  const mutation = useMutation({
    mutationFn: () =>
      api.adminUpdateFactoryBranding(factory.factory_id, {
        ...(color !== undefined && { accent_color: color }),
        ...(logo !== undefined && { logo: logo && { type: logo.type, data: logo.data } }),
      }),
    onMutate: () => setError(null),
    onSuccess: (data) => {
      // Write the saved branding into the cache; a refetch could read the lagging replica.
      qc.setQueryData<{ factories: Factory[] }>(['admin-factories'], (prev) =>
        prev
          ? {
              ...prev,
              factories: prev.factories.map((f) =>
                f.factory_id === data.factory_id ? { ...f, branding: data.branding } : f,
              ),
            }
          : prev,
      );
      setColor(undefined);
      setLogo(undefined);
    },
    onError: (err: Error) => setError(err.message),
  });

  async function pickLogo(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setError('Logo must be a PNG, JPEG or WebP image (SVG is not allowed).');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError(`Logo must be 200 KB or smaller (this one is ${Math.ceil(file.size / 1024)} KB).`);
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    setLogo({ type: file.type, data: dataUrl.slice(dataUrl.indexOf(',') + 1), preview: dataUrl });
  }

  return (
    <Card className="p-6">
      <CardHeader
        title="Branding"
        description="Logo and accent colour for this factory's dashboard and sign-in page. Only our staff can change this."
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mt-2 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Accent colour</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Accent colour"
                value={shownColor ?? STANDARD_COLOR}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border"
              />
              <span className="font-mono text-sm">{shownColor ?? 'Standard'}</span>
              {shownColor && (
                <button type="button" className="text-sm text-primary hover:underline" onClick={() => setColor(null)}>
                  Use standard
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Logo</p>
            <input
              type="file"
              aria-label="Logo file"
              accept={LOGO_TYPES.join(',')}
              onChange={(e) => {
                void pickLogo(e.target.files?.[0]);
                e.target.value = '';
              }}
              className="block text-sm"
            />
            <p className="mt-1 text-xs text-muted">PNG, JPEG or WebP, up to 200 KB. A square logo looks best.</p>
            {shownLogo && (
              <button type="button" className="mt-1 text-sm text-red-600 hover:underline" onClick={() => setLogo(null)}>
                Remove logo
              </button>
            )}
          </div>
        </div>

        {/* Preview: the sidebar header and a button, as the factory will see them. */}
        <div style={brandStyle(shownColor ? { accent_color: shownColor, logo_version: null } : null)}>
          <p className="mb-1.5 text-sm font-medium">Preview</p>
          <div className="flex items-center gap-2 rounded-lg bg-sidebar px-4 py-3 text-sidebar-foreground">
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview / same-origin logo
              <img src={shownLogo} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />
            ) : (
              <BrandMark className="h-9 w-9" />
            )}
            <span className="truncate text-sm font-semibold">{factory.name}</span>
          </div>
          <div className="mt-3">
            <span className="inline-block rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              Sample button
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => mutation.mutate()} disabled={!changed || mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save branding'}
        </Button>
        {changed && !mutation.isPending && (
          <button
            type="button"
            className="text-sm text-muted hover:underline"
            onClick={() => {
              setColor(undefined);
              setLogo(undefined);
              setError(null);
            }}
          >
            Discard changes
          </button>
        )}
      </div>
    </Card>
  );
}
