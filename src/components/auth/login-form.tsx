'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { useAuth } from '@/lib/auth-context';
import { noteRestore, safeNextPath, shouldTryRestore } from '@/lib/auth-redirect';
import { forgotPasswordPathFor } from '@/lib/auth-reset';
import { useT } from '@/lib/i18n/context';

/** sessionStorage, or null where the browser blocks it. */
function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function LoginForm({
  title,
  subtitle,
  factoryId,
  isSuperAdmin = false,
  staffLogin = false,
  logoSrc,
  brand,
}: {
  title: string;
  subtitle?: string;
  factoryId?: string;
  /** The factory's logo (branding), shown above the title. */
  logoSrc?: string | null;
  /** The factory's accent colour as theme variables (lib/branding.ts). */
  brand?: CSSProperties;
  /** @deprecated use staffLogin */
  isSuperAdmin?: boolean;
  staffLogin?: boolean;
}) {
  const platformStaff = staffLogin || isSuperAdmin;
  const { login } = useAuth();
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Only a page inside this app (lib/auth-redirect.ts): never another site.
  const next = safeNextPath(searchParams.get('next'));
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    fetch('/api/auth/login', { credentials: 'same-origin' }).catch(() => {});
  }, []);

  // Already signed in? A link from an email arrives without the SameSite=Strict cookies, and
  // the 15-minute access token may have run out: this same-site call renews the 7-day session
  // if it is still there, and the page that was asked for opens with no password.
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
        window.location.replace(next ?? '/');
        return;
      }
      setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, [next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login({
        username,
        password,
        factory_id: platformStaff ? null : factoryId,
      });
      if (next) {
        router.push(next);
      } else if (
        user.role === 'super_admin' ||
        user.role === 'internal_admin' ||
        user.role === 'internal_viewer'
      ) {
        router.push('/internal');
      } else if (user.factory_id) {
        router.push('/');
      } else {
        router.push('/internal');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4" style={brand}>
      <Card className="w-full max-w-md p-6">
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- small same-origin logo, no optimiser on Workers
          <img src={logoSrc} alt="" height={56} fetchPriority="high" className="mx-auto mb-4 h-14 max-w-[12rem] object-contain" />
        )}
        <CardHeader title={title} description={subtitle} />
        {restoring ? (
          <p className="mt-6 text-center text-sm text-muted" role="status">{t('Signing you in…')}</p>
        ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Factory admins onboarded from /internal/onboard sign in with their email by default. */}
          <Field label={platformStaff ? t('Username') : t('Email or username')}>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
          <div className="-mt-2 flex justify-end">
            <Link
              href={forgotPasswordPathFor(platformStaff ? null : factoryId ?? null)}
              className="text-xs text-primary hover:underline"
            >
              {t('Forgot password?')}
            </Link>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('Signing in…') : t('Sign in')}
          </Button>
        </form>
        )}
      </Card>
      {/* A Hindi speaker switches before signing in; the choice is kept for the dashboard. */}
      <LanguageToggle />
      {/* The privacy policy and terms are on the website, the same for every factory. */}
      <p className="text-xs text-muted">
        <a href="https://floorbeat.in/privacy" className="hover:text-primary hover:underline">{t('Privacy')}</a>
        <span aria-hidden="true"> · </span>
        <a href="https://floorbeat.in/terms" className="hover:text-primary hover:underline">{t('Terms')}</a>
      </p>
    </div>
  );
}
