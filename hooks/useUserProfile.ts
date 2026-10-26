// hooks/useUserProfile.ts
//
// Profile-page data: the user's plan tier, stored at users/{uid}.plan —
// same account document useSites' sites subcollection hangs off of —
// and a setter for display name.
//
// Reads stay a live client-side onSnapshot (read-only, never blocked by
// firestore.rules' owner-only rule). Writes (setPlan, updateDisplayName)
// now go through app/api/user-action/route.ts instead of the client
// SDK's setDoc()/updateProfile() — see that route's header comment.
// Every write made this way counts against the account's daily write
// limit (lib/serverAuth.ts), same as every other write in the app.
//
// No users/{uid}.plan field exists anywhere else yet, so an account
// without one (every existing account today) reads as the 'free' tier
// rather than erroring — same "missing Firestore state degrades to a
// sane default" pattern useSites uses for a brand-new account with no
// sites doc yet.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
import { callUserAction } from '@/lib/userActionClient';
import type { PlanId } from '@/lib/plans';

const DEFAULT_PLAN_ID: PlanId = 'free';

export function useUserProfile(user: User | null) {
  const [planId, setPlanId] = useState<PlanId>(DEFAULT_PLAN_ID);
  const [planLoaded, setPlanLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setPlanId(DEFAULT_PLAN_ID);
      setPlanLoaded(false);
      return;
    }
    const db = getFirebaseDb();
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.data();
        setPlanId((data?.plan as PlanId) || DEFAULT_PLAN_ID);
        setPlanLoaded(true);
      },
      (err) => {
        console.error('user profile snapshot error', err);
        setPlanId(DEFAULT_PLAN_ID);
        setPlanLoaded(true);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Demo/manual plan switch: no billing provider is wired up yet (see
  // lib/plans.ts's own comment). Server-side via app/api/user-action's
  // 'update-plan' action instead of a direct client setDoc() — the
  // single call site to swap for "start checkout" once real billing
  // lands.
  const setPlan = useCallback(
    async (next: PlanId) => {
      if (!user) return false;
      const result = await callUserAction(user, 'update-plan', { planId: next });
      return result.ok;
    },
    [user]
  );

  // Updates both the Firestore mirror (users/{uid}.displayName) and
  // Firebase Auth's own displayName field, together, server-side via
  // app/api/user-action's 'update-profile' action.
  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!user) return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      const result = await callUserAction(user, 'update-profile', { displayName: trimmed });
      if (result.ok) {
        // Refresh the client SDK's cached user so displayName shows
        // immediately elsewhere in the UI without waiting for a token
        // refresh.
        await user.reload().catch(() => {});
      }
      return result.ok;
    },
    [user]
  );

  return { planId, planLoaded, setPlan, updateDisplayName };
}
