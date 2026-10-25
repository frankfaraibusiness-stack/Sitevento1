'use client';

// hooks/useOnboardingStatus.ts
//
// Gates the post-signup onboarding flow (components/onboarding/OnboardingFlow.tsx).
// Mirrors the read-live/write-through-the-server pattern every other
// account field in this app uses (see hooks/useUserProfile.ts,
// hooks/useUserSettings.ts): a live onSnapshot on users/{uid} for the
// read, and app/api/user-action's 'accept-terms' action for the one
// write this hook ever makes.
//
// `required` is true until users/{uid}.termsAcceptedAt exists —
// including for a brand-new account, whose users/{uid} doc may not
// have been created yet by the time this subscribes (create-account's
// profile seed and signUp's custom-token exchange are both async). It
// flips to true immediately once accept() resolves, so the overlay can
// close itself at once, before the next onSnapshot tick even arrives.
//
// Mounted once per signed-in session wherever OnboardingFlow is
// mounted (components/dashboard/DashboardClient.tsx and
// components/AppRoot.tsx) — not globally — so a signed-out visitor
// never subscribes to anything.
import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
import { callUserAction } from '@/lib/userActionClient';

export function useOnboardingStatus(user: User | null) {
  // undefined = not yet known (don't flash the overlay while the first
  // snapshot is still in flight); true/false once it resolves.
  const [termsAccepted, setTermsAccepted] = useState<boolean | undefined>(undefined);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!user) {
      setTermsAccepted(undefined);
      return;
    }
    const db = getFirebaseDb();
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.data();
        setTermsAccepted(!!data?.termsAcceptedAt);
      },
      (err) => {
        console.error('onboarding status snapshot error', err);
        // Fail closed-ish but non-blocking: if the read itself is
        // broken, don't trap a real user behind an overlay they can
        // never clear — treat as already accepted rather than stuck.
        setTermsAccepted(true);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const acceptTerms = useCallback(async () => {
    if (!user) return false;
    setAccepting(true);
    const result = await callUserAction(user, 'accept-terms', {});
    setAccepting(false);
    if (result.ok) setTermsAccepted(true);
    return result.ok;
  }, [user]);

  return {
    // true only once we positively know the flag is missing — never
    // true while still loading, so the dashboard never flashes the
    // onboarding overlay for an already-onboarded user.
    onboardingRequired: termsAccepted === false,
    onboardingStatusLoaded: termsAccepted !== undefined,
    accepting,
    acceptTerms,
  };
}
