// hooks/useUserProfile.ts
//
// Profile-page data: the user's plan tier, stored at users/{uid}.plan —
// same account document useSites' sites subcollection hangs off of —
// and a setter for display name (Firebase Auth's own field;
// updateProfile is the same call useAuthForms' signup flow already
// uses to set the initial name).
//
// No users/{uid}.plan field exists anywhere else yet, so an account
// without one (every existing account today) reads as the 'free' tier
// rather than erroring — same "missing Firestore state degrades to a
// sane default" pattern useSites uses for a brand-new account with no
// sites doc yet.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { updateProfile, type User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
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
  // lib/plans.ts's own comment — app/api/widget/route.ts already reads
  // a plan field defensively in anticipation of this), so this writes
  // the chosen tier straight onto the user doc. The single call site to
  // swap for "start checkout" once real billing lands.
  const setPlan = useCallback(
    async (next: PlanId) => {
      if (!user) return false;
      try {
        await setDoc(doc(getFirebaseDb(), 'users', user.uid), { plan: next }, { merge: true });
        return true;
      } catch (err) {
        console.error('Failed to update plan', err);
        return false;
      }
    },
    [user]
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!user) return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        await updateProfile(user, { displayName: trimmed });
        return true;
      } catch (err) {
        console.error('Failed to update display name', err);
        return false;
      }
    },
    [user]
  );

  return { planId, planLoaded, setPlan, updateDisplayName };
}
