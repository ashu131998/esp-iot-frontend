'use client';

import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { LOGO_MAX_BYTES, LOGO_TYPES, lookProblems, type LookDraft } from '@/lib/onboarding';

/** Read a picked file as base64 (without the data: prefix). */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

/**
 * The factory's look: its logo and brand colour (sign-in page, sidebar, emails) and which
 * dashboard pages and sections it shows. Everything here is optional and can change later on
 * Pages & branding; only switches changed from their defaults are sent.
 */
export function LookStep({ value, onChange, tried }: { value: LookDraft; onChange: (next: LookDraft) => void; tried: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const catalog = useQuery({ queryKey: ['display-catalog'], queryFn: ({ signal }) => api.adminDisplayCatalog({ signal }) });
  const problems = lookProblems(value);

  const pick = async (file: File | undefined) => {
    setReadError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setReadError('A PNG, JPEG or WebP image');
    if (file.size > LOGO_MAX_BYTES) return setReadError(`At most ${LOGO_MAX_BYTES / 1024} KB (this one is ${Math.ceil(file.size / 1024)} KB)`);
    try {
      onChange({ ...value, logo: { type: file.type, data: await readBase64(file), name: file.name, size: file.size } });
    } catch (err) {
      setReadError((err as Error).message);
    }
  };

  const isOn = (key: string, fallback: boolean) => value.features[key] ?? fallback;
  const toggle = (key: string, fallback: boolean) => {
    const next = { ...value.features };
    const on = !isOn(key, fallback);
    if (on === fallback) delete next[key];
    else next[key] = on;
    onChange({ ...value, features: next });
  };

  return (
    <>
      <CardHeader
        title="Look"
        description="Optional. The logo and colour show on the factory's sign-in page, its sidebar and its emails. All of it can be changed later on Pages & branding."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Logo (PNG, JPEG or WebP, up to 200 KB)">
          <div className="flex flex-wrap items-center gap-3">
            {value.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file
              <img src={`data:${value.logo.type};base64,${value.logo.data}`} alt="" className="h-12 max-w-[10rem] rounded border object-contain p-1" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded border text-xs text-muted">None</span>
            )}
            <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              {value.logo ? 'Change' : 'Choose a file'}
            </Button>
            {value.logo && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, logo: null })}>Remove</Button>
            )}
          </div>
          {value.logo && <p className="text-xs text-muted">{value.logo.name}, {Math.ceil(value.logo.size / 1024)} KB</p>}
          {(readError || (tried && problems.logo)) && <p className="text-xs text-red-600">{readError ?? problems.logo}</p>}
        </Field>
        <Field label="Brand colour">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick a colour"
              value={/^#[0-9a-fA-F]{6}$/.test(value.accent_color) ? value.accent_color : '#2563eb'}
              onChange={(e) => onChange({ ...value, accent_color: e.target.value })}
              className="h-10 w-12 cursor-pointer rounded border bg-white p-1"
            />
            <Input
              value={value.accent_color}
              placeholder="#2563eb (FloorBeat blue if empty)"
              className="font-mono"
              onChange={(e) => onChange({ ...value, accent_color: e.target.value.trim() })}
            />
          </div>
          {tried && problems.accent_color && <p className="text-xs text-red-600">{problems.accent_color}</p>}
        </Field>
      </div>

      <h4 className="mt-6 text-sm font-semibold">Pages on their dashboard</h4>
      <p className="text-xs text-muted">Ticked as they start for every new factory; untick what this factory does not need.</p>
      {catalog.isLoading && <p className="mt-2 text-sm text-muted">Loading the pages…</p>}
      {catalog.error && <p className="mt-2 text-sm text-red-600">{(catalog.error as Error).message}</p>}
      <div className="mt-2 grid items-start gap-2 sm:grid-cols-2">
        {(catalog.data?.pages ?? []).map((page) => {
          const pageOn = page.fixed || isOn(page.key, page.default);
          return (
            <div key={page.key} className="rounded-lg border p-3 text-sm">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={pageOn} disabled={page.fixed} onChange={() => toggle(page.key, page.default)} />
                {page.label}
                {page.fixed && <span className="text-xs font-normal text-muted">always on</span>}
              </label>
              {pageOn && page.sections.length > 0 && (
                <div className="mt-2 space-y-1 pl-6">
                  {page.sections.map((s) => (
                    <label key={s.key} className="flex items-start gap-2 text-xs text-muted">
                      <input type="checkbox" className="mt-0.5" checked={isOn(s.key, s.default)} onChange={() => toggle(s.key, s.default)} />
                      <span><span className="text-foreground">{s.label}</span>{s.description ? ` · ${s.description}` : ''}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
