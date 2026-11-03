// hooks/useSiteMonetization.ts
//
// Drives the Monetization feature's on/off switch, AND its per-format
// ad-type toggles, for the active site. Same read/write split as
// hooks/useSiteWidget.ts and hooks/useSiteAgent.ts: reads stay on the
// client Firestore SDK (live onSnapshot, already safe under the
// existing users/{uid}/{document=**} rule), writes go through POST
// /api/site-monetization (Admin SDK, server-side verification
// re-check — see that route's header).
//
// setAdFormats writes immediately (no separate "Save" step) — same
// immediate-write posture setEnabled already has here, not the
// draft/dirty/save shape useSiteAgent uses, since there's still no
// multi-field form staging anything else in this feature yet.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { DEFAULT_MONETIZATION_CONFIG, type MonetizationConfig } from '@/lib/monetization';
import type { AdFormatId } from '@/lib/adPool';
import type { Site } from '@/lib/types';

export function useSiteMonetization(uid: string | null, activeSite: Site | null) {
  const [config, setConfig] = useState<MonetizationConfig>(DEFAULT_MONETIZATION_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !activeSite) {
      setConfig(DEFAULT_MONETIZATION_CONFIG);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    const ref = doc(db, 'users', uid, 'sites', activeSite.id, 'monetization', 'config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<MonetizationConfig>;
          setConfig({ enabled: !!data.enabled, adFormats: data.adFormats });
        } else {
          setConfig(DEFAULT_MONETIZATION_CONFIG);
        }
        setLoading(false);
      },
      (err) => {
        console.error('site monetization snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, activeSite?.id]);

  // Returns { ok, reason } rather than a plain boolean, same honesty
  // principle as useSiteWidget's persist(): `ok: false` with reason
  // 'SITE_NOT_VERIFIED' means the write was refused server-side (the
  // real gate — see the route), not a network failure, so the caller
  // can route to the right message instead of a generic error.
  const setEnabled = useCallback(
    async (next: boolean): Promise<{ ok: boolean; reason?: string }> => {
      if (!uid || !activeSite) return { ok: false };
      setBusy(true);
      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) {
          console.error('site monetization persist error: no signed-in user');
          window.alert('Your session has expired. Please sign in again.');
          return { ok: false };
        }
        const idToken = await user.getIdToken();

        const res = await fetch('/api/site-monetization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, siteId: activeSite.id, enabled: next }),
        });

        const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));

        if (!res.ok || !data.ok) {
          if (data.reason !== 'SITE_NOT_VERIFIED') {
            console.error('site monetization persist error', data.error || res.status);
          }
          return { ok: false, reason: data.reason };
        }

        setConfig((prev) => ({ ...prev, enabled: !!data.monetization?.enabled }));
        return { ok: true };
      } catch (err) {
        console.error('site monetization persist error', err);
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [uid, activeSite?.id]
  );

  // Writes the FULL adFormats map each call (merge happens server-side
  // against the enabled flag, but this map itself is replaced whole,
  // not deep-merged per key) — MonetizationAdTypeGrid always sends its
  // complete current map, so there's never a partial-key write to
  // reconcile here.
  const setAdFormats = useCallback(
    async (next: Partial<Record<AdFormatId, boolean>>): Promise<{ ok: boolean; reason?: string }> => {
      if (!uid || !activeSite) return { ok: false };
      setBusy(true);
      try {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) {
          console.error('site monetization persist error: no signed-in user');
          window.alert('Your session has expired. Please sign in again.');
          return { ok: false };
        }
        const idToken = await user.getIdToken();

        const res = await fetch('/api/site-monetization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, siteId: activeSite.id, enabled: config.enabled, adFormats: next }),
        });

        const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));

        if (!res.ok || !data.ok) {
          console.error('site monetization adFormats persist error', data.error || res.status);
          return { ok: false, reason: data.reason };
        }

        setConfig((prev) => ({ ...prev, adFormats: data.monetization?.adFormats }));
        return { ok: true };
      } catch (err) {
        console.error('site monetization adFormats persist error', err);
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [uid, activeSite?.id, config.enabled]
  );

  return { config, loading, busy, setEnabled, setAdFormats };
}
