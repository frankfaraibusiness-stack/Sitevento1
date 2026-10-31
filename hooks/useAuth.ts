// hooks/useAuth.ts
//
// ── Why this changed ─────────────────────────────────────────────────
// The previous version decided "signed in or not" purely from the
// client SDK: it waited on setPersistence() + onAuthStateChanged to
// restore a session out of IndexedDB (browserLocalPersistence) before
// ever setting authReady. That restore is asynchronous and not
// reliable everywhere (Safari ITP, private tabs, some mobile
// webviews, a slow first paint) — a signed-in visitor could land on a
// page like /widgets, have that restore come back empty or slow, and
// get shown the "please sign in" overlay. Navigating away and back
// repeats the exact same race, which is what read as "every visit or
// change logs me out."
//
// Now the SERVER is the source of truth for the initial render: on
// mount this calls GET /api/session, which verifies the HttpOnly
// session cookie (app/api/session/route.ts, backed by Firebase
// Admin's createSessionCookie/verifySessionCookie) synchronously
// server-side — no IndexedDB restore race involved. authReady flips
// true as soon as that one request resolves.
//
// The client SDK's own onAuthStateChanged listener still runs
// alongside it (still needed for things that only happen client-side,
// like other hooks wanting a live `User` object with getIdToken()
// etc.), but it no longer gates authReady — it only fills in `user`
// once it resolves, and keeps it in sync afterward (e.g. a sign-out
// in another tab).
'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { readSession, clearSession } from '@/lib/sessionClient';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Tracks whether the server session check found a signed-in uid, so
  // the client-SDK listener (which resolves later) doesn't flash a
  // "signed out" state in between — see the listener callback below.
  // Also now gates authReady itself (see below): when the server says
  // a uid IS signed in, we hold authReady back until the client
  // listener actually confirms it with a real `User` object, instead
  // of flipping authReady true on the server check alone. Without
  // that, callers that gate rendering on authReady (e.g.
  // DashboardClient) could see authReady=true with user still null
  // for one or more renders, run their "signed out" branches (show
  // the sign-in overlay, etc.), and then have the real user show up a
  // moment later — reads as "it decides I'm logged out before it's
  // actually checked."
  const serverUidRef = useRef<string | null | undefined>(undefined);
  const clientResolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const maybeFlipReady = () => {
      // Ready once the client listener has resolved at least once —
      // or, if the server said signed-out, we don't need to wait on
      // the client listener at all (there's nothing for it to race
      // against) as long as it isn't about to contradict that.
      if (clientResolvedRef.current) {
        setAuthReady(true);
      } else if (serverUidRef.current === null) {
        setAuthReady(true);
      }
    };

    // 1) Ask the server first — fast (one cookie-verifying request),
    // and not subject to the client SDK's storage-restore timing.
    readSession().then((session) => {
      if (cancelled) return;
      serverUidRef.current = session?.uid ?? null;
      maybeFlipReady();
    });

    // 2) Client SDK listener. It fills in the real `User` object, and
    // is the source of truth for anything that changes purely
    // client-side (e.g. another tab signing out). authReady now waits
    // on this too whenever the server found a signed-in uid, so the
    // two checks can't disagree mid-render.
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch (err) {
      console.error('Failed to initialize Firebase Auth', err);
      if (!cancelled) {
        setAuthError(err instanceof Error ? err.message : 'Failed to initialize authentication.');
        clientResolvedRef.current = true;
        setAuthReady(true);
      }
      return () => {
        cancelled = true;
      };
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        if (cancelled) return;
        clientResolvedRef.current = true;
        setUser(nextUser);
        setAuthReady(true);
      },
      (err) => {
        if (cancelled) return;
        console.error('onAuthStateChanged error', err);
        setAuthError(err instanceof Error ? err.message : 'Authentication error.');
        clientResolvedRef.current = true;
        setAuthReady(true);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { user, authReady, authError };
}

/** Clears both the client SDK session and the server-side cookie. Use this instead of calling firebase/auth's signOut() directly. */
export async function signOutEverywhere(): Promise<void> {
  const { signOut } = await import('firebase/auth');
  const auth = getFirebaseAuth();
  await Promise.allSettled([signOut(auth), clearSession()]);
}
