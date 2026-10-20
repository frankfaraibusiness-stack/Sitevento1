'use client';

// components/widgets/designer/useWidgetDesignerAuth.ts
//
// Auth gate for app/widgets/[widgetId]/page.tsx only. Rebuilt from
// scratch — the previous version still asked signed-in visitors to
// sign in on every visit to a widget page.
//
// Why this route needs its own hook instead of reusing hooks/useAuth.ts:
// this page is landed on almost exclusively via a client-side
// router.push from /widgets (WidgetsPageClient.tsx's card click) —
// same tab, same already-initialized Firebase app, no reload. A plain
// useAuth() call still starts completely over on every one of those
// mounts: fresh local state and a fresh onAuthStateChanged
// subscription that doesn't fire synchronously, so there's a brief
// window where authReady can read true with user still null even
// though the visitor was signed in one screen ago. WidgetDesigner
// takes authReady+!user at face value and pops the sign-in overlay —
// that's the "asks for sign in on every visit" report.
//
// Root cause this rewrite fixes: the previous version raced a fixed
// SETTLE_MS timeout against onAuthStateChanged, but seeded the
// timeout's fallback value from auth.currentUser read once when the
// effect first ran — not re-read when the timeout actually fired.
// auth.currentUser is frequently still null at that moment (Firebase
// hasn't finished restoring the persisted session from storage yet);
// on anything slower than the fixed timeout, the timer fired first,
// locked in authReady=true/user=null, and popped the sign-in overlay
// — and then onAuthStateChanged would resolve a moment later with the
// real user, but nothing ever closed the overlay that had already
// opened. A fixed timeout racing an inherently variable restore time
// is the wrong shape for this regardless of the duration picked, so
// this version doesn't use one: it seeds synchronously from
// auth.currentUser same as before (instant for anyone already
// resolved in this tab), and otherwise simply waits for
// onAuthStateChanged's first callback — which Firebase guarantees
// fires exactly once with the settled state, null or a real user —
// before ever treating the visitor as signed out.
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

function currentUserSafe(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    return getFirebaseAuth().currentUser;
  } catch {
    return null;
  }
}

export function useWidgetDesignerAuth() {
  const [user, setUser] = useState<User | null>(currentUserSafe);
  // If we already found a current user synchronously, there's nothing
  // to wait on — start ready immediately instead of flashing a loading
  // state (or, worse, a sign-in prompt) for someone who was already
  // signed in. Otherwise wait for onAuthStateChanged's first callback
  // to actually confirm signed-out before treating it as such.
  const [authReady, setAuthReady] = useState(() => currentUserSafe() !== null);

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
    // genuinely the first load in this tab and the seed ran before
    // Firebase's module-level init finished).
    if (auth.currentUser) {
      setUser(auth.currentUser);
      setAuthReady(true);
    }

    // The only source of truth for "signed out" is onAuthStateChanged
    // actually firing with null — never a timer. Firebase fires this
    // exactly once with the restored session state (possibly null)
    // even if that takes a while on a slow connection/device, and
    // again on every subsequent sign-in/sign-out.
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser: User | null) => {
        setUser(nextUser);
        setAuthReady(true);
      },
      (err: Error) => {
        console.error('onAuthStateChanged error', err);
        setAuthReady(true);
      }
    );

    return unsubscribe;
  }, []);

  return { user, authReady };
}
