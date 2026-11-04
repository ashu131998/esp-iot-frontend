'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MAX_WIFI, newWifi, wifiProblems, type WifiDraft } from '@/lib/onboarding';

/**
 * The factory's WiFi networks, in the order the boards try them. Optional: a factory on 4G, or
 * whose WiFi is not ready, skips it; the list can be changed later on the factory's WiFi page,
 * and every board placed there gets it.
 */
export function WifiStep({ value, onChange, tried }: { value: WifiDraft[]; onChange: (next: WifiDraft[]) => void; tried: boolean }) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const problems = wifiProblems(value);
  const set = (k: string, patch: Partial<WifiDraft>) => onChange(value.map((n) => (n.key === k ? { ...n, ...patch } : n)));
  const move = (i: number, by: number) => {
    const next = [...value];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };

  return (
    <>
      <CardHeader
        title="WiFi"
        description="Optional. The networks the factory's boards use, best first: a board tries them in this order. Leave the password empty for an open network. Skip this for a factory on 4G."
      />
      <div className="space-y-2">
        {value.map((n, i) => (
          <div key={n.key} className="rounded-lg border p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
              <div>
                <Input aria-label="Network name" value={n.ssid} placeholder={`Network ${i + 1} name`} onChange={(e) => set(n.key, { ssid: e.target.value })} />
                {(tried || n.ssid) && problems[i].ssid && <p className="text-xs text-red-600">{problems[i].ssid}</p>}
              </div>
              <div>
                <div className="flex gap-2">
                  <Input
                    aria-label="Password"
                    type={shown[n.key] ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={n.pass}
                    placeholder="Password (empty: open network)"
                    className="font-mono"
                    onChange={(e) => set(n.key, { pass: e.target.value })}
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={() => setShown((s) => ({ ...s, [n.key]: !s[n.key] }))}>
                    {shown[n.key] ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {(tried || n.pass) && problems[i].pass && <p className="text-xs text-red-600">{problems[i].pass}</p>}
              </div>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                <Button type="button" size="sm" variant="ghost" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</Button>
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${n.ssid || 'network'}`} onClick={() => onChange(value.filter((x) => x.key !== n.key))}>✕</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="secondary" className="mt-2" disabled={value.length >= MAX_WIFI} onClick={() => onChange([...value, newWifi()])}>
        + Add network
      </Button>
      <span className="ml-3 text-xs text-muted">Up to {MAX_WIFI}.</span>
    </>
  );
}
