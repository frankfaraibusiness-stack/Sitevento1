'use client';

// components/plans/VentolPlans.tsx
//
// The /dashboard/plans screen: a short heading, the four plan cards,
// and two footer links. Plan switches write straight to the account's
// plan through useUserProfile.setPlan (no billing provider is wired up).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { getPlan, type PlanId } from '@/lib/plans';
import { useUserProfile } from '@/hooks/useUserProfile';
import { PlanCards } from './PlanCards';

interface VentolPlansProps {
  user: User;
}

export function VentolPlans({ user }: VentolPlansProps) {
  const { planId, planLoaded, setPlan } = useUserProfile(user);
  const [busyId, setBusyId] = useState<PlanId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const choose = useCallback(
    async (id: PlanId) => {
      if (id === planId || busyId) return;
      setBusyId(id);
      const ok = await setPlan(id);
      setBusyId(null);
      setToast(ok ? `You’re on ${getPlan(id).name}` : 'Couldn’t switch plans. Try again.');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3200);
    },
    [planId, busyId, setPlan],
  );

  return (
    <section className="vpl">
      <header className="vpl-top">
        <h1>Pick your Ventol</h1>
        <p>
          <span className="vpl-hint-touch">Tap a plan to see everything inside. </span>
          <span className="vpl-hint-wide">Everything each plan includes, side by side. </span>
          Switch anytime.
        </p>
      </header>

      <PlanCards currentId={planLoaded ? planId : null} busyId={busyId} onChoose={choose} />

      <footer className="vpl-foot">
        <a href="/pricing">Full pricing details</a>
        <a href="/dashboard">Back to dashboard</a>
      </footer>

      {toast && (
        <div className="vpl-toast" role="status">
          {toast}
        </div>
      )}
    </section>
  );
}
