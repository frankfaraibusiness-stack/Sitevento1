// hooks/useAuth.ts
//
// Replaces the original's module-level `let currentUser` + a single
// top-level onAuthStateChanged call. Same behavior — explicit local
// persistence, authReady gate so we never flash the signed-out view for
// a session that's still loading from storage — but as proper React
// state any component can subscribe to via useAuth().
'use client';

import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // getFirebaseAuth() throws if the app is misconfigured (missing
    // NEXT_PUBLIC_FIREBASE_* env vars in this deployment). An uncaught
    // throw inside useEffect propagates up and crashes the whole React
    // tree (the "Application error: a client-side exception has
    // occurred" blank-page screen) instead of just failing sign-in — so
    // it's caught here and surfaced as state instead.
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch (err) {
      console.error('Failed to initialize Firebase Auth', err);
      setAuthError(err instanceof Error ? err.message : 'Failed to initialize authentication.');
      setAuthReady(true);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    // setPersistence() can itself tear down and re-create the auth
    // instance's internal state. Attaching onAuthStateChanged before it
    // resolves means the *first* callback can fire with a stale/null
    // user while the real persisted session is still loading — and
    // since authReady latches on that first callback, an already
    // signed-in visitor would briefly (or on some loads, permanently
    // for that page view) see themselves as signed out, prompting a
    // "please sign in" screen even though their session is fine. Wait
    // for persistence to settle first, then subscribe.
    setPersistence(auth, browserLocalPersistence)
      .catch((err) => {
        console.error('Failed to set auth persistence', err);
      })
      .finally(() => {
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(
          auth,
          (nextUser) => {
            setUser(nextUser);
            setAuthReady(true);
          },
          (err) => {
            console.error('onAuthStateChanged error', err);
            setAuthError(err instanceof Error ? err.message : 'Authentication error.');
            setAuthReady(true);
          }
        );
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { user, authReady, authError };
}
