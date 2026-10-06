'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

interface NavContextValue {
  /** True while a search-param/route navigation is in flight (incl. suspense). */
  isNavigating: boolean;
  /** Push a new URL inside a React transition so the old UI stays visible. */
  navigate: (href: string) => void;
}

const NavContext = createContext<NavContextValue>({
  isNavigating: false,
  navigate: () => {},
});

/**
 * Wraps client navigation in a React transition. While the transition is
 * pending (server round-trip + any suspended data), `isNavigating` is true, so
 * the previously rendered data stays on screen instead of freezing/flashing.
 */
export function RouterTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => {
      const target = href.startsWith('http')
        ? new URL(href).pathname + new URL(href).search
        : href;
      const current = window.location.pathname + window.location.search;
      if (target === current) return;

      // Drive the whole navigation through router.push/replace inside a transition: it
      // updates the URL, refetches the server components for the new params, and
      // keeps the previous data on screen (isNavigating=true) until they resolve.
      //
      // Do NOT also call window.history.pushState to the same URL first: that
      // races router.push and its RSC fetch gets ERR_ABORTED, freezing the page
      // on its loading skeleton (confirmed by browser repro — an abort on the
      // sole RSC request never commits the navigation). router.push manages
      // history itself.
      startTransition(() => {
        const pathnameOnly = target.split('?')[0] ?? target;
        const samePath = pathnameOnly === window.location.pathname;
        const go = samePath ? router.replace.bind(router) : router.push.bind(router);
        go(target, { scroll: false });
      });
    },
    [router],
  );

  return (
    <NavContext.Provider value={{ isNavigating, navigate }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNavigate() {
  return useContext(NavContext).navigate;
}

export function useIsNavigating() {
  return useContext(NavContext).isNavigating;
}

/**
 * Dims its children while a navigation is in flight, keeping the previous data
 * visible (but non-interactive) until the new data is ready.
 */
export function NavDim({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const isNavigating = useIsNavigating();
  return (
    <div
      aria-busy={isNavigating}
      className={cn(
        'transition-opacity duration-200',
        isNavigating && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {children}
    </div>
  );
}
