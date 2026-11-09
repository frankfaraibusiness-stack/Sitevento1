// hooks/useCustomEvents.ts
//
// Live subscription to users/{uid}/sites/{siteId}/customEvents — the
// named, client-side "user clicked THIS button" events sent via the
// public window.sitevento('track', name, properties) function (see
// public/sitevento.js's own header, and app/api/custom-event/route.ts
// for the endpoint that writes these docs). Site-scoped, unlike
// hooks/useApiEvents.ts's account-level feed: a custom event always
// fires from one specific page on one specific connected site, so it
// belongs under that site's own subcollection, same as visits/leads.
//
// Capped at 200 most recent, same reasoning as useApiEvents and
// useActiveSiteData's own visits/leads feeds — a live dashboard panel,
// not an export.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { CustomEvent } from '@/lib/types';

const FETCH_LIMIT = 200;

export function useCustomEvents(uid: string | null, siteId: string | null) {
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !siteId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    const q = query(
      collection(db, 'users', uid, 'sites', siteId, 'customEvents'),
      orderBy('ts', 'desc'),
      limit(FETCH_LIMIT)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomEvent)));
        setLoading(false);
      },
      (err) => {
        console.error('customEvents snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, siteId]);

  // Grouped counts by event name, most frequent first — the "what are
  // people actually doing" summary a site owner wants at a glance,
  // before scrolling the raw list below it.
  const byName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const name = e.name || 'event';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [events]);

  return { events, byName, loading };
}
