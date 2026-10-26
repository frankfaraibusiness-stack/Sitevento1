// hooks/useAccountLimits.ts
//
// Single hook behind every "plan limits" surface in the dashboard:
// the daily-write usage bar + countdown on DashboardShell, the fuller
// limits section on ProfilePage, and (indirectly, via lib/plans.ts's
// static numbers) the per-plan daily limits shown on PlansPage.
//
// Wraps app/api/site-limits (POST { idToken }), which already reports
// connected-site usage, feature-trial usage, AND — since the
// serverAuth.ts write-limit pass — the account-wide daily write
// counter (used/limit/remaining/resetsAt). This hook just owns the
// fetch/refresh/polling lifecycle and turns `resetsAt` into a live,
// ticking "resets in HH:MM:SS" string so consumers don't each
// reimplement a countdown timer.
//
// Refetches every 60s while the tab is visible (cheap single read,
// same cadence a user would plausibly make writes at) plus once
// immediately whenever the tab regains focus/visibility, so switching
// back to a stale tab doesn't show yesterday's numbers. Stops polling
// entirely when there's no signed-in user.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { PlanId } from '@/lib/plans';

export interface WriteUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
}

/** One trial-permission's today usage, as /api/site-limits's featureUsage[] reports it (lib/usageTracking.ts's getFeatureUsage, +permissionId). */
export interface FeatureUsage {
  permissionId: string;
  allowed: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface AccountLimits {
  planId: PlanId;
  planName: string;
  sitesUsed: number;
  sitesLimit: number;
  sitesAtLimit: boolean;
  nextPlanId: PlanId | null;
  writeUsage: WriteUsage;
  dailyWriteLimits: Record<PlanId, number | null>;
  /** Today's usage for every trial-only permission on this plan (lib/connectPermissions.ts). Already computed + returned by /api/site-limits; just not read by any UI yet. */
  featureUsage: FeatureUsage[];
}

const POLL_MS = 60_000;

export function useAccountLimits(user: User | null) {
  const [data, setData] = useState<AccountLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/site-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        setError(result.error || 'Could not load plan limits.');
        return;
      }
      setData({
        planId: result.planId,
        planName: result.planName,
        sitesUsed: result.used,
        sitesLimit: result.limit,
        sitesAtLimit: result.atLimit,
        nextPlanId: result.nextPlanId,
        writeUsage: result.writeUsage,
        dailyWriteLimits: result.dailyWriteLimits,
        featureUsage: result.featureUsage || [],
      });
      setError(null);
    } catch (err) {
      console.error('useAccountLimits refresh error', err);
      setError('Could not reach the server.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();

    const interval = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, refresh]);

  return { limits: data, loading, error, refresh };
}

/**
 * Ticking "resets in Xh Ym" / "Xm Ys" countdown to an ISO timestamp,
 * recomputed every second. Used by any UI showing the daily write
 * limit's reset timer. Returns null once the deadline has passed (the
 * next /api/site-limits poll will bring a fresh resetsAt).
 */
export function useCountdown(targetIso: string | null | undefined) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!targetIso) {
      setLabel(null);
      return;
    }
    const target = new Date(targetIso).getTime();

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        setLabel(null);
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours > 0) {
        setLabel(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setLabel(`${minutes}m ${seconds}s`);
      } else {
        setLabel(`${seconds}s`);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return label;
}
