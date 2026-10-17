// hooks/useActiveSiteData.ts
//
// Replaces subscribeToActiveSite/renderVisits/renderLeads/toggleBlockVisit.
// Subscribes to the active site's visits + leads subcollections in real
// time and derives the same stats the dashboard cards show (total,
// unique, blocked, leads) so components don't recompute them separately.
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Lead, Visit } from '@/lib/types';

export function useActiveSiteData(uid: string | null, siteId: string | null) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (!uid || !siteId) {
      setVisits([]);
      setLeads([]);
      return;
    }

    const visitsQ = query(
      collection(db, 'users', uid, 'sites', siteId, 'visits'),
      orderBy('ts', 'desc')
    );
    const unsubVisits = onSnapshot(
      visitsQ,
      (snap) => setVisits(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Visit))),
      (err) => console.error('visits snapshot error', err)
    );

    const leadsQ = query(
      collection(db, 'users', uid, 'sites', siteId, 'leads'),
      orderBy('ts', 'desc')
    );
    const unsubLeads = onSnapshot(
      leadsQ,
      (snap) => setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead))),
      (err) => console.error('leads snapshot error', err)
    );

    return () => {
      unsubVisits();
      unsubLeads();
    };
  }, [uid, siteId]);

  const stats = useMemo(() => {
    const unique = new Set(visits.map((v) => v.visitorId || v.id)).size;
    const blocked = visits.filter((v) => v.blocked);
    return {
      total: visits.length,
      unique,
      blocked,
      blockedCount: blocked.length,
      leadsCount: leads.length,
    };
  }, [visits, leads]);

  async function toggleBlockVisit(visitId: string, blockedValue: boolean, visitorId: string) {
    if (!uid || !siteId) return;
    try {
      await updateDoc(doc(db, 'users', uid, 'sites', siteId, 'visits', visitId), {
        blocked: blockedValue,
      });
      // Also (un)block the visitorId going forward, so the tracker on the
      // customer's site stops/resumes logging this visitor rather than
      // just flagging their past visit in the dashboard.
      if (visitorId) {
        const blockRef = doc(db, 'users', uid, 'sites', siteId, 'blockedVisitors', visitorId);
        if (blockedValue) {
          await setDoc(blockRef, { blockedAt: serverTimestamp() });
        } else {
          await deleteDoc(blockRef).catch(() => {});
        }
      }
    } catch (err) {
      console.error('toggleBlockVisit error', err);
      window.alert('Could not update that visitor right now.');
    }
  }

  return { visits: visits.slice(0, 50), leads, stats, toggleBlockVisit };
}
