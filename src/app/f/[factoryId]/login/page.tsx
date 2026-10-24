import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/login-form';
import { Card, CardHeader } from '@/components/ui/card';
import { lookupFactory } from '@/lib/server/factory-lookup';

export const dynamic = 'force-dynamic';

function FactoryNotFound({ factoryId }: { factoryId: string }) {
  const marketingUrl = process.env.MARKETING_URL?.trim();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6">
        <CardHeader
          title="Factory not found"
          description={`There is no factory with the ID “${factoryId}”. Check the ID in your welcome email.`}
        />
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {marketingUrl && (
            <a className="text-primary hover:underline" href={`${marketingUrl}/login`}>
              Try another factory ID
            </a>
          )}
          <a
            className="text-primary hover:underline"
            href="mailto:support@floorbeat.in?subject=FloorBeat%20login%20help"
          >
            Contact support
          </a>
        </div>
      </Card>
    </div>
  );
}

export default async function FactoryLoginPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  const factory = await lookupFactory(factoryId);
  if (factory.status === 'missing') return <FactoryNotFound factoryId={factoryId} />;

  const name = factory.status === 'found' ? factory.name : factoryId.replace(/-/g, ' ');
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>
      }
    >
      <LoginForm title="Factory Sign In" subtitle={`Sign in to ${name}`} factoryId={factoryId} />
    </Suspense>
  );
}
