'use client';

import { NumberTile, NumberTiles, type Tone } from '@/components/ui/simple';
import { formatInt } from '@/lib/format';
import { useT } from '@/lib/i18n/context';
import { humanMinutes } from '@/lib/plain-words';
import { formatPct, type StopFollowUp } from '@/lib/results';

function actedTone(pct: number | null): Tone | undefined {
  if (pct == null) return undefined;
  if (pct >= 80) return 'good';
  if (pct >= 50) return 'warn';
  return 'bad';
}

/**
 * How stop alerts were followed up: how many someone acted on (gave the reason or confirmed the
 * fix), how fast a reason came, and how fast looms ran again (the sensor's word).
 */
export function StopFollowUpTiles({ data }: { data: StopFollowUp }) {
  const { t, tn, locale } = useT();
  const alerts = data.alerts ?? 0;
  return (
    <NumberTiles>
      <NumberTile
        label={t('Stop alerts acted on')}
        value={alerts > 0 ? t('{done} of {total}', { done: data.alerts_acted_on ?? 0, total: alerts }) : '—'}
        hint={alerts > 0
          ? t('{pct} · reason given or fix confirmed', { pct: formatPct(data.alerts_acted_on_pct, locale) })
          : t('No stop alert has reached a phone yet')}
        tone={alerts > 0 ? actedTone(data.alerts_acted_on_pct) : undefined}
      />
      <NumberTile
        label={t('Reason given')}
        value={formatPct(data.explained_pct, locale)}
        hint={data.median_minutes_to_reason != null
          ? t('within {duration} (median)', { duration: humanMinutes(data.median_minutes_to_reason, t) })
          : tn(data.stops, '{count} stop', '{count} stops')}
      />
      <NumberTile
        label={t('Running again in')}
        value={data.median_minutes_to_running != null ? humanMinutes(data.median_minutes_to_running, t) : '—'}
        hint={t('median, measured by the sensor')}
      />
      <NumberTile
        label={t('Confirmed fixed')}
        value={formatInt(data.fixed_confirmed, locale)}
        hint={data.still_stopped > 0
          ? t('{count} still stopped', { count: data.still_stopped })
          : t('none still stopped')}
        tone={data.still_stopped > 0 ? 'warn' : undefined}
      />
    </NumberTiles>
  );
}
