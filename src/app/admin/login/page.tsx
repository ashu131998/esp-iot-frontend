import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/login-form';

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>
      }
    >
      <LoginForm
        title="Platform Admin"
        subtitle="Super administrator sign in"
        isSuperAdmin
      />
    </Suspense>
  );
}
