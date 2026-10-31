// hooks/useLeadsData.ts
//
// Dedicated leads subscription for the standalone /dashboard/leads
// page (components/dashboard/EmailCapturePage.tsx). Separate from
// hooks/useActiveSiteData.ts on purpose: that hook caps leads to the
// 50 most recent for the main dashboard's small inline panel —
// this page needs the FULL list (active + soft-deleted, for the Bin)
// with no cap, plus per-lead delete/restore, so it gets its own
// subscription rather than overloading the capped one.
//
// deleteLead/restoreLead go through app/api/user-action's
// 'delete-lead' / 'restore-lead' actions (soft delete — stamps
// deletedAt, doesn't remove the Firestore doc — see that route's
// doDeleteLead/doRestoreLead), same server-verified pattern every
// other write in this app uses. Both count once against the account's
// daily write limit.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
import { callUserAction } from '@/lib/userActionClient';
import type { Lead } from '@/lib/types';

export interface LeadActionResult {
  ok: boolean;
  error?: string;
  code?: string;
  limit?: number;
  used?: number;
  planId?: string;
  nextPlanId?: string | null;
}

export function useLeadsData(uid: string | null, siteId: string | null, user: User | null) {
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !siteId) {
      setAllLeads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    const leadsQ = query(collection(db, 'users', uid, 'sites', siteId, 'leads'), orderBy('ts', 'desc'));
    const unsub = onSnapshot(
      leadsQ,
      (snap) => {
        setAllLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
        setLoading(false);
      },
      (err) => {
        console.error('leads snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, siteId]);

  const leads = useMemo(() => allLeads.filter((l) => !l.deletedAt), [allLeads]);
  const bin = useMemo(() => allLeads.filter((l) => !!l.deletedAt), [allLeads]);

  async function deleteLead(leadId: string): Promise<LeadActionResult> {
    if (!siteId || !user) return { ok: false, error: 'Not signed in.' };
    const result = await callUserAction(user, 'delete-lead', { siteId, leadId });
    return result;
  }

  async function restoreLead(leadId: string): Promise<LeadActionResult> {
    if (!siteId || !user) return { ok: false, error: 'Not signed in.' };
    const result = await callUserAction(user, 'restore-lead', { siteId, leadId });
    return result;
  }

  return { leads, bin, loading, deleteLead, restoreLead };
}
