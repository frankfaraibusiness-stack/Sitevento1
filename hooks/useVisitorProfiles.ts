// hooks/useVisitorProfiles.ts
//
// Dedicated subscription for /dashboard/users (components/dashboard/
// UsersPage.tsx) — lists UNIQUE visitors, one row per real person, by
// reading users/{uid}/sites/{siteId}/visitorProfiles directly (see
// VisitorProfile in lib/types.ts) instead of deriving uniqueness by
// grouping the visits collection client-side the way
// hooks/useActiveSiteData.ts's `stats.unique` does for its small
// capped panel. That collection is maintained incrementally by
// app/api/track's upsertVisitorProfile on every beacon.
//
// Same split as hooks/useLeadsData.ts: `profiles` is the live,
// non-deleted list; `bin` is the soft-deleted one, for the Bin panel.
//
// Actions:
//   - blockVisitor / unblockVisitor route through the EXISTING
//     app/api/block-visitor endpoint (quota-enforced — see that
//     route's header comment) rather than duplicating its logic here.
//   - restrictVisitor routes through app/api/user-action's existing
//     'restrict-visitor' action (same one hooks/useActiveSiteData.ts
//     uses), so a timed restriction set from either page behaves
//     identically.
//   - deleteVisitor / restoreVisitor are new 'delete-visitor' /
//     'restore-visitor' actions on that same route (see this file's
//     sibling change in app/api/user-action/route.ts) — soft-delete
//     only, exact mirror of delete-lead/restore-lead.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { callUserAction, type UserActionResult } from '@/lib/userActionClient';
import type { VisitorProfile, VisitorMessage } from '@/lib/types';

export function useVisitorProfiles(uid: string | null, siteId: string | null, user: User | null) {
  const [allProfiles, setAllProfiles] = useState<VisitorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  // visitorId -> live block/restrict state, from blockedVisitors/*
  // directly, so the Users page reflects a block/restrict the instant
  // it happens even though visitorProfiles.blocked is only ever set
  // once at profile-creation time (see upsertVisitorProfile's header
  // comment in app/api/track/route.ts — it deliberately never
  // overwrites `blocked` on an existing profile, since app/api/
  // block-visitor and 'restrict-visitor' are the sole owners of that
  // state and a tracking beacon must never clobber their writes).
  const [blockedMap, setBlockedMap] = useState<Map<string, { blocked: boolean; restrictedUntil?: number | null }>>(new Map());

  useEffect(() => {
    if (!uid || !siteId) {
      setAllProfiles([]);
      setBlockedMap(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    // Ordered by `number` (ascending) rather than lastSeenAt, so "User
    // #1" really is always the first row — matches the whole point of
    // the numbering (lib/types.ts's VisitorProfile header comment).
    const profilesQ = query(collection(db, 'users', uid, 'sites', siteId, 'visitorProfiles'), orderBy('number', 'asc'));
    const unsubProfiles = onSnapshot(
      profilesQ,
      (snap) => {
        setAllProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VisitorProfile)));
        setLoading(false);
      },
      (err) => {
        console.error('visitorProfiles snapshot error', err);
        setLoading(false);
      }
    );

    const blockedQ = collection(db, 'users', uid, 'sites', siteId, 'blockedVisitors');
    const unsubBlocked = onSnapshot(
      blockedQ,
      (snap) => {
        const map = new Map<string, { blocked: boolean; restrictedUntil?: number | null }>();
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          // A blockedVisitors doc can exist purely to carry a timed
          // restriction (restrictedUntil) with no permanent block at
          // all (see doRestrictVisitor's merge-write) — `blocked`
          // means the doc itself represents a permanent block, i.e.
          // it has a blockedAt stamp (set by app/api/block-visitor).
          map.set(d.id, { blocked: typeof data.blockedAt !== 'undefined', restrictedUntil: data.restrictedUntil ?? null });
        });
        setBlockedMap(map);
      },
      (err) => console.error('blockedVisitors snapshot error', err)
    );

    return () => {
      unsubProfiles();
      unsubBlocked();
    };
  }, [uid, siteId]);

  // Merge the live block/restrict map onto each profile so every
  // consumer of `profiles`/`bin` sees current state without having to
  // know blockedVisitors exists.
  const mergedProfiles = useMemo(
    () =>
      allProfiles.map((p) => {
        const live = blockedMap.get(p.visitorId);
        return live ? { ...p, blocked: live.blocked, restrictedUntil: live.restrictedUntil } : { ...p, restrictedUntil: null };
      }),
    [allProfiles, blockedMap]
  );

  const profiles = useMemo(() => mergedProfiles.filter((p) => !p.deletedAt), [mergedProfiles]);
  const bin = useMemo(() => mergedProfiles.filter((p) => !!p.deletedAt), [mergedProfiles]);

  async function blockVisitor(visitorId: string, blockedValue: boolean): Promise<UserActionResult> {
    if (!siteId) return { ok: false, error: 'No active site.' };
    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return { ok: false, error: 'Your session expired. Please sign in again.' };
      const idToken = await currentUser.getIdToken();
      // Deliberately send visitorId only, no visitId: that route
      // treats visitId as a single extra visit-doc id to flip
      // alongside whatever it finds by querying on visitorId (see its
      // header comment) — passing visitorId as a fake visitId would
      // make it look up a visits/{visitorId} doc that doesn't exist
      // and fail the whole transaction. Omitting it just leaves that
      // path a no-op; the visitorId query still flips every real visit
      // row for this person.
      const res = await fetch('/api/block-visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, siteId, visitorId, blockedValue }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        return {
          ok: false,
          error: result.error || 'Could not update that user right now.',
          code: result.code,
          limit: result.limit,
          used: result.used,
        };
      }
      return { ok: true };
    } catch (err) {
      console.error('blockVisitor error', err);
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  }

  async function restrictVisitor(visitorId: string, durationMs: number | null): Promise<UserActionResult> {
    if (!siteId || !user) return { ok: false, error: 'Not signed in.' };
    return callUserAction(user, 'restrict-visitor', { siteId, visitorId, durationMs });
  }

  async function deleteVisitor(visitorId: string): Promise<UserActionResult> {
    if (!siteId || !user) return { ok: false, error: 'Not signed in.' };
    return callUserAction(user, 'delete-visitor', { siteId, visitorId });
  }

  async function restoreVisitor(visitorId: string): Promise<UserActionResult> {
    if (!siteId || !user) return { ok: false, error: 'Not signed in.' };
    return callUserAction(user, 'restore-visitor', { siteId, visitorId });
  }

  // `message` is the raw composer fields (title/body/ctaLabel/ctaUrl)
  // — sanitized and stamped with sentAt server-side in
  // doSendVisitorMessage, never trusted as-is from here.
  async function sendMessage(
    visitorId: string,
    message: { title: string; body: string; ctaLabel: string; ctaUrl: string }
  ): Promise<UserActionResult<{ pendingMessage: VisitorMessage }>> {
    if (!siteId || !user) return { ok: false, error: 'Not signed in.' };
    return callUserAction(user, 'send-visitor-message', { siteId, visitorId, message });
  }

  async function clearMessage(visitorId: string): Promise<UserActionResult> {
    if (!siteId || !user) return { ok: false, error: 'Not signed in.' };
    return callUserAction(user, 'clear-visitor-message', { siteId, visitorId });
  }

  return { profiles, bin, loading, blockVisitor, restrictVisitor, deleteVisitor, restoreVisitor, sendMessage, clearMessage };
}
