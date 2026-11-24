'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

interface NavContextValue {
  /** True while a search-param/route navigation is in flight (incl. suspense). */
  isNavigating: boolean;
  /** Push a new URL inside a React transition so the old UI stays visible. */
  navigate: (href: string) => void;
  /**
   * The page being moved to while it is on its way, when it is another page than the one shown (a tab
   * tapped): the shell shows that page's skeleton at once (PageSwap). Null for a change of dates or
   * filters on the same page, whose old numbers stay on screen, dimmed.
   */
  pendingPath: string | null;
}

const NavContext = createContext<NavContextValue>({
  isNavigating: false,
  navigate: () => {},
  pendingPath: null,
});

/**
 * Wraps client navigation in a React transition. While the transition is
 * pending (server round-trip + any suspended data), `isNavigating` is true, so
 * the previously rendered data stays on screen instead of freezing/flashing.
 */
export function RouterTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startTransition] = useTransition();
  // The page asked for and the page it was asked from. It counts only while that move is under way from
  // that same page: arrived (the address changed), or ended without arriving, nothing is on its way.
  const [asked, setAsked] = useState<{ to: string; from: string } | null>(null);
  const pendingPath = asked && isNavigating && asked.from === pathname ? asked.to : null;
  const navigate = useCallback(
    (href: string) => {
      const target = href.startsWith('http')
        ? new URL(href).pathname + new URL(href).search
        : href;
      const current = window.location.pathname + window.location.search;
      if (target === current) return;
      // Another page: said at once (outside the transition), so its skeleton shows on this very frame.
      const targetPath = target.split(/[?#]/)[0] ?? target;
      if (targetPath !== window.location.pathname) setAsked({ to: targetPath, from: window.location.pathname });

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
    <NavContext.Provider value={{ isNavigating, navigate, pendingPath }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNavigate() {
  return useContext(NavContext).navigate;
}

/** The other page being moved to (a tab tapped), until it is here; null otherwise. */
export function usePendingPath(): string | null {
  return useContext(NavContext).pendingPath;
}

/** True inside a shell whose pages PageSwap swaps: a link there goes through navigate() (components/ui/app-link.tsx). */
const SwapScopeContext = createContext(false);

/**
 * Marks a whole shell as swapped by PageSwap, for the links that sit outside the page itself (a bottom
 * bar): PageSwap marks the page it wraps on its own.
 */
export function PageSwapScope({ children }: { children: ReactNode }) {
  return <SwapScopeContext.Provider value={true}>{children}</SwapScopeContext.Provider>;
}

export function useInSwapScope(): boolean {
  return useContext(SwapScopeContext);
}

/**
 * Around a shell's pages: the moment another page is asked for (a tab tapped), `skeleton` takes the
 * place of the page that is leaving, from the top, and stays until the new page is in. A tap is
 * answered on its own frame, whatever the network does. The leaving page stays mounted underneath
 * (hidden), so nothing it was doing is cut short.
 *
 * `ahead`: for a shell whose pages need nothing from the server to draw (the alerts app: each page is
 * one component fed by what the phone already holds), the page itself for the address asked for. It is
 * shown in place of the skeleton, so the tap shows the real page at once and nothing has to be fetched
 * before the tap to make that so.
 */
export function PageSwap({
  skeleton,
  ahead,
  children,
}: {
  skeleton: ReactNode;
  ahead?: (path: string) => ReactNode;
  children: ReactNode;
}) {
  const pendingPath = usePendingPath();
  const pending = pendingPath !== null;
  useLayoutEffect(() => {
    if (!pending) return;
    // The new page starts at its top: the window on phones, the shell's own scrolling column from lg up.
    window.scrollTo(0, 0);
    document.querySelector('[data-page-scroll]')?.scrollTo(0, 0);
  }, [pending]);
  const known = pendingPath !== null && ahead ? ahead(pendingPath) : null;
  return (
    <SwapScopeContext.Provider value={true}>
      <PageSwapView pending={pending} skeleton={skeleton} ahead={known}>{children}</PageSwapView>
    </SwapScopeContext.Provider>
  );
}

/** What PageSwap shows while another page is on its way, over the hidden page: that page itself when it is known ahead, else the skeleton. */
export function PageSwapView({
  pending,
  skeleton,
  ahead = null,
  children,
}: {
  pending: boolean;
  skeleton: ReactNode;
  ahead?: ReactNode;
  children: ReactNode;
}) {
  const known = ahead !== null && ahead !== undefined && ahead !== false;
  return (
    <>
      {pending && (known ? <div data-page-ahead>{ahead}</div> : <div data-page-skeleton aria-busy="true">{skeleton}</div>)}
      <div hidden={pending}>{children}</div>
    </>
  );
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
