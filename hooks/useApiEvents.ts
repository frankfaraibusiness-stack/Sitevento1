// hooks/useApiEvents.ts
//
// Live subscription to users/{uid}/apiEvents — the "deep data" a
// site's own backend has sent in via app/api/ingest (see that route's
// header for the full model). Account-level, not site-scoped, same as
// the API keys themselves (lib/apiKeys.ts): one feed per account, with
// `siteId`/`event`/`test` as client-side filters rather than separate
// per-site subscriptions, since a single backend integration may well
// be sending events for several connected sites through the one key.
//
// Capped at 200 most recent via Firestore `limit()`, same reasoning
// hooks/useActiveSiteData.ts already applies to its own visits/leads
// feeds — this is a live dashboard widget, not an export; see
// app/api/leads-export's route if/when a full-history CSV is needed
// for this collection too.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { ApiEvent } from '@/lib/types';

const FETCH_LIMIT = 200;

export function useApiEvents(uid: string | null) {
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    const q = query(collection(db, 'users', uid, 'apiEvents'), orderBy('receivedAt', 'desc'), limit(FETCH_LIMIT));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApiEvent)));
        setLoading(false);
      },
      (err) => {
        console.error('apiEvents snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  // Live-only, excludes anything sent with the sv_test_ key — the
  // default view an owner wants when checking whether real integration
  // traffic is flowing.
  const liveEvents = useMemo(() => events.filter((e) => !e.test), [events]);

  return { events, liveEvents, loading };
}
