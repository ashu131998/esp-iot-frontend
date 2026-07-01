'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';

export function LoginForm({
  title,
  subtitle,
  factoryId,
  isSuperAdmin = false,
}: {
  title: string;
  subtitle?: string;
  factoryId?: string;
  isSuperAdmin?: boolean;
}) {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/login', { credentials: 'same-origin' }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login({
        username,
        password,
        factory_id: isSuperAdmin ? null : factoryId,
      });
      const next = searchParams.get('next');
      if (next) {
        router.push(next);
      } else if (user.role === 'super_admin') {
        router.push('/admin');
      } else if (user.factory_id) {
        router.push(`/factories/${user.factory_id}`);
      } else {
        router.push('/overview');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6">
        <CardHeader title={title} description={subtitle} />
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Username">
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
      </Card>
    </div>
  );
}
