import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/login-form';

export default async function FactoryLoginPage({
  params,
}: {
  params: Promise<{ factoryId: string }>;
}) {
  const { factoryId } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>
      }
    >
      <LoginForm
        title="Factory Sign In"
        subtitle={`Sign in to ${factoryId.replace(/-/g, ' ')}`}
        factoryId={factoryId}
      />
    </Suspense>
  );
}
