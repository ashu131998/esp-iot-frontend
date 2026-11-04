import { FactoryMobileNav } from '@/components/layout/factory-mobile-nav';
import { PageHeader } from '@/components/layout/page-header';
import { SubscriptionBar } from '@/components/layout/subscription-bar';
import { FactorySidebar } from '@/components/layout/factory-sidebar';
import { brandStyle, logoUrl, type FactoryBranding } from '@/lib/branding';
import { FactoryRefsProvider, type FactoryRefs } from '@/lib/factory-refs-context';
import { RefreshProvider } from '@/lib/refresh-context';
import type { SubscriptionStatus } from '@/lib/subscriptions';
import type { Shift } from '@/lib/types';

/** Isolated shell for a single factory — no platform nav, no other factories. */
export function FactoryShell({
  factoryId,
  factoryName,
  location,
  shifts,
  tabs,
  branding,
  description,
  refs,
  subscription,
  children,
}: {
  factoryId: string;
  factoryName: string;
  location?: string | null;
  shifts: Shift[];
  tabs: Array<{ slug: string; label: string; href: string }>;
  /** Accent colour and logo our staff set for this factory. */
  branding?: FactoryBranding;
  description?: string;
  refs: FactoryRefs;
  /** Where the factory's subscription stands: the bar above every page (subscription-bar.tsx). */
  subscription?: SubscriptionStatus | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex lg:h-screen lg:overflow-hidden print:block print:h-auto print:overflow-visible" style={brandStyle(branding)} data-sheet-root>
      <aside className="hidden h-screen w-64 shrink-0 lg:block print:hidden">
        <FactorySidebar
          factoryId={factoryId}
          factoryName={factoryName}
          logoSrc={logoUrl(factoryId, branding)}
          location={location}
          shifts={shifts}
          tabs={tabs}
        />
      </aside>
      <main className="flex min-h-screen min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-none lg:[scrollbar-gutter:stable] print:block print:overflow-visible">
        <FactoryMobileNav
          factoryId={factoryId}
          factoryName={factoryName}
          logoSrc={logoUrl(factoryId, branding)}
          location={location}
          shifts={shifts}
          tabs={tabs}
        />
        <div className="hidden lg:block print:block">
          <PageHeader title={factoryName} description={description} />
        </div>
        <SubscriptionBar status={subscription} />
        {/* Phones: room under the content for the bottom bar. */}
        <div className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0">
          <FactoryRefsProvider value={refs}>
            <RefreshProvider>{children}</RefreshProvider>
          </FactoryRefsProvider>
        </div>
      </main>
    </div>
  );
}
