/**
 * Signing in to the phone apps, rendered (server render): first an email and a password; only when
 * they fit accounts at more than one factory, a next step with those factories to pick from. The
 * FloorBeat app's own sign-in page around it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ refresh: () => {} }) }));

const { SignInSteps } = await import('@/components/auth/sign-in-steps');
const { DashboardLoginForm } = await import('@/components/dashboard-app/login-form');
const { DashboardAppMark } = await import('@/components/dashboard-app/app-mark');

function render(node: ReactNode, messages: Record<string, string> | null = null) {
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>{node}</LocaleProvider>
    </QueryClientProvider>,
  ).replace(/<!-- -->/g, '');
}
const PLANTS = [{ factory_id: 'shree-mills', name: 'Shree Mills' }, { factory_id: 'shree-dyeing', name: 'Shree Dyeing' }];

describe('the first step', () => {
  it('an email and a password, no factory', () => {
    const html = render(<SignInSteps onSignedIn={() => {}} forgot="Ask your admin." />);
    expect(html).toContain('Email');
    expect(html).toContain('Password');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('Sign in');
    expect(html).toContain('Ask your admin.');
    expect(html).not.toContain('Choose your factory');
    expect(html.toLowerCase()).not.toContain('factory id');
  });
});

describe('the next step, when the email and password fit more than one factory', () => {
  it('those factories by name and ID, the first picked, and a way back', () => {
    const html = render(<SignInSteps onSignedIn={() => {}} forgot="Ask your admin." choices={PLANTS} />);
    expect(html).toContain('Choose your factory');
    expect(html).toContain('This email signs in at more than one factory. Which one are you signing in to?');
    expect(html).toContain('Shree Mills');
    expect(html).toContain('shree-mills');
    expect(html).toContain('Shree Dyeing');
    const picked = (id: string) => new RegExp(`<input[^>]*(checked=""[^>]*value="${id}"|value="${id}"[^>]*checked="")`).test(html);
    expect(picked('shree-mills')).toBe(true);
    expect(picked('shree-dyeing')).toBe(false);
    expect(html).toContain('Back');
    expect(html).not.toContain('type="password"');   // the first step's fields are not asked again
  });

  it('in Hindi', () => {
    const html = render(<SignInSteps onSignedIn={() => {}} forgot="x" choices={PLANTS} />, hi);
    expect(html).toContain('अपनी फ़ैक्टरी चुनें');
    expect(html).toContain('वापस');
  });
});

describe('the FloorBeat app\'s sign-in page', () => {
  it('its own mark and name; a session is renewed first', () => {
    const html = render(<DashboardLoginForm />);
    expect(html).toContain('FloorBeat');
    expect(html).toContain('Your factory&#x27;s alerts, dashboard and stock. Sign in with your work email.');
    expect(html).toContain('Signing you in…');   // the renewal runs first; the form shows once it fails
    expect(html).toContain('#0f172a');            // the dashboard app's dark mark, not the alerts app's orange one
    expect(html).toContain('floorbeat.in/privacy');
    expect(render(<DashboardLoginForm />, hi)).toContain('आपकी फ़ैक्टरी के अलर्ट, डैशबोर्ड और माल। अपने काम के ईमेल से साइन इन करें।');
  });

  it('the mark: the brand\'s ring in white, its pulse in orange, on dark blue', () => {
    const html = renderToString(<DashboardAppMark className="h-8 w-8" />);
    expect(html).toContain('fill="#0f172a"');
    expect(html).toContain('stroke="#f5561e"');
    expect(html).toContain('h-8 w-8');
  });
});
