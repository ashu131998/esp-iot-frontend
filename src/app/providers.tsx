'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AuthProvider } from '@/lib/auth-context';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import type { Messages } from '@/lib/i18n/translate';
import { RouterTransitionProvider } from '@/lib/navigation-context';

export function Providers({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages | null;
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
          <AuthProvider>{children}</AuthProvider>
        </RouterTransitionProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}
