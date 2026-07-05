import type { UptimeSegment } from '@/lib/types';

export function MiniTimeline({ segments }: { segments: UptimeSegment[] }) {
  if (!segments || segments.length === 0) {
    return <span className="text-xs text-muted">No data</span>;
  }

  const totalSeconds = segments.reduce((sum, s) => sum + s.duration_seconds, 0);
  if (totalSeconds === 0) return <span className="text-xs text-muted">No data</span>;

  return (
    <div
      className="flex h-4 w-40 overflow-hidden rounded-sm"
      title="Last 24h · green = running, red = stopped, grey = no signal"
    >
      {segments.map((seg, i) => {
        const widthPct = (seg.duration_seconds / totalSeconds) * 100;
        const hrs = Math.round(seg.duration_seconds / 36) / 100;
        const color =
          seg.status === 'up'
            ? 'bg-emerald-400'
            : seg.status === 'down'
              ? 'bg-red-400'
              : 'bg-gray-300';
        const label =
          seg.status === 'up'
            ? 'Running'
            : seg.status === 'down'
              ? 'Stopped'
              : 'No signal';
        return (
          <div
            key={i}
            className={color}
            style={{ width: `${widthPct}%`, minWidth: widthPct > 1 ? undefined : '1px' }}
            title={`${label} · ${hrs}h`}
          />
        );
      })}
    </div>
  );
}
