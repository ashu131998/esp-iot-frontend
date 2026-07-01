'use client';

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Component, Suspense, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/table';

class QueryErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          <ErrorState message={this.state.message || 'Something went wrong'} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              this.props.onReset();
              this.setState({ hasError: false, message: '' });
            }}
          >
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Suspense + error boundary for TanStack Query `useSuspenseQuery` children. */
export function QuerySuspense({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <QueryErrorBoundary onReset={reset}>
          <Suspense fallback={fallback}>{children}</Suspense>
        </QueryErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
