import type { Messages } from '../../translate';

/** Hindi for one area of the dashboard (see lib/i18n/README.md). Key = the exact English text. */
export const dates: Messages = {
  '{shift} · since {time}': '{shift} · {time} से',
  '{shift} · {from}–{to}': '{shift} · {from}–{to}',
  // ui/date-range-picker.tsx + date-presets.ts
  'Current Shift': 'वर्तमान शिफ्ट',
  'Last Shift': 'पिछली शिफ्ट',
  'Last 24 Hours': 'पिछले 24 घंटे',
  'Last 3 Days': 'पिछले 3 दिन',
  'Last 7 Days': 'पिछले 7 दिन',
  'Last 10 Days': 'पिछले 10 दिन',
  'Last Month': 'पिछला महीना',
  'Last 3 Months': 'पिछले 3 महीने',
  'Clear line filter': 'लाइन फ़िल्टर हटाएँ',
  'All lines': 'सभी लाइनें',
  'Clear filters': 'फ़िल्टर हटाएँ',
  'From time': 'शुरू का समय',
  'To time': 'अंत का समय',
  'Time-of-day filtering is unavailable for dates older than 3 days — only daily aggregates are stored for that period.': '3 दिन से पुरानी तारीखों के लिए समय चुनना उपलब्ध नहीं — उस अवधि के लिए सिर्फ़ दिन के कुल आँकड़े रखे जाते हैं।',
};
