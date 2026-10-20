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
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
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

    const db = getFirebaseDb();

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
      const db = getFirebaseDb();
      // Flip `blocked` on every visit row that belongs to this visitorId,
      // not just the one the person clicked — a visitor with several past
      // visits previously only had the clicked row update, leaving the
      // rest showing the old Blocked/Allowed status until they happened to
      // be clicked too. One batch keeps all of that visitor's rows (and
      // the row that was actually clicked, which may have no visitorId on
      // very old records) consistent in a single atomic write.
      const batch = writeBatch(db);
      const idsToUpdate = new Set<string>([visitId]);
      if (visitorId) {
        for (const v of visits) {
          if (v.visitorId === visitorId) idsToUpdate.add(v.id);
        }
      }
      for (const id of idsToUpdate) {
        batch.update(doc(db, 'users', uid, 'sites', siteId, 'visits', id), {
          blocked: blockedValue,
        });
      }
      await batch.commit();

      // Also (un)block the visitorId going forward, so the tracker on the
      // customer's site stops/resumes logging this visitor rather than
      // just flagging their past visits in the dashboard.
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

  return { visits: visits.slice(0, 50), leads: leads.slice(0, 50), stats, toggleBlockVisit };
}
