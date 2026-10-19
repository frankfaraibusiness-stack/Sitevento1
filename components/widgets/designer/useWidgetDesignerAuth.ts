'use client';

// components/widgets/designer/useWidgetDesignerAuth.ts
//
// Rebuilt auth gate for app/widgets/[widgetId]/page.tsx only.
//
// Why this exists instead of reusing hooks/useAuth.ts here: this route
// is landed on almost exclusively via a client-side router.push from
// /widgets (components/widgets/WidgetsPageClient.tsx's card click) —
// same tab, same already-initialized Firebase app, no reload. A plain
// useAuth() call still starts completely over on every one of those
// mounts: new local user/authReady state, a fresh setPersistence()
// call, and a fresh onAuthStateChanged subscription that doesn't fire
// synchronously. Depending on how that first callback lands relative
// to the click, authReady could flip true with user still null for a
// moment — and WidgetDesigner would take that at face value and pop
// the sign-in overlay, even though the visitor was signed in one
// screen ago. That's the "logs me out every time I open a widget"
// report.
//
// Fix, specific to this route: seed state synchronously from
// auth.currentUser (Firebase keeps this populated in memory the moment
// a session exists, no async wait needed once the app's been used once
// in this tab) instead of starting from null, and only ever treat the
// visitor as signed-out once BOTH an onAuthStateChanged callback has
// actually fired AND a short settle window has passed — so a slow
// first callback can't momentarily masquerade as "confirmed logged
// out."
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

// How long to give onAuthStateChanged to deliver its first callback
// before trusting a null user. Generous on purpose — this only delays
// the sign-in overlay for a genuinely signed-out visitor by a few
// hundred ms; it does not block rendering the rest of the page.
const SETTLE_MS = 600;

export function useWidgetDesignerAuth() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return getFirebaseAuth().currentUser;
    } catch {
      return null;
    }
  });
  // If we already found a current user synchronously, there's nothing
  // to wait on — start ready immediately instead of flashing a loading
  // state for someone who was already signed in.
  const [authReady, setAuthReady] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return getFirebaseAuth().currentUser !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch (err) {
      console.error('Failed to initialize Firebase Auth', err);
      setAuthReady(true);
      return;
    }

    // Covers the case the synchronous seed above missed (e.g. this is
    // genuinely the first load in this tab and persistence is still
    // being restored from storage).
    if (auth.currentUser) {
      setUser(auth.currentUser);
      setAuthReady(true);
    }

    let settled = false;
    let latestUser = auth.currentUser;
    const settleTimer = window.setTimeout(() => {
      settled = true;
      setUser(latestUser);
      setAuthReady(true);
    }, SETTLE_MS);

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser: User | null) => {
        latestUser = nextUser;
        setUser(nextUser);
        setAuthReady(true);
        if (!settled) {
          settled = true;
          window.clearTimeout(settleTimer);
        }
      },
      (err: Error) => {
        console.error('onAuthStateChanged error', err);
        setAuthReady(true);
      }
    );

    return () => {
      window.clearTimeout(settleTimer);
      unsubscribe();
    };
  }, []);

  return { user, authReady };
}
