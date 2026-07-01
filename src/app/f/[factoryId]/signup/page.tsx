'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { fetchWithSignal } from '@/lib/request-signal';

function getCsrf(): string {
  const match = document.cookie.match(/(?:^|;\s*)esp_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

export default function FactorySignupPage() {
  const params = useParams<{ factoryId: string }>();
  const router = useRouter();
  const factoryId = params.factoryId;
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchWithSignal('/api/auth/signup', {
      credentials: 'same-origin',
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      let csrf = getCsrf();
      if (!csrf) {
        const r = await fetchWithSignal('/api/auth/signup', { credentials: 'same-origin' });
        const d = await r.json();
        csrf = d.csrf ?? getCsrf();
      }
      const res = await fetchWithSignal('/api/auth/signup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ username, email: email || undefined, password, factory_id: factoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Signup failed');
      setSuccess('Account created. Await admin approval before signing in.');
      setTimeout(() => router.push(`/f/${factoryId}/login`), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6">
        <CardHeader
          title="Employee Sign Up"
          description={`Request access to ${factoryId.replace(/-/g, ' ')}`}
        />
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Username">
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          </Field>
          <Field label="Email (optional)">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Submitting…' : 'Sign up'}
          </Button>
          <p className="text-center text-sm text-muted">
            Already have an account?{' '}
            <Link href={`/f/${factoryId}/login`} className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
