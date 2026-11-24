'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { AlertsApiError, appLogin } from '@/lib/alerts-app/api';
import type { Plant } from '@/lib/alerts-app/types';
import { useT } from '@/lib/i18n/context';

/**
 * Signing in to a FloorBeat phone app (the alerts app, the dashboard app), in steps. First an email and a
 * password, no factory to type: they usually fit one account, which is signed in at once. When they fit
 * accounts at more than one factory, a next step asks which factory, listing those (it comes only once the
 * password is right). `onSignedIn` moves on; the button stays "Signing in…" meanwhile. `choices`: the
 * factories to start the second step with.
 */
export function SignInSteps({
  onSignedIn, forgot, choices: startChoices = null,
}: {
  onSignedIn: () => void;
  /** What someone who forgot their password is told. */
  forgot: string;
  choices?: Plant[] | null;
}) {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [choices, setChoices] = useState<Plant[] | null>(startChoices);
  const [factoryId, setFactoryId] = useState<string | null>(startChoices?.[0]?.factory_id ?? null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    let leaving = false;
    try {
      const result = await appLogin({ email: email.trim(), password, factory_id: choices ? factoryId : null });
      if (result.choose) {
        setChoices(result.choose);
        setFactoryId(result.choose[0]?.factory_id ?? null);
        return;
      }
      leaving = true;
      onSignedIn();
    } catch (err) {
      // The password changed, or was mistyped, between the steps: back to the first.
      if (err instanceof AlertsApiError && err.status === 401) {
        setChoices(null);
        setError(t('Wrong email or password.'));
      } else if (err instanceof AlertsApiError && err.status === 429) setError(t('Too many attempts. Wait a minute and try again.'));
      else if (err instanceof AlertsApiError) setError(err.message);
      else setError(t('Could not sign in. Check your connection and try again.'));
    } finally {
      if (!leaving) setLoading(false);
    }
  }

  // Each step is a form of its own (the keys): were its buttons reused, "Back" would become the first
  // step's "Sign in" while the tap on it is still being handled, and submit it.
  if (choices) {
    return (
      <form key="factory" onSubmit={handleSubmit} className="mt-6 space-y-4">
        <fieldset>
          <legend className="text-base font-semibold text-foreground">{t('Choose your factory')}</legend>
          <p className="mt-1 text-sm text-muted">{t('This email signs in at more than one factory. Which one are you signing in to?')}</p>
          <div className="mt-3 space-y-2">
            {choices.map((plant) => (
              <label
                key={plant.factory_id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm ${factoryId === plant.factory_id ? 'border-primary bg-blue-50/60 ring-1 ring-primary' : 'hover:bg-slate-50'}`}
              >
                <input type="radio" name="factory" value={plant.factory_id} checked={factoryId === plant.factory_id} onChange={() => setFactoryId(plant.factory_id)} className="h-4 w-4" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{plant.name}</span>
                  <span className="block truncate font-mono text-xs text-muted">{plant.factory_id}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button type="submit" className="h-11 w-full text-base" disabled={loading || !factoryId}>
          {loading ? t('Signing in…') : t('Sign in')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full"
          disabled={loading}
          onClick={() => {
            setChoices(null);
            setError('');
          }}
        >
          {t('Back')}
        </Button>
      </form>
    );
  }

  return (
    <form key="account" onSubmit={handleSubmit} className="mt-6 space-y-4">
      <Field label={t('Email')}>
        {/* An email keyboard, but any login is accepted: stage's test logins are usernames. */}
        <Input
          id="email"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
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
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
        {loading ? t('Signing in…') : t('Sign in')}
      </Button>
      <p className="text-xs text-muted">{forgot}</p>
    </form>
  );
}
