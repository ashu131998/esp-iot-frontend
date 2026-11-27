'use client';

import { ImsQueueBar } from '@/components/ims-app/queue-bar';
import { ImsQueueProvider } from '@/components/ims-app/queue-context';

/**
 * The phone's waiting IMS scans and photos for a factory with the Stock tab: kept sending on EVERY page of the
 * dashboard, not only while Stock is open (Code Reviewer, 2026-11-27), as the IMS app's own frame does, and the
 * "waiting to send" bar above every page while anything waits. Nothing is sent and nothing shows when nothing
 * waits. A factory without IMS gets neither.
 */
export function ImsFactoryQueue({ factoryId, on, children }: { factoryId: string; on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <ImsQueueProvider factoryId={factoryId}>
      <div className="mx-auto max-w-lg px-4 pt-3 empty:hidden print:hidden">
        <ImsQueueBar />
      </div>
      {children}
    </ImsQueueProvider>
  );
}
