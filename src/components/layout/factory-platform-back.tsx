'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { staffHomePath } from '@/lib/internal-auth';

/** Mobile header link back to staff hub or this factory’s overview. */
export function FactoryPlatformBack({ factoryId }: { factoryId: string }) {
  const { isInternalStaff } = useAuth();
  const href = isInternalStaff ? staffHomePath() : `/factories/${factoryId}`;
  const label = isInternalStaff ? 'Back to Internal' : 'Factory home';

  return (
    <Link href={href} className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
