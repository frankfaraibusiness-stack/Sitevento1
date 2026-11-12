// hooks/useAdCpm.ts
//
// Client hook for GET /api/ad-cpm — the dynamic, per-site, per-format
// CPM feed behind the "eCPM" and "about $X per 1,000 views" numbers
// on the Monetization dashboard. Nothing here is a fixed constant:
// the route computes every rate fresh from lib/adRates.ts's live
// country-tier table blended against the site's own real traffic, so
// refetching after new impressions land returns different numbers.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import type { AdFormatId } from '@/lib/adPool';

export interface AdCpmFormat {
  id: AdFormatId;
  estimatedCpmUsd: number;
  realizedCpmUsd: number | null;
  trailingImpressions: number;
}

export interface AdCpmResult {
  mode: 'public' | 'site';
  blendedBaseCpmUsd?: number;
  siteRealizedCpmUsd?: number | null;
  formats: AdCpmFormat[];
}

export function useAdCpm(uid: string | null, siteId: string | null) {
  const [data, setData] = useState<AdCpmResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (siteId) params.set('siteId', siteId);
      if (uid) {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          params.set('idToken', idToken);
        }
      }
      const res = await fetch(`/api/ad-cpm?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (json?.ok) {
        setData({ mode: json.mode, blendedBaseCpmUsd: json.blendedBaseCpmUsd, siteRealizedCpmUsd: json.siteRealizedCpmUsd, formats: json.formats || [] });
      }
    } catch (err) {
      console.error('useAdCpm fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [uid, siteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
