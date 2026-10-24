import { useId } from 'react';

import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  // Gradient ids must be unique per instance: a hidden copy (e.g. the mobile top bar)
  // would otherwise take the shared gradient down with it.
  const bg = `fb${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-bg`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9a45" />
          <stop offset="1" stopColor="#f0461c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />
      <path
        d="M25.84 15.09A18 18 0 1 0 38.16 15.09"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        d="M7 32h18l3.5-6 7 12 3.5-6h18"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
