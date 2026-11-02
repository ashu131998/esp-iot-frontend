'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { signInPathFor } from '@/lib/auth-reset';
import { ensureCsrfToken, postPublic } from '@/lib/csrf';
import { useT } from '@/lib/i18n/context';

/**
 * "Forgot password?": one field, one button. The answer is the same whether or not the account
 * exists (the server never says), so the page explains what to do if no email comes.
 */
export function ForgotPasswordForm({
  title,
  subtitle,
  factoryId,
  staff = false,
  logoSrc,
  brand,
}: {
  title: string;
  subtitle?: string;
  /** The factory whose account it is; staff accounts have none. */
  factoryId?: string;
  staff?: boolean;
  logoSrc?: string | null;
  brand?: CSSProperties;
}) {
  const { t } = useT();
  const [login, setLogin] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void ensureCsrfToken('/api/auth/forgot-password');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const { ok, data } = await postPublic<{ ok?: boolean }>('/api/auth/forgot-password', {
        login: login.trim(),
        factory_id: staff ? null : factoryId ?? null,
      });
      if (!ok) throw new Error(data.error ?? t('Could not send the link. Try again.'));
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not send the link. Try again.'));
    } finally {
      setSending(false);
    }
  }

  const signIn = signInPathFor(staff ? null : factoryId ?? null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4" style={brand}>
      <Card className="w-full max-w-md p-6">
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element -- small same-origin logo, no optimiser on Workers
          <img src={logoSrc} alt="" className="mx-auto mb-4 h-14 max-w-[12rem] object-contain" />
        )}
        <CardHeader title={title} description={subtitle} />
        {sent ? (
          <div className="mt-6 space-y-3 text-sm" role="status">
            <p className="font-medium text-foreground">
              {t('If an account with that email exists, we have sent a link to set a new password. Check your inbox and spam folder.')}
            </p>
            <p className="text-muted">{t('The link works for 30 minutes.')}</p>
            <p className="text-muted">
              {staff
                ? t('No email on your account? Ask the FloorBeat owner to set a new password for you.')
                : t('No email on your account? Ask your factory admin to set a new password for you.')}
            </p>
            <Link href={signIn} className="inline-block text-primary hover:underline">
              {t('Back to sign in')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label={staff ? t('Username or email') : t('Email or username')}>
              <Input
                id="login"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                autoFocus
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={sending || !login.trim()}>
              {sending ? t('Sending…') : t('Send me a link')}
            </Button>
            <p className="text-center text-sm text-muted">
              <Link href={signIn} className="text-primary hover:underline">
                {t('Back to sign in')}
              </Link>
            </p>
          </form>
        )}
      </Card>
      <LanguageToggle />
    </div>
  );
}
