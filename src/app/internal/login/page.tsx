import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/login-form';

export default function InternalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>
      }
    >
      <LoginForm
        title="Internal ops"
        subtitle="Staff sign in (platform owner, internal admin, or viewer)"
        staffLogin
      />
    </Suspense>
  );
}
