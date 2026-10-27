'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { noteRestore, safeNextPath, shouldTryRestore } from '@/lib/auth-redirect';

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
        router.push(`/factories/${user.factory_id}`);
      } else {
        router.push('/internal');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" style={brand}>
      <Card className="w-full max-w-md p-6">
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- small same-origin logo, no optimiser on Workers
          <img src={logoSrc} alt="" className="mx-auto mb-4 h-14 max-w-[12rem] object-contain" />
        )}
        <CardHeader title={title} description={subtitle} />
        {restoring ? (
          <p className="mt-6 text-center text-sm text-muted" role="status">Signing you in…</p>
        ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Factory admins onboarded from /internal/onboard sign in with their email by default. */}
          <Field label={platformStaff ? 'Username' : 'Email or username'}>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        )}
      </Card>
    </div>
  );
}
