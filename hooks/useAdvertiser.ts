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
  const idToken = await user.getIdToken();
  const res = await fetch('/api/advertise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, action, ...extra }),
  });
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

  const refresh = useCallback(async () => {
    if (!uid) {
      setBilling({ balanceUsd: 0 });
      setAds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [billingRes, adsRes] = await Promise.all([callAdvertise('get-billing'), callAdvertise('list-ads')]);
    if (billingRes.ok) setBilling({ balanceUsd: billingRes.billing?.balanceUsd ?? 0 });
    if (adsRes.ok) setAds(adsRes.ads || []);
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

  return { billing, ads, loading, busy, topUp, createAd, pauseAd, resumeAd, refresh };
}
