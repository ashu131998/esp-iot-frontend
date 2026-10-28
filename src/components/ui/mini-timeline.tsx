import { placeSegments, segmentsSpan } from '@/lib/timeline-layout';
import type { UptimeSegment } from '@/lib/types';
import { cn, statusLabel } from '@/lib/utils';

/**
 * Small status strip for tables. Segments sit at their real times across the
 * span they cover (lib/timeline-layout.ts), so time without data shows as an
 * empty stretch instead of the later segments sliding into it.
 */
export function MiniTimeline({ segments, className }: { segments: UptimeSegment[]; className?: string }) {
  const span = segments?.length ? segmentsSpan(segments) : null;
  if (!span) return <span className="text-xs text-muted">No data</span>;

  return (
    <div
      className={cn('relative h-4 w-40 overflow-hidden rounded-sm bg-white ring-1 ring-inset ring-slate-200', className)}
      title="Last 24h · green = running, red = stopped, grey = no signal, empty = no data"
    >
      {placeSegments(segments, span.from, span.to).map(({ segment: seg, index, leftPct, widthPct }) => {
        const hrs = Math.round(seg.duration_seconds / 36) / 100;
        const color =
          seg.status === 'up'
            ? 'bg-emerald-400'
            : seg.status === 'down'
              ? 'bg-red-400'
              : 'bg-gray-300';
        return (
          <div
            key={index}
            className={`absolute top-0 bottom-0 ${color}`}
            style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '1px' }}
            title={`${statusLabel(seg.status)} · ${hrs}h`}
          />
        );
      })}
    </div>
  );
}
