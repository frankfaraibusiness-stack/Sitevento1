// hooks/useActiveSiteData.ts
//
// Replaces subscribeToActiveSite/renderVisits/renderLeads/toggleBlockVisit.
// Subscribes to the active site's visits + leads subcollections in real
// time and derives the same stats the dashboard cards show (total,
// unique, blocked, leads) so components don't recompute them separately.
//
// Also owns restrictVisitor — a timed counterpart to toggleBlockVisit's
// permanent block, used by the new /dashboard/visits page (see
// VisitsPage.tsx). restrictVisitor now goes through
// app/api/user-action/route.ts ('restrict-visitor' action) instead of
// the client SDK's writeBatch()/setDoc() — see that route's
// doRestrictVisitor for the server-side fan-out (every visit row for
// the visitorId plus the blockedVisitors/{visitorId} doc). Every call
// counts once against the account's daily write limit
// (lib/serverAuth.ts). toggleBlockVisit was already server-side before
// this pass (app/api/block-visitor). isRestricted below treats an
// expired restrictedUntil as not-restricted without needing a cleanup
// job: nothing un-sets the field, it just stops counting once it's in
// the past.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { callUserAction } from '@/lib/userActionClient';
import type { Lead, Visit } from '@/lib/types';

export function isRestricted(v: Visit, now = Date.now()): boolean {
  return typeof v.restrictedUntil === 'number' && v.restrictedUntil > now;
}

export function useActiveSiteData(uid: string | null, siteId: string | null, user: User | null = null) {
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

  // Blocking/unblocking now goes through app/api/block-visitor/route.ts
  // (Admin SDK, server-verified) instead of writing straight to
  // Firestore with the client SDK — that route enforces the daily
  // block quota from lib/limits.ts's FEATURE_LIMITS['visitor-access-control']
  // (Free 3/day, Starter 1,000/day, Scale 5,000/day, Pro Developer
  // unlimited) atomically against the write itself, which a
  // client-only check can't do safely (anyone could call Firestore
  // directly and skip it). See that route's header comment and
  // firestore.rules's updated users/{uid}/sites/{siteId}/visits and
  // blockedVisitors rules, which now block the client-side write this
  // function used to make.
  async function toggleBlockVisit(visitId: string, blockedValue: boolean, visitorId: string) {
    if (!uid || !siteId) return;
    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        window.alert('Your session expired. Please sign in again.');
        return;
      }
      const idToken = await currentUser.getIdToken();

      const res = await fetch('/api/block-visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, siteId, visitId, visitorId, blockedValue }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.ok) {
        if (result.code === 'FEATURE_LIMIT_REACHED') {
          window.alert(result.error || `Daily visitor-blocking limit reached (${result.limit}/day). Upgrade for a higher limit.`);
          return;
        }
        window.alert(result.error || 'Could not update that visitor right now.');
        return;
      }
      // visits/leads are live-subscribed above, so the UI updates itself
      // once the server's write lands — no local state patch needed here.
    } catch (err) {
      console.error('toggleBlockVisit error', err);
      window.alert('Could not update that visitor right now.');
    }
  }

  // Restricts a visitor for a fixed duration instead of indefinitely.
  // durationMs === null clears an existing restriction early (the
  // "Lift restriction" action). Leaves `blocked` untouched — a
  // restriction and a permanent block are independent controls, so
  // lifting one never implies changing the other. Server-side via
  // app/api/user-action's 'restrict-visitor' action — see this file's
  // header comment.
  async function restrictVisitor(visitorId: string, durationMs: number | null) {
    if (!uid || !siteId || !visitorId || !user) return;
    const result = await callUserAction(user, 'restrict-visitor', { siteId, visitorId, durationMs });
    if (!result.ok) {
      if (result.code === 'WRITE_LIMIT_REACHED') {
        window.alert(result.error || `Daily write limit reached (${result.limit}/day). Upgrade for a higher limit.`);
        return;
      }
      window.alert(result.error || 'Could not update that visitor right now.');
    }
    // visits/leads are live-subscribed above, so the UI updates itself
    // once the server's write lands — no local state patch needed here.
  }

  return { visits: visits.slice(0, 50), leads: leads.slice(0, 50), stats, toggleBlockVisit, restrictVisitor };
}
