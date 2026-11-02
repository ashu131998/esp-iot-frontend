'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { Locale } from './locale';
import { englishTranslator, makeTranslator, type Messages, type Translator } from './translate';

interface LocaleContextValue {
  locale: Locale;
  messages: Messages | null;
}

const LocaleContext = createContext<LocaleContextValue>({ locale: 'en', messages: null });

/**
 * The language the root layout chose (from the cookie) and, for Hindi, its messages. Client
 * components read them with useT(). English needs no messages: the code is the English text.
 */
export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages | null;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/**
 * `t('Running')`, `t('{count} machines', { count })`, `tn(n, '{count} loom', '{count} looms')`.
 * The English text in the code is the key; see lib/i18n/README.md.
 */
export function useT(): Translator {
  const { locale, messages } = useContext(LocaleContext);
  return useMemo(
    () => (locale === 'en' ? englishTranslator : makeTranslator(messages, locale)),
    [locale, messages],
  );
}
