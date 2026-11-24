'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AuthProvider } from '@/lib/auth-context';
import type { AuthUser } from '@/lib/auth-types';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import type { Messages } from '@/lib/i18n/translate';
import { RouterTransitionProvider } from '@/lib/navigation-context';

export function Providers({
  locale,
  messages,
  initialUser,
  children,
}: {
  locale: Locale;
  messages: Messages | null;
  /** Who is signed in, when the server could tell while drawing the page (see AuthProvider). */
  initialUser?: AuthUser | null;
  children: React.ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <LocaleProvider locale={locale} messages={messages}>
      <QueryClientProvider client={client}>
        <RouterTransitionProvider>
          <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
        </RouterTransitionProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}
