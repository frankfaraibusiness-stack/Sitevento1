// hooks/useSites.ts
//
// Replaces initDashboardData/renderSiteTabs/renderActiveSiteHeader/
// selectSite from the original. Subscribes to users/{uid}/sites in real
// time and tracks which one is "active" (selected tab), same behavior
// as before: if the currently active site disappears or none is picked
// yet, default to the first one.
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { Site } from '@/lib/types';

export type DashState = 'loading' | 'empty' | 'error' | 'main';

export function useSites(uid: string | null) {
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [dashState, setDashState] = useState<DashState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!uid) {
      setSites([]);
      setActiveSiteId(null);
      return;
    }

    setDashState('loading');

    const db = getFirebaseDb();
    const sitesQuery = query(collection(db, 'users', uid, 'sites'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      sitesQuery,
      (snap) => {
        const nextSites = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Site));
        setSites(nextSites);

        if (nextSites.length === 0) {
          setDashState('empty');
          setActiveSiteId(null);
          return;
        }

        setDashState('main');
        setActiveSiteId((current) => {
          if (current && nextSites.find((s) => s.id === current)) return current;
          return nextSites[0].id;
        });
      },
      (err) => {
        console.error('sites snapshot error', err);
        if (err && err.code === 'permission-denied') {
          setErrorMessage(
            "Your account doesn't have permission to read this data yet. If this keeps happening, check your Firestore security rules."
          );
        } else {
          setErrorMessage(
            `Something went wrong reaching your data (${err?.code || 'unknown error'}). Check your connection and try again.`
          );
        }
        setDashState('error');
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const activeSite = sites.find((s) => s.id === activeSiteId) || null;

  // Disconnects a site: removes the owner's users/{uid}/sites/{siteId}
  // doc AND the flat siteIndex/{siteId} lookup doc that /api/track and
  // /api/overlay-track use to resolve "which account owns this
  // siteId" — without that second delete, a stale tag left on an old
  // page could keep writing visits and reading banner state against an
  // account the owner just disconnected it from. Does NOT delete the
  // visits/leads/blockedVisitors subcollections themselves (Admin SDK
  // batch-delete territory, not something the client should do), so a
  // reconnected site with the same ID would still see old history —
  // acceptable since siteId is freshly generated per connection.
  const disconnectSite = useCallback(async (siteId: string) => {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, 'siteIndex', siteId)).catch(() => {});
    if (uid) {
      await deleteDoc(doc(db, 'users', uid, 'sites', siteId));
    }
  }, [uid]);

  // Owner-level pause/resume (components/dashboard/SiteManagePage.tsx).
  // Distinct from disconnecting: the site doc, its tag, and its
  // history all stay put — this just flips the `paused` flag that
  // app/api/track and app/api/site-widgets both check before
  // recording/serving anything for the site (see lib/types.ts's
  // Site['paused'] comment). Plain client-side update() rather than a
  // server route: firestore.rules' users/{uid}/{document=**} rule
  // already allows the owner to update(), the same way
  // BannerComposer's overlay field and ConnectedSitesSection's
  // disconnect already write directly from the client, and nothing
  // about pausing needs the atomicity/limit-checking that forced site
  // *creation* server-side.
  const pauseSite = useCallback(async (siteId: string, paused: boolean) => {
    if (!uid) return;
    const db = getFirebaseDb();
    await updateDoc(doc(db, 'users', uid, 'sites', siteId), { paused });
  }, [uid]);

  return { sites, activeSiteId, setActiveSiteId, activeSite, dashState, errorMessage, disconnectSite, pauseSite };
}
