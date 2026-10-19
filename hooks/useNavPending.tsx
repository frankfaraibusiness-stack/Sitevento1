'use client';

// hooks/useNavPending.tsx
//
// Problem: app/loading.tsx (via <AppSkeleton fullScreen />) only mounts
// once Next.js has actually fetched the RSC payload for the next route.
// On slow networks there's a dead gap between the click and that
// payload arriving — nothing on screen changes for however long the
// round-trip takes.
//
// Fix: wrap every in-app router.push in React's startTransition so
// isPending flips to true in the *same tick* as the click — before any
// network request resolves — and drive a loading overlay off that
// isPending flag instead of off the route's own loading.tsx. The
// overlay (NavPendingOverlay) is mounted once, at the root layout, so
// it's already on the page ("pre-ready") rather than something that
// has to be fetched and mounted after the click the way loading.tsx's
// AppSkeleton is.
//
// useNavRouter() is a drop-in replacement for next/navigation's
// useRouter(): same `.push(href)` signature, so every existing call
// site only needs its import swapped, not its calls rewritten.
import { createContext, useContext, useMemo, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface NavPendingContextValue {
  isPending: boolean;
  push: (href: string) => void;
}

const NavPendingContext = createContext<NavPendingContextValue | null>(null);

export function NavPendingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  // isPending flips true synchronously in the same tick as the click
  // that calls startTransition (React guarantees this), and flips back
  // to false once the transition — router.push and the resulting
  // re-render — has committed. No extra state needed on top of it.
  const [isPending, startTransition] = useTransition();

  const push = useMemo(
    () => (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  const value = useMemo(() => ({ isPending, push }), [isPending, push]);

  return <NavPendingContext.Provider value={value}>{children}</NavPendingContext.Provider>;
}

function useNavPendingContext(): NavPendingContextValue {
  const ctx = useContext(NavPendingContext);
  if (!ctx) {
    throw new Error('useNavRouter / useNavPending must be used within <NavPendingProvider>');
  }
  return ctx;
}

// Drop-in replacement for next/navigation's useRouter() at call sites
// that only ever call `.push(...)`. Swap the import and the rest of
// the call site is unchanged.
export function useNavRouter() {
  const { push } = useNavPendingContext();
  return { push };
}

// Read-only access to the pending flag, for the overlay itself.
export function useNavPending(): boolean {
  return useNavPendingContext().isPending;
}
