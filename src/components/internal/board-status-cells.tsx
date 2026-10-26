import { Badge } from '@/components/ui/badge';
import type { StatusCell, Tone } from '@/lib/board-status';

const TONE_BADGE: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
};
const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  bad: 'text-red-700',
  neutral: 'text-muted',
};

export function StatusBadge({ cell }: { cell: StatusCell }) {
  return (
    <span title={cell.detail}>
      <Badge className={TONE_BADGE[cell.tone]}>{cell.label}</Badge>
    </span>
  );
}

export function StatusText({ cell }: { cell: StatusCell }) {
  return (
    <span className={`text-xs ${TONE_TEXT[cell.tone]}`} title={cell.detail}>
      {cell.label}
    </span>
  );
}
