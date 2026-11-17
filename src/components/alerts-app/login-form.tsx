'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { AlertsApiError, appLogin } from '@/lib/alerts-app/api';
import { useAppHref } from '@/lib/alerts-app/queries';
import type { Plant } from '@/lib/alerts-app/types';
import { useAuth } from '@/lib/auth-context';
import { noteRestore, safeNextPath, shouldTryRestore } from '@/lib/auth-redirect';
import { useT } from '@/lib/i18n/context';

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Signing in to the app: a work email and a password, no factory to type. When the same email
 * and password sign in at several plants, the plants are listed to pick from.
 */
export function AppLoginForm() {
  const { t } = useT();
  const { refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const href = useAppHref();
  const next = safeNextPath(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [choices, setChoices] = useState<Plant[] | null>(null);
  const [factoryId, setFactoryId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    fetch('/api/auth/app-login', { credentials: 'same-origin' }).catch(() => {});
  }, []);

  // A session may still be there (the notification tap came without the strict cookies, or the
  // 15-minute token ran out): renew it and go on without asking for the password.
  useEffect(() => {
    const storage = safeSessionStorage();
    let cancelled = false;
    const renewed = shouldTryRestore(storage)
      ? fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' }).then((res) => res.ok, () => false)
      : Promise.resolve(false);
    renewed.then((ok) => {
      if (cancelled) return;
      if (ok) {
        noteRestore(storage);
        window.location.replace(next ?? href('/'));
        return;
      }
      setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, [next, href]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await appLogin({ email: email.trim(), password, factory_id: factoryId });
      if (result.choose) {
        setChoices(result.choose);
        setFactoryId(result.choose[0]?.factory_id ?? null);
        return;
      }
      await refresh();
      router.replace(next ?? href('/'));
      router.refresh();
    } catch (err) {
      if (err instanceof AlertsApiError && err.status === 401) setError(t('Wrong email or password.'));
      else if (err instanceof AlertsApiError && err.status === 429) setError(t('Too many attempts. Wait a minute and try again.'));
      else if (err instanceof AlertsApiError) setError(err.message);
      else setError(t('Could not sign in. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 py-8">
      <Card className="w-full max-w-md p-6">
        <BrandMark className="mx-auto mb-4 h-14 w-14" />
        <CardHeader title={t('FloorBeat Alerts')} description={t('Sign in with your work email.')} />
        {restoring ? (
          <p className="mt-6 text-center text-sm text-muted" role="status">{t('Signing you in…')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label={t('Email')}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label={t('Password')}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {choices && (
              <fieldset className="rounded-xl border p-3">
                <legend className="px-1 text-sm font-medium text-foreground">{t('Choose your factory')}</legend>
                <p className="mb-2 text-xs text-muted">{t('This email signs in at more than one factory. Which one are you signing in to?')}</p>
                <div className="space-y-1.5">
                  {choices.map((plant) => (
                    <label key={plant.factory_id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input type="radio" name="factory" value={plant.factory_id} checked={factoryId === plant.factory_id} onChange={() => setFactoryId(plant.factory_id)} />
                      <span>{plant.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
              {loading ? t('Signing in…') : t('Sign in')}
            </Button>
            <p className="text-xs text-muted">{t('Forgot your password? Your factory admin can set a new one from the Team page of the dashboard.')}</p>
          </form>
        )}
      </Card>
      <LanguageToggle />
      <p className="text-xs text-muted">
        <a href="https://floorbeat.in/privacy" className="hover:text-primary hover:underline">{t('Privacy')}</a>
        <span aria-hidden="true"> · </span>
        <a href="https://floorbeat.in/terms" className="hover:text-primary hover:underline">{t('Terms')}</a>
      </p>
    </div>
  );
}
