'use client';

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Component, Suspense, useSyncExternalStore, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/table';
import { useT } from '@/lib/i18n/context';
import type { Translate } from '@/lib/i18n/translate';

class QueryErrorBoundary extends Component<
  // A class component cannot call useT(): the page's translator comes in as a prop.
  { children: ReactNode; onReset: () => void; t: Translate },
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
      const { t } = this.props;
      return (
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          <ErrorState message={this.state.message || t('Something went wrong')} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              this.props.onReset();
              this.setState({ hasError: false, message: '' });
            }}
          >
            {t('Retry')}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const noopSubscribe = () => () => {};

/**
 * Suspense + error boundary for TanStack Query `useSuspenseQuery` children.
 *
 * Children render only in the browser unless `ssr` is set: the client API uses
 * relative `/api` URLs, which cannot be fetched during server rendering. Pass
 * `ssr` only when the page prefetches the queries into a `HydrationBoundary`.
 */
export function QuerySuspense({
  children,
  fallback,
  ssr = false,
}: {
  children: ReactNode;
  fallback: ReactNode;
  ssr?: boolean;
}) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { t } = useT();
  if (!ssr && !isClient) return <>{fallback}</>;

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <QueryErrorBoundary onReset={reset} t={t}>
          <Suspense fallback={fallback}>{children}</Suspense>
        </QueryErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
