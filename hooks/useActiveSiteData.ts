// hooks/useActiveSiteData.ts
//
// Replaces subscribeToActiveSite/renderVisits/renderLeads/toggleBlockVisit.
// Subscribes to the active site's visits + leads subcollections in real
// time and derives the same stats the dashboard cards show (total,
// unique, blocked, leads) so components don't recompute them separately.
//
// Also owns restrictVisitor — a timed counterpart to toggleBlockVisit's
// permanent block, used by the new /dashboard/visits page (see
// VisitsPage.tsx). A restriction is stored as a plain epoch-ms
// `restrictedUntil` field (not serverTimestamp(), since the expiry
// needs client-side "now + N minutes" arithmetic) on every visit row
// for that visitorId and on the same blockedVisitors/{visitorId} doc
// toggleBlockVisit already writes to — so the tracker on the
// customer's site, which only reads blockedVisitors, honors both
// permanent blocks and active restrictions the same way. isRestricted
// below treats an expired restrictedUntil as not-restricted without
// needing a cleanup job: nothing un-sets the field, it just stops
// counting once it's in the past.
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  deleteField,
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

export function isRestricted(v: Visit, now = Date.now()): boolean {
  return typeof v.restrictedUntil === 'number' && v.restrictedUntil > now;
}

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

  // Restricts a visitor for a fixed duration instead of indefinitely.
  // durationMs === null clears an existing restriction early (the
  // "Lift restriction" action). Leaves `blocked` untouched — a
  // restriction and a permanent block are independent controls, so
  // lifting one never implies changing the other.
  async function restrictVisitor(visitorId: string, durationMs: number | null) {
    if (!uid || !siteId || !visitorId) return;
    try {
      const db = getFirebaseDb();
      const until = durationMs === null ? null : Date.now() + durationMs;

      const batch = writeBatch(db);
      for (const v of visits) {
        if (v.visitorId === visitorId) {
          batch.update(doc(db, 'users', uid, 'sites', siteId, 'visits', v.id), {
            restrictedUntil: until,
          });
        }
      }
      await batch.commit();

      const blockRef = doc(db, 'users', uid, 'sites', siteId, 'blockedVisitors', visitorId);
      if (until !== null) {
        await setDoc(blockRef, { restrictedUntil: until }, { merge: true });
      } else {
        // Only clear the restriction field — leave the doc (and any
        // permanent blockedAt on it) alone if a block also exists.
        await setDoc(blockRef, { restrictedUntil: deleteField() }, { merge: true }).catch(() => {});
      }
    } catch (err) {
      console.error('restrictVisitor error', err);
      window.alert('Could not update that visitor right now.');
    }
  }

  return { visits: visits.slice(0, 50), leads: leads.slice(0, 50), stats, toggleBlockVisit, restrictVisitor };
}
