'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { signInDetailsText, type SetupRequest, type SetupResponse } from '@/lib/onboarding';

export type OnboardResult = SetupResponse & { request: SetupRequest };

/** After "Create": the welcome emails, what was set up, and what is left to do. */
export function OnboardDone({ result, onAnother }: { result: OnboardResult; onAnother: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const { factory, emails, dashboard_url: dashboardUrl, request, workers } = result;
  const appUrl = dashboardUrl.replace(/\/f\/[^/]+$/, '');
  const failed = emails.filter((e) => !e.sent);
  const loginTrouble = workers.filter((w) => w.app_login.startsWith('failed') || w.app_login === 'not available on this server');

  const copy = async (email: string) => {
    const a = request.admins.find((x) => x.email === email);
    if (!a) return;
    try {
      await navigator.clipboard.writeText(signInDetailsText(factory.factory_id, a, appUrl));
      setCopied(email);
    } catch {
      setCopied(null);
    }
  };

  const made = [
    result.lines > 0 && `${result.lines} line${result.lines === 1 ? '' : 's'}`,
    result.machines > 0 && `${result.machines} machine${result.machines === 1 ? '' : 's'}`,
    result.wifi > 0 && `${result.wifi} WiFi network${result.wifi === 1 ? '' : 's'}`,
    workers.length > 0 && `${workers.length} worker${workers.length === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-6">
        <CardHeader
          title={`${factory.name} is set up`}
          description={failed.length === 0
            ? `Welcome email sent to ${emails.length === 1 ? 'the admin' : `all ${emails.length} admins`}.${made.length > 0 ? ` Also created: ${made.join(', ')}.` : ''}`
            : `${failed.length} of ${emails.length} welcome emails did not go: copy those sign-in details and send them yourself.`}
        />
        <ul className="divide-y rounded-lg border text-sm">
          {emails.map((e) => (
            <li key={e.email} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">{e.email}</div>
                {e.username.toLowerCase() !== e.email.toLowerCase() && <div className="text-xs text-muted">username {e.username}</div>}
                {!e.sent && <div className="text-xs text-red-600">Not sent: {e.error}</div>}
              </div>
              {e.sent
                ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Email sent</span>
                : (
                  <Button type="button" size="sm" variant="secondary" onClick={() => copy(e.email)}>
                    {copied === e.email ? 'Copied' : 'Copy sign-in details'}
                  </Button>
                )}
            </li>
          ))}
        </ul>

        {loginTrouble.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-medium">Alert app logins not made</div>
            <ul className="mt-1 list-disc pl-5">
              {loginTrouble.map((w) => <li key={w.worker_id}>{w.name}: {w.app_login}</li>)}
            </ul>
            <div className="mt-1 text-xs">The workers themselves were added; their app logins can be made later on the Scheduling page.</div>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">The form and its passwords are cleared from this device.</p>

        <h4 className="mt-6 text-sm font-semibold">Next steps</h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Link href="/internal/boards" className="rounded-lg border p-3 text-sm hover:bg-slate-50">
            <div className="font-medium">Claim its boards</div>
            <div className="text-xs text-muted">Then map their channels to machines</div>
          </Link>
          <Link href={`/internal/factories/${encodeURIComponent(factory.factory_id)}`} className="rounded-lg border p-3 text-sm hover:bg-slate-50">
            <div className="font-medium">Factory setup</div>
            <div className="text-xs text-muted">Lines, machines, WiFi, subscription</div>
          </Link>
          <a href={dashboardUrl} target="_blank" rel="noreferrer" className="rounded-lg border p-3 text-sm hover:bg-slate-50">
            <div className="font-medium">Open their dashboard ↗</div>
            <div className="truncate font-mono text-xs text-muted">{dashboardUrl.replace(/^https?:\/\//, '')}</div>
          </a>
        </div>

        <div className="mt-6 border-t pt-4">
          <Button type="button" variant="secondary" onClick={onAnother}>Set up another factory</Button>
        </div>
      </Card>
    </div>
  );
}
