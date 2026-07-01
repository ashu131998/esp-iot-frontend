import { Suspense } from 'react';

import { AppShell, AppShellFallback } from '@/components/layout/app-shell';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
