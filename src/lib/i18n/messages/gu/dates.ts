import type { Messages } from '../../translate';

/** Gujarati for one area of the dashboard (see lib/i18n/README.md). Key = the exact English text. */
export const dates: Messages = {
  '{shift} · since {time}': '{shift} · {time} થી',
  '{shift} · {from}–{to}': '{shift} · {from}–{to}',
  // ui/date-range-picker.tsx + date-presets.ts
  'Current Shift': 'ચાલુ શિફ્ટ',
  'Last Shift': 'ગઈ શિફ્ટ',
  'Last 24 Hours': 'છેલ્લા 24 કલાક',
  'Last 3 Days': 'છેલ્લા 3 દિવસ',
  'Last 7 Days': 'છેલ્લા 7 દિવસ',
  'Last 10 Days': 'છેલ્લા 10 દિવસ',
  'Last Month': 'ગયો મહિનો',
  'Last 3 Months': 'છેલ્લા 3 મહિના',
  'Clear line filter': 'લાઇન ફિલ્ટર કાઢો',
  'All lines': 'બધી લાઇનો',
  'Clear filters': 'ફિલ્ટર કાઢો',
  'From time': 'શરૂનો સમય',
  'To time': 'અંતનો સમય',
  'Time-of-day filtering is unavailable for dates older than 3 days — only daily aggregates are stored for that period.': '3 દિવસથી જૂની તારીખો માટે સમય પસંદ કરી શકાતો નથી — તે સમયગાળા માટે ફક્ત દિવસના કુલ આંકડા જ રાખવામાં આવે છે.',
};
