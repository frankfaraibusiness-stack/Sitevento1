// hooks/useRetentionCohorts.ts
//
// Read-only subscription to users/{uid}/sites/{siteId}/visitorProfiles,
// feeding lib/analytics.ts's retentionCohorts(). Deliberately its own
// small hook rather than reusing hooks/useVisitorProfiles.ts (the
// Users page's hook): that one also wires up blockedVisitors live
// state and five write actions (block/restrict/delete/restore/
// message), none of which a read-only cohort panel needs or should
// depend on — same "own small hook per panel" pattern as
// useCustomEvents.ts / useApiEvents.ts already use elsewhere in this
// file.
'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { VisitorProfile } from '@/lib/types';

export function useRetentionCohorts(uid: string | null, siteId: string | null) {
  const [profiles, setProfiles] = useState<VisitorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !siteId) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    // Ordering doesn't matter for cohort math (lib/analytics.ts buckets
    // by firstSeenAt itself) — kept consistent with useVisitorProfiles'
    // own query shape anyway so this rides the same Firestore index.
    const q = query(collection(db, 'users', uid, 'sites', siteId, 'visitorProfiles'), orderBy('number', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VisitorProfile)));
        setLoading(false);
      },
      (err) => {
        console.error('retention cohorts visitorProfiles snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, siteId]);

  return { profiles, loading };
}
