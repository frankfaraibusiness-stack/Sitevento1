// hooks/useSites.ts
//
// Subscribes to users/{uid}/sites in real time and tracks which one is
// "active" (selected tab): if the currently active site disappears or
// none is picked yet, default to the first one.
//
// disconnectSite and pauseSite now go through
// app/api/user-action/route.ts ('disconnect-site' / 'pause-site'
// actions) instead of the client SDK's deleteDoc()/updateDoc() — see
// that route's header comment. Every write made this way counts
// against the account's daily write limit (lib/serverAuth.ts). Site
// *creation* already went server-side earlier (app/api/connect-site) —
// this closes the remaining two client-side writes on this hook.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
import { callUserAction } from '@/lib/userActionClient';
import type { Site } from '@/lib/types';

export type DashState = 'loading' | 'empty' | 'error' | 'main';

export function useSites(uid: string | null, user: User | null = null) {
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
  // doc AND the flat siteIndex/{siteId} lookup doc, server-side, in one
  // request (see app/api/user-action's 'disconnect-site' action).
  const disconnectSite = useCallback(
    async (siteId: string) => {
      if (!user) return false;
      const result = await callUserAction(user, 'disconnect-site', { siteId });
      return result.ok;
    },
    [user]
  );

  // Owner-level pause/resume (components/dashboard/SiteManagePage.tsx).
  // Distinct from disconnecting: the site doc, its tag, and its
  // history all stay put — this just flips the `paused` flag.
  const pauseSite = useCallback(
    async (siteId: string, paused: boolean) => {
      if (!user) return false;
      const result = await callUserAction(user, 'pause-site', { siteId, paused });
      return result.ok;
    },
    [user]
  );

  return { sites, activeSiteId, setActiveSiteId, activeSite, dashState, errorMessage, disconnectSite, pauseSite };
}
