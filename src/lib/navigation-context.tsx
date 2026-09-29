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
      // router.push updates the URL *and* drives the RSC navigation; wrapping it
      // in a transition keeps the previous data on screen (isNavigating=true)
      // until the new data resolves — the no-freeze behaviour we want.
      //
      // Do NOT also call window.history.pushState here: passing null state wipes
      // Next's internal router state (stored in history.state), which
      // intermittently corrupts the next soft navigation — the RSC fetch is
      // aborted/never committed and the page sticks on its loading skeleton
      // until a hard refresh. router.push manages history itself.
      startTransition(() => {
        router.push(href, { scroll: false });
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
