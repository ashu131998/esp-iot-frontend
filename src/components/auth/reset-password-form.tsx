'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { forgotPasswordPathFor, newPasswordProblem, resetLinkMessage, signInPathFor } from '@/lib/auth-reset';
import { postPublic } from '@/lib/csrf';
import { useT } from '@/lib/i18n/context';

type Check =
  | { state: 'checking' }
  | { state: 'bad'; reason: string }
  | { state: 'ok'; username: string; factoryId: string | null };

/**
 * The page a reset email opens. It first asks the server whether the link still works, so an old
 * link gets a plain message instead of a form that fails on Save.
 */
export function ResetPasswordForm({ staffBase = '' }: { staffBase?: string }) {
  const { t } = useT();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  // No token in the URL: nothing to check, the link is simply not one.
  const [check, setCheck] = useState<Check>(() => (token ? { state: 'checking' } : { state: 'bad', reason: 'invalid' }));
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ factoryId: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    postPublic<{ valid: boolean; username?: string; factory_id?: string | null; reason?: string }>(
      '/api/auth/reset-password/check',
      { token },
      '/api/auth/reset-password',
    )
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data.valid) setCheck({ state: 'ok', username: data.username ?? '', factoryId: data.factory_id ?? null });
        else setCheck({ state: 'bad', reason: data.reason ?? 'invalid' });
      })
      .catch(() => {
        if (!cancelled) setCheck({ state: 'bad', reason: 'invalid' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = newPasswordProblem(password, repeat);
    if (problem) {
      setError(t(problem));
      return;
    }
    setError('');
    setSaving(true);
    try {
      const { ok, data } = await postPublic<{ ok?: boolean; factory_id?: string | null; reason?: string }>(
        '/api/auth/reset-password',
        { token, password },
      );
      if (!ok) {
        if (data.reason) setCheck({ state: 'bad', reason: data.reason });
        else setError(data.error ?? t('Could not set the password. Try again.'));
        return;
      }
      setDone({ factoryId: data.factory_id ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not set the password. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  const factoryFromUrl = searchParams.get('factory');
  const factoryForLinks = check.state === 'ok' ? check.factoryId : factoryFromUrl;

  let body: React.ReactNode;
  if (done) {
    body = (
      <div className="mt-6 space-y-3 text-sm" role="status">
        <p className="font-medium text-foreground">{t('Your password is set. Sign in with it now.')}</p>
        <Link href={signInPathFor(done.factoryId, staffBase)} className="inline-block rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">
          {t('Sign in')}
        </Link>
      </div>
    );
  } else if (check.state === 'checking') {
    body = <p className="mt-6 text-center text-sm text-muted" role="status">{t('Checking your link…')}</p>;
  } else if (check.state === 'bad') {
    body = (
      <div className="mt-6 space-y-3 text-sm">
        <p className="text-foreground">{t(resetLinkMessage(check.reason))}</p>
        <div className="flex flex-wrap gap-4">
          <Link href={forgotPasswordPathFor(factoryForLinks, staffBase)} className="text-primary hover:underline">
            {t('Request a new link')}
          </Link>
          <Link href={signInPathFor(factoryForLinks, staffBase)} className="text-primary hover:underline">
            {t('Back to sign in')}
          </Link>
        </div>
      </div>
    );
  } else {
    body = (
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <p className="text-sm text-muted">{t('Setting a new password for {name}.', { name: check.username })}</p>
        <Field label={t('New password')}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
          />
        </Field>
        <Field label={t('Repeat new password')}>
          <Input
            id="repeat"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            required
            minLength={8}
          />
        </Field>
        <p className="text-xs text-muted">{t('At least 8 characters. Every signed-in phone and computer will have to sign in again.')}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? t('Saving…') : t('Set new password')}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <Card className="w-full max-w-md p-6">
        <CardHeader title={t('Set a new password')} />
        {body}
      </Card>
      <LanguageToggle />
    </div>
  );
}
