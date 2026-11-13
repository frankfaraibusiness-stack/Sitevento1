// hooks/useAllSitesMonetization.ts
//
// Powers the "Your sites" list on the new Monetization dashboard
// (MonetizationDashboard.tsx) — one row per connected site, each
// showing its own real on/off state, lifetime balance and recent
// impressions/CPM. Subscribes to each site's
// users/{uid}/sites/{siteId}/monetization/config doc (same doc
// useSiteMonetization.ts reads for the active site) and sums its
// adEarnings subcollection, via per-site onSnapshot listeners set up
// and torn down as the `sites` list changes. Writes still go through
// the real POST /api/site-monetization route (toggleSite below),
// never a direct client write.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { DEFAULT_MONETIZATION_CONFIG, type MonetizationConfig } from '@/lib/monetization';
import type { Site } from '@/lib/types';

export interface SiteMonetizationRow {
  siteId: string;
  config: MonetizationConfig;
  balanceUsd: number;
  impressions: number; // last 30 days
  cpmUsd: number | null; // last 30 days, realized
}

const PERIOD_DAYS = 30;

function trailingDayKeys(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

export function useAllSitesMonetization(uid: string | null, sites: Site[]) {
  const [rows, setRows] = useState<Record<string, SiteMonetizationRow>>({});
  const [busySiteId, setBusySiteId] = useState<string | null>(null);
  const unsubsRef = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!uid) {
      Object.values(unsubsRef.current).forEach((fn) => fn());
      unsubsRef.current = {};
      setRows({});
      return;
    }

    const db = getFirebaseDb();
    const siteIds = new Set(sites.map((s) => s.id));

    // Tear down listeners for sites no longer present.
    for (const existingId of Object.keys(unsubsRef.current)) {
      if (!siteIds.has(existingId)) {
        unsubsRef.current[existingId]();
        delete unsubsRef.current[existingId];
        setRows((prev) => {
          const next = { ...prev };
          delete next[existingId];
          return next;
        });
      }
    }

    const days = new Set(trailingDayKeys(PERIOD_DAYS));

    for (const site of sites) {
      if (unsubsRef.current[site.id]) continue;

      let config: MonetizationConfig = DEFAULT_MONETIZATION_CONFIG;
      let balanceUsd = 0;
      let impressions = 0;
      let earningsUsd = 0;

      const push = () => {
        setRows((prev) => ({
          ...prev,
          [site.id]: {
            siteId: site.id,
            config,
            balanceUsd,
            impressions,
            cpmUsd: impressions > 0 ? Math.round((earningsUsd / impressions) * 1000 * 100) / 100 : null,
          },
        }));
      };

      const configRef = doc(db, 'users', uid, 'sites', site.id, 'monetization', 'config');
      const unsubConfig = onSnapshot(
        configRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<MonetizationConfig>;
            config = { enabled: !!data.enabled, adFormats: data.adFormats };
          } else {
            config = DEFAULT_MONETIZATION_CONFIG;
          }
          push();
        },
        (err) => console.error('useAllSitesMonetization config snapshot error', err)
      );

      const earningsRef = collection(db, 'users', uid, 'sites', site.id, 'adEarnings');
      const unsubEarnings = onSnapshot(
        earningsRef,
        (snap) => {
          let b = 0;
          let periodImpressions = 0;
          let periodEarnings = 0;
          snap.forEach((d) => {
            const data = d.data() as { earningsUsd?: number; impressions?: number };
            b += data.earningsUsd || 0;
            if (days.has(d.id)) {
              periodImpressions += data.impressions || 0;
              periodEarnings += data.earningsUsd || 0;
            }
          });
          balanceUsd = b;
          impressions = periodImpressions;
          earningsUsd = periodEarnings;
          push();
        },
        (err) => console.error('useAllSitesMonetization earnings snapshot error', err)
      );

      unsubsRef.current[site.id] = () => {
        unsubConfig();
        unsubEarnings();
      };
    }

    return () => {
      // Listeners persist across renders by design (torn down only
      // when a site disappears or uid changes) — full cleanup happens
      // in the uid-change branch above and on unmount via the effect
      // below.
    };
  }, [uid, sites]);

  useEffect(() => {
    return () => {
      Object.values(unsubsRef.current).forEach((fn) => fn());
      unsubsRef.current = {};
    };
  }, []);

  const toggleSite = useCallback(
    async (siteId: string, next: boolean): Promise<{ ok: boolean; reason?: string }> => {
      if (!uid) return { ok: false };
      setBusySiteId(siteId);
      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) return { ok: false };
        const idToken = await user.getIdToken();

        const res = await fetch('/api/site-monetization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, siteId, enabled: next }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (!res.ok || !data.ok) {
          return { ok: false, reason: data.reason };
        }
        return { ok: true };
      } catch (err) {
        console.error('useAllSitesMonetization toggle error', err);
        return { ok: false };
      } finally {
        setBusySiteId(null);
      }
    },
    [uid]
  );

  return { rows, toggleSite, busySiteId };
}
