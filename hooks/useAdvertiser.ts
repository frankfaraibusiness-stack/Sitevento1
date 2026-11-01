// hooks/useAdvertiser.ts
//
// Drives /dashboard/advertise — the advertiser-facing side of the ad
// pool. Calls POST /api/advertise with its various `action` values
// (see that route's header for the full contract), the same idToken
// pattern hooks/useSiteMonetization.ts and hooks/useSiteAgent.ts
// already use for their own Admin-SDK routes. No Firestore client
// reads here (unlike those hooks): adPool is write-protected and
// advertiser-scoped-read only (see firestore.rules), so billing and
// the advertiser's own ad list both come back as the `list-ads` /
// `get-billing` action responses, not an onSnapshot.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import type { AdDoc } from '@/lib/adPool';

export interface AdvertiserBilling {
  balanceUsd: number;
}

type ActionResult = { ok: boolean; error?: string };

async function callAdvertise(action: string, extra?: Record<string, unknown>): Promise<any> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }
  // Network failures (offline, DNS, CORS, a dropped connection) throw
  // from fetch() itself, before there's any Response to read — without
  // this try/catch that rejection propagated uncaught out of create-ad/
  // top-up/pause/resume, so the caller's own try/finally still cleared
  // `busy`, but no error ever reached the UI: the form just sat there
  // with nothing to show for the submit, and because refresh() never
  // ran, counts and the balance stayed at their last-known value (0 on
  // a fresh load). Catching here guarantees every call path always
  // resolves to a definite { ok, error } the caller can act on.
  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }
  let res: Response;
  try {
    res = await fetch('/api/advertise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, action, ...extra }),
    });
  } catch (err) {
    console.error(`[useAdvertiser] ${action} network error`, err);
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
  const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));
  if (!res.ok || !data.ok) {
    console.error(`[useAdvertiser] ${action} failed`, data.error || res.status);
  }
  return data;
}

export function useAdvertiser(uid: string | null) {
  const [billing, setBilling] = useState<AdvertiserBilling>({ balanceUsd: 0 });
  const [ads, setAds] = useState<AdDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Distinct from "ok:true, ads: []" (truly zero ads) — set whenever
  // list-ads itself failed, so the dashboard can show "something went
  // wrong loading your ads" instead of the misleading empty state
  // that previously showed on an unrelated server error (e.g. a
  // missing/still-building Firestore composite index — see
  // app/api/advertise/route.ts's list-ads handler).
  const [adsError, setAdsError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) {
      setBilling({ balanceUsd: 0 });
      setAds([]);
      setAdsError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [billingRes, adsRes] = await Promise.all([callAdvertise('get-billing'), callAdvertise('list-ads')]);
    if (billingRes.ok) setBilling({ balanceUsd: billingRes.billing?.balanceUsd ?? 0 });
    if (adsRes.ok) {
      setAds(adsRes.ads || []);
      // ads.warning (see route) means the list came back unsorted
      // because the composite index isn't live yet — still real data,
      // not an error, but worth surfacing so this gets fixed.
      setAdsError(adsRes.warning || null);
    } else {
      // Do NOT clear ads to [] here on a failed refresh — keep
      // whatever was last successfully loaded rather than flashing a
      // false "you have no ads" on a transient failure.
      setAdsError(adsRes.error || 'Could not load your ads. Please try refreshing.');
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const topUp = useCallback(
    async (amountUsd: number): Promise<ActionResult> => {
      setBusy(true);
      try {
        const data = await callAdvertise('top-up', { amountUsd });
        if (data.ok) {
          setBilling({ balanceUsd: data.billing?.balanceUsd ?? 0 });
          await refresh(); // an auto-resumed ad's status needs a fresh list-ads read
        }
        return { ok: !!data.ok, error: data.error };
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const createAd = useCallback(
    async (creative: Record<string, unknown>, budget: Record<string, unknown>): Promise<ActionResult> => {
      setBusy(true);
      try {
        const data = await callAdvertise('create-ad', { creative, budget });
        if (data.ok) await refresh();
        return { ok: !!data.ok, error: data.error };
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const pauseAd = useCallback(
    async (adId: string): Promise<ActionResult> => {
      setBusy(true);
      try {
        const data = await callAdvertise('pause-ad', { adId });
        if (data.ok) await refresh();
        return { ok: !!data.ok, error: data.error };
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const resumeAd = useCallback(
    async (adId: string): Promise<ActionResult> => {
      setBusy(true);
      try {
        const data = await callAdvertise('resume-ad', { adId });
        if (data.ok) await refresh();
        return { ok: !!data.ok, error: data.error };
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const deleteAd = useCallback(
    async (adId: string): Promise<ActionResult> => {
      setBusy(true);
      try {
        const data = await callAdvertise('delete-ad', { adId });
        if (data.ok) {
          // Remove it from local state immediately rather than
          // waiting on a full refresh() round-trip — same optimistic-
          // but-still-server-confirmed pattern, just skipping the
          // extra list-ads call since we already know exactly which
          // id is gone.
          setAds((prev) => prev.filter((a) => a.id !== adId));
        }
        return { ok: !!data.ok, error: data.error };
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return { billing, ads, adsError, loading, busy, topUp, createAd, pauseAd, resumeAd, deleteAd, refresh };
}
