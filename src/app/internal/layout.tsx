import { Suspense } from 'react';

import { InternalShell } from '@/components/layout/internal-shell';
import { AppShellFallback } from '@/components/layout/app-shell';

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <InternalShell>{children}</InternalShell>
    </Suspense>
  );
}
