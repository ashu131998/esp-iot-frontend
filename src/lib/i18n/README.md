# Languages (English, Hindi, Gujarati)

The factory dashboard shows in English, Hindi or Gujarati. The staff console (`/internal`,
`components/internal`, `components/admin`) stays English.

## How it works

- The **English text in the code is the key**. `t('Running')` returns `चल रही है` in Hindi, `ચાલુ છે` in
  Gujarati and `Running` in English (a key without a translation shows its English text, never a blank or
  a code).
- The choice lives in the `fb_lang` cookie (a year). The root layout reads it, sets `<html lang>` and
  gives client components that language's messages through `LocaleProvider` (English ships none). First
  visit: the browser's language (a phone in Hindi or Gujarati opens in it). The switch is `components/ui/language-toggle.tsx`
  (sidebar footer, phone menu, sign-in pages).
- Numbers are written the Indian way in every language (`12,34,567`; compact `1.2L` / `1.2 लाख` /
  `1.2 લાખ`), with Latin digits. Dates and times are the factory's clock (IST), 12-hour; Hindi and Gujarati
  get their own month names. See `lib/format.ts`.

## Writing a string

Client component:

```tsx
import { useT } from '@/lib/i18n/context';

const { t, tn } = useT();
<h2>{t('Total Units Produced')}</h2>
<p>{t('From {count} sensors', { count: sensors.length })}</p>
<p>{tn(stopped, '{count} machine stopped', '{count} machines stopped')}</p>
```

Server component or page: `const { t } = await getT();` from `@/lib/i18n/server`.

Numbers and dates in a client component: `const f = useFormat();` then `f.int(n)`, `f.decimal(n, 1)`,
`f.dateTime(iso)`, `f.time(iso)`, `f.dayMonth(key)`. Pure helpers take the locale as the last argument.

Rules:

- Keys are plain string literals (`'…'` or `"…"`), never template strings or variables, so the coverage
  test can find them. Build sentences with `{placeholders}`, never by joining translated fragments.
- Numbers given to `t()` as numbers are grouped the Indian way; pass a string to keep one as it is.
- Do not translate: factory, line, machine and sensor names, device IDs, units (`kWh`, `A`, `V`, `m`),
  emails, URLs, console output. Shift names from the backend go through `t()` (the defaults
  `Day Shift` / `Night Shift` are translated; a custom name shows as typed).
- Pure lib functions that produce visible words either return the English (translated at the render
  site with `t()`) or take an optional translator argument (`humanMinutes(min, t)`).

## Adding a translation

`lib/i18n/messages/hi/*.ts` and `lib/i18n/messages/gu/*.ts`, one file per area, `English: 'हिन्दी'` /
`English: 'ગુજરાતી'`. `src/lib/__tests__/i18n-coverage.test.ts` scans the factory-facing code for
`t('…')` / `tn(…)` keys and fails when one has no Hindi or no Gujarati, when the two languages do not
have exactly the same keys, or when a translation drops a `{placeholder}`, so a string is never shipped
half-translated by accident. Duplicate keys across files must agree.

The Gujarati files mirror the Hindi ones file for file and key for key. Both were written by machine
translation and should be read by a native speaker from a mill before they are relied on.
