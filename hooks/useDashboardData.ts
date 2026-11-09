// hooks/useDashboardData.ts
//
// Everything the main dashboard (components/dashboard/DashboardShell.tsx)
// reads for ONE site and ONE period. Built around one rule: don't burn
// Firestore reads. Concretely:
//
//   - No always-on onSnapshot over the visits collection (that bills a
//     read per new visit, per open tab). Instead: one bounded range query
//     on load, then a 60-second poll that fetches only visits newer than
//     the newest one already cached. Polling pauses while the tab is
//     hidden and catches up the moment it's visible again.
//   - Exact totals come from Firestore count() aggregations (billed ~1
//     read per 1,000 index entries), not by downloading documents. The
//     visits list itself is capped at VISIT_CAP; when a range holds more
//     than that, `truncated` is true, `total` stays exact via count(), and
//     breakdowns/charts describe the newest VISIT_CAP visits (the UI says so).
//   - Leads and Security Bot logs are only re-downloaded when a cheap
//     count() says something changed.
//   - "Heavy" counts (profile totals, new users, previous-period total)
//     run on load and on a manual refresh, never on the 60s poll.
//
// Ranges that end in the past (yesterday, a custom window) never poll —
// their data can't change.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  documentId,
  getCountFromServer,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  Timestamp,
  where,
  type Query,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { PublisherDayEarnings } from '@/lib/adPool';
import type { Site, Lead, BrokenLink } from '@/lib/types';
import { addDays, dayKey, rangeSignature, startOfDay, type ResolvedRange } from '@/lib/dashboardRange';
import { normalizeVisit, type NormVisit } from '@/lib/dashboardStats';

export const VISIT_CAP = 5000;
const LEAD_CAP = 1500;
const BOT_CAP = 1000;
// Broken-link docs are one per DISTINCT href (see app/api/broken-link's
// header), never one per click — a real site rarely has more than a
// handful of genuinely broken links at once, so this cap is generous
// headroom, not a number expected to be hit in practice.
const BROKEN_LINK_CAP = 200;
export const POLL_MS = 60_000;
const MANUAL_COOLDOWN_MS = 4000;

export interface DashboardData {
  visits: NormVisit[]; // newest first
  truncated: boolean;
  coveredFrom: number | null; // oldest loaded ts when truncated
  total: number; // exact visits in range
  prevTotal: number | null; // exact visits in the previous equal window
  blockedVisits: number; // visits flagged blocked in range
  uniqueUsers: number;
  uniqueExact: boolean;
  newUsers: number | null;
  returningUsers: number | null;
  profilesTotal: number;
  blockedVisitors: number; // visitors blocked right now
  restrictedVisitors: number; // visitors under a live timed restriction
  flaggedNetworks: number; // visitors on hosting/proxy networks
  leadsInRange: number;
  leadsTotal: number;
  botsStopped: number; // Security Bot restrict/block actions in range
  botsCapped: boolean;
  clicksByDay: Record<string, number>;
  earnings: Record<string, PublisherDayEarnings>;
  // Leads with conversion attribution (lib/leadAttribution.ts),
  // downloaded for the current range — used by DeviceExperiencePanel's
  // per-device conversion rate and by the journey aggregator to mark
  // which journeys ended in a lead. Same change-detector pattern as
  // the existing `leads` fetch above (re-downloaded only when leadSig
  // changes), not a second independent query path.
  leadsAttributed: Lead[];
  // One doc per distinct broken link currently on record for this
  // site — NOT scoped to the selected date range (a broken link is a
  // standing site issue, not a per-day metric), so this is re-fetched
  // only on a full/manual load, never on the 60s poll, same cadence
  // as the "heavy" profile counts above.
  brokenLinks: BrokenLink[];
}

export const EMPTY_DASHBOARD: DashboardData = {
  visits: [],
  truncated: false,
  coveredFrom: null,
  total: 0,
  prevTotal: null,
  blockedVisits: 0,
  uniqueUsers: 0,
  uniqueExact: true,
  newUsers: null,
  returningUsers: null,
  profilesTotal: 0,
  blockedVisitors: 0,
  restrictedVisitors: 0,
  flaggedNetworks: 0,
  leadsInRange: 0,
  leadsTotal: 0,
  botsStopped: 0,
  botsCapped: false,
  clicksByDay: {},
  earnings: {},
  leadsAttributed: [],
  brokenLinks: [],
};

export type DashboardStatus = 'loading' | 'ready' | 'error';
type Mode = 'full' | 'poll' | 'manual';

interface Cache {
  sig: string;
  data: DashboardData;
  leadSig: string;
  botSig: string;
}

// brokenLinks is a standing site issue list, not a per-range metric
// (see DashboardData.brokenLinks), so it has no range-based signature
// to key off — it's simply re-fetched on every "heavy" (full/manual)
// load and otherwise carried over from the previous result, same
// cadence as the heavy profile counts above.

async function safe<T>(p: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.error(`[dashboard] ${label} failed`, err);
    return fallback;
  }
}

async function safeOrNull<T>(p: Promise<T>, label: string): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    console.error(`[dashboard] ${label} failed`, err);
    return null;
  }
}

async function countOf(q: Query): Promise<number> {
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

function tsBounds(range: ResolvedRange, field: string): QueryConstraint[] {
  const out: QueryConstraint[] = [];
  if (range.start) out.push(where(field, '>=', Timestamp.fromDate(range.start)));
  out.push(where(field, '<', Timestamp.fromDate(range.end)));
  return out;
}

export function useDashboardData(uid: string | null, siteId: string | null, range: ResolvedRange) {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [status, setStatus] = useState<DashboardStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  /** Bumps on every full/manual load — lets sibling hooks (account totals) refresh in step. */
  const [loadTick, setLoadTick] = useState(0);

  const rangeRef = useRef(range);
  rangeRef.current = range;
  const cacheRef = useRef<Cache | null>(null);
  const tokenRef = useRef(0);
  const busyRef = useRef(false);
  const lastRunRef = useRef(0);

  const run = useCallback(
    async (mode: Mode) => {
      if (!uid || !siteId) return;
      if (busyRef.current && mode !== 'full') return;
      if (mode === 'manual' && Date.now() - lastRunRef.current < MANUAL_COOLDOWN_MS) return;

      const r = rangeRef.current;
      const sig = rangeSignature(r);
      const token = mode === 'full' ? ++tokenRef.current : tokenRef.current;
      busyRef.current = true;
      lastRunRef.current = Date.now();
      if (mode === 'full') setStatus('loading');
      else setRefreshing(true);

      try {
        const db = getFirebaseDb();
        const col = (name: string) => collection(db, 'users', uid, 'sites', siteId, name);
        const prev = cacheRef.current && cacheRef.current.sig === sig && mode !== 'full' ? cacheRef.current : null;
        const heavy = mode !== 'poll';
        const nowMs = Date.now();

        // ── Kick off everything that doesn't depend on the visits
        // query first — previously these six stages ran one after
        // another (visits, then heavy profile counts, then cheap
        // counts, then leads, then bot log, then clicks, then
        // earnings), each a full network round-trip that blocked the
        // next from starting even though almost none of them
        // actually depend on each other. Firing them together cuts
        // first-load latency to roughly the slowest single query
        // instead of the sum of all of them. Only the "heavy" profile
        // counts (below) genuinely need `truncated` from the visits
        // query, so those alone wait on it.
        const pCol = col('visitorProfiles');
        const visitsCol = col('visits');

        const cheapCountsPromise = Promise.all([
          safe(countOf(query(pCol, where('blocked', '==', true))), 0, 'blocked profiles'),
          safe(countOf(query(pCol, where('restrictedUntil', '>', nowMs))), 0, 'restricted profiles'),
          safe(countOf(query(pCol, where('networkSuspect', '==', true))), 0, 'flagged networks'),
          safe(countOf(query(col('leads'))), -1, 'leads count'),
          safe(countOf(query(col('leads'), where('deletedAt', '>', 0))), 0, 'deleted leads count'),
          safe(countOf(query(col('botShieldLog'))), -1, 'bot log count'),
        ]);

        const recentKey = dayKey(addDays(startOfDay(new Date()), -1));
        const startKey = r.start ? dayKey(r.start) : null;
        const clickFrom = prev && mode === 'poll' ? (startKey && startKey > recentKey ? startKey : recentKey) : startKey;
        const clickConstraints: QueryConstraint[] = [];
        if (clickFrom) clickConstraints.push(where(documentId(), '>=', clickFrom));
        clickConstraints.push(where(documentId(), '<', dayKey(r.end)));
        const clickSnapPromise = safeOrNull(
          getDocs(query(col('clickDaily'), ...clickConstraints, fsLimit(800))),
          'click totals'
        );

        const earnConstraints: QueryConstraint[] = prev && mode === 'poll' ? [where(documentId(), '>=', recentKey)] : [];
        const earnSnapPromise = safeOrNull(getDocs(query(col('adEarnings'), ...earnConstraints)), 'ad earnings');

        // ── Visits ────────────────────────────────────────────────
        let visits: NormVisit[];
        let truncated: boolean;
        let total: number;
        let blockedVisits: number;

        if (prev && r.live) {
          const since = prev.data.visits[0]?.ts ?? (r.start ? r.start.getTime() : 0);
          const snap = await getDocs(
            query(
              visitsCol,
              where('ts', '>=', Timestamp.fromMillis(since)),
              where('ts', '<', Timestamp.fromDate(r.end)),
              orderBy('ts', 'desc'),
              fsLimit(1000)
            )
          );
          const seen = new Set(prev.data.visits.map((v) => v.id));
          const add: NormVisit[] = [];
          snap.forEach((d) => {
            if (seen.has(d.id)) return;
            const v = normalizeVisit(d.id, d.data());
            if (v) add.push(v);
          });
          visits = add.length ? [...add, ...prev.data.visits] : prev.data.visits;
          truncated = prev.data.truncated;
          if (visits.length > VISIT_CAP + 1500) {
            visits = visits.slice(0, VISIT_CAP);
            truncated = true;
          }
          total = truncated ? prev.data.total + add.length : visits.length;
          blockedVisits = truncated
            ? prev.data.blockedVisits + add.filter((v) => v.blocked).length
            : visits.filter((v) => v.blocked).length;
        } else if (prev) {
          // Historical range: nothing can have changed, reuse as-is.
          visits = prev.data.visits;
          truncated = prev.data.truncated;
          total = prev.data.total;
          blockedVisits = prev.data.blockedVisits;
        } else {
          const snap = await getDocs(query(visitsCol, ...tsBounds(r, 'ts'), orderBy('ts', 'desc'), fsLimit(VISIT_CAP)));
          visits = [];
          snap.forEach((d) => {
            const v = normalizeVisit(d.id, d.data());
            if (v) visits.push(v);
          });
          truncated = snap.size >= VISIT_CAP;
          if (truncated) {
            // These two were previously sequential (count, then
            // blocked-count) — run together since neither depends on
            // the other's result.
            const [totalCount, blockedCount] = await Promise.all([
              safe(countOf(query(visitsCol, ...tsBounds(r, 'ts'))), visits.length, 'visits count'),
              // Needs the (blocked, ts) composite index in firestore.indexes.json;
              // falls back to the loaded sample's count if it isn't deployed yet.
              safe(
                countOf(query(visitsCol, where('blocked', '==', true), ...tsBounds(r, 'ts'))),
                visits.filter((v) => v.blocked).length,
                'blocked visits count'
              ),
            ]);
            total = totalCount;
            blockedVisits = blockedCount;
          } else {
            total = visits.length;
            blockedVisits = visits.filter((v) => v.blocked).length;
          }
        }

        const coveredFrom = truncated && visits.length ? visits[visits.length - 1].ts : null;

        // ── Visitor profiles (heavy counts) ───────────────────────
        // The only stage that genuinely needs `truncated`/`visits`
        // above, so it starts only now — but everything kicked off
        // before the visits query (cheap counts, leads/bot signals,
        // clicks, earnings) has been in flight this whole time, not
        // waiting on this.
        const base = prev ? prev.data : null;
        let profilesTotal = base?.profilesTotal ?? 0;
        let prevTotal = base?.prevTotal ?? null;
        let newUsers = base?.newUsers ?? null;
        let uniqueUsers = base?.uniqueUsers ?? 0;
        let uniqueExact = base?.uniqueExact ?? true;

        const loadedUnique = new Set(visits.map((v) => v.visitorId)).size;

        if (heavy || !base) {
          const [pt, ut, nu, pv] = await Promise.all([
            safe(countOf(query(pCol)), 0, 'profiles total'),
            r.start && truncated && r.live
              ? safe(countOf(query(pCol, where('lastSeenAt', '>=', Timestamp.fromDate(r.start)))), -1, 'profiles in range')
              : Promise.resolve(-1),
            r.start
              ? safe(countOf(query(pCol, ...tsBounds(r, 'firstSeenAt'))), -1, 'new profiles')
              : Promise.resolve(-1),
            r.prevStart && r.prevEnd
              ? safe(
                  countOf(
                    query(
                      visitsCol,
                      where('ts', '>=', Timestamp.fromDate(r.prevStart)),
                      where('ts', '<', Timestamp.fromDate(r.prevEnd))
                    )
                  ),
                  -1,
                  'previous period count'
                )
              : Promise.resolve(-1),
          ]);
          profilesTotal = pt;
          prevTotal = pv >= 0 ? pv : null;
          newUsers = r.start ? (nu >= 0 ? nu : null) : pt;
          if (!truncated) {
            uniqueUsers = loadedUnique;
            uniqueExact = true;
          } else if (!r.start) {
            uniqueUsers = pt;
            uniqueExact = true;
          } else if (r.live && ut >= 0) {
            uniqueUsers = ut;
            uniqueExact = true;
          } else {
            uniqueUsers = loadedUnique;
            uniqueExact = false;
          }
        } else if (!truncated) {
          uniqueUsers = loadedUnique;
          uniqueExact = true;
        }
        const returningUsers = newUsers !== null ? Math.max(0, uniqueUsers - newUsers) : null;

        // ── Cheap per-cycle counts (already in flight above) ──────
        const [blockedVisitors, restrictedVisitors, flaggedNetworks, lAll, lDel, bAll] = await cheapCountsPromise;

        // Leads — re-download only when the (all, deleted) pair changed.
        const leadSig = `${lAll}:${lDel}`;
        const leadsTotal = lAll < 0 ? (prev?.data.leadsTotal ?? 0) : Math.max(0, lAll - lDel);
        let leadsInRange = prev?.data.leadsInRange ?? 0;
        if (!prev || prev.leadSig !== leadSig) {
          if (!r.start) {
            leadsInRange = leadsTotal;
          } else {
            const snap = await safeOrNull(
              getDocs(query(col('leads'), ...tsBounds(r, 'ts'), orderBy('ts', 'desc'), fsLimit(LEAD_CAP))),
              'leads in range'
            );
            if (snap) leadsInRange = snap.docs.filter((d) => !d.data().deletedAt).length;
          }
        }

        // Leads with conversion attribution (lib/leadAttribution.ts) —
        // same leadSig change-detector as leadsTotal/leadsInRange above,
        // but NOT range-bound: DeviceExperiencePanel's per-device
        // conversion rate and the journey aggregator both need the
        // full lead history to join against visits, not just the
        // leads inside the currently-selected date range.
        let leadsAttributed = prev?.data.leadsAttributed ?? [];
        if (!prev || prev.leadSig !== leadSig) {
          const attribSnap = await safeOrNull(
            getDocs(query(col('leads'), orderBy('ts', 'desc'), fsLimit(LEAD_CAP))),
            'leads attributed'
          );
          if (attribSnap) {
            leadsAttributed = attribSnap.docs
              .filter((d) => !d.data().deletedAt)
              .map((d) => ({ id: d.id, ...d.data() }) as Lead);
          }
        }

        // Security Bot — same change-detector pattern.
        const botSig = String(bAll);
        let botsStopped = prev?.data.botsStopped ?? 0;
        let botsCapped = prev?.data.botsCapped ?? false;
        if (!prev || prev.botSig !== botSig) {
          const snap = await safeOrNull(
            getDocs(query(col('botShieldLog'), ...tsBounds(r, 'ts'), orderBy('ts', 'desc'), fsLimit(BOT_CAP))),
            'bot log'
          );
          if (snap) {
            botsStopped = snap.docs.filter((d) => {
              const a = d.data().action;
              return a === 'block' || a === 'restrict';
            }).length;
            botsCapped = snap.size >= BOT_CAP;
          }
        }

        // Clicks per day + ad earnings (already in flight above).
        const clickSnap = await clickSnapPromise;
        const clicksByDay: Record<string, number> = { ...(prev?.data.clicksByDay ?? {}) };
        if (clickSnap) clickSnap.forEach((d) => (clicksByDay[d.id] = Number(d.data().clicks) || 0));

        const earnSnap = await earnSnapPromise;
        const earnings: Record<string, PublisherDayEarnings> = { ...(prev?.data.earnings ?? {}) };
        if (earnSnap) earnSnap.forEach((d) => (earnings[d.id] = d.data() as PublisherDayEarnings));

        // One doc per distinct broken link currently on record for this
        // site (see lib/types.ts's BrokenLink) — not scoped to the
        // selected date range, so only re-fetched on a full/manual
        // load, never on the 60s poll, same cadence as the heavy
        // profile counts above.
        let brokenLinks = prev?.data.brokenLinks ?? [];
        if (heavy) {
          const brokenSnap = await safeOrNull(
            getDocs(query(col('brokenLinks'), orderBy('lastSeenAt', 'desc'), fsLimit(BROKEN_LINK_CAP))),
            'broken links'
          );
          if (brokenSnap) {
            brokenLinks = brokenSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BrokenLink);
          }
        }

        const next: DashboardData = {
          visits,
          truncated,
          coveredFrom,
          total,
          prevTotal,
          blockedVisits,
          uniqueUsers,
          uniqueExact,
          newUsers,
          returningUsers,
          profilesTotal,
          blockedVisitors,
          restrictedVisitors,
          flaggedNetworks,
          leadsInRange,
          leadsTotal,
          botsStopped,
          botsCapped,
          clicksByDay,
          earnings,
          leadsAttributed,
          brokenLinks,
        };
        if (token !== tokenRef.current) return; // a newer full load superseded this one
        cacheRef.current = { sig, data: next, leadSig, botSig };
        setData(next);
        setStatus('ready');
        setError(null);
        setUpdatedAt(Date.now());
        if (mode !== 'poll') setLoadTick((n) => n + 1);
      } catch (err) {
        console.error('[dashboard] load failed', err);
        if (token !== tokenRef.current) return;
        if (mode === 'full') {
          setStatus('error');
          setError('We couldn’t load this site’s analytics. Check your connection and try again.');
        } else {
          setError('Couldn’t refresh just now — showing the last data we have.');
        }
      } finally {
        busyRef.current = false;
        setRefreshing(false);
      }
    },
    [uid, siteId]
  );

  const sig = rangeSignature(range);
  const live = range.live;
  useEffect(() => {
    if (!uid || !siteId) {
      setData(EMPTY_DASHBOARD);
      setStatus('loading');
      return;
    }
    cacheRef.current = null;
    run('full');

    const id = window.setInterval(() => {
      if (live && document.visibilityState === 'visible') run('poll');
    }, POLL_MS);
    const onVisible = () => {
      if (live && document.visibilityState === 'visible' && Date.now() - lastRunRef.current > POLL_MS) run('poll');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [uid, siteId, sig, live, run]);

  const refresh = useCallback(() => run('manual'), [run]);

  return { data, status, refreshing, error, updatedAt, refresh, loadTick };
}

// ── Whole-account totals ──────────────────────────────────────────
// Emails captured / blocked visitors / bots stopped, summed across every
// connected site. One handful of count() queries per site, run on mount
// and whenever the dashboard does a full or manual load — never polled.
export interface AccountTotals {
  emails: number;
  blockedVisitors: number;
  botsStopped: number;
}

export function useAccountTotals(uid: string | null, sites: Site[], tick: number) {
  const [totals, setTotals] = useState<AccountTotals | null>(null);
  const key = sites.map((s) => s.id).join(',');

  useEffect(() => {
    if (!uid || sites.length === 0) {
      setTotals(null);
      return;
    }
    let cancelled = false;
    const db = getFirebaseDb();
    (async () => {
      const perSite = await Promise.all(
        sites.map(async (s) => {
          const c = (name: string) => collection(db, 'users', uid, 'sites', s.id, name);
          const [all, del, blocked, bots] = await Promise.all([
            safe(countOf(query(c('leads'))), 0, 'totals leads'),
            safe(countOf(query(c('leads'), where('deletedAt', '>', 0))), 0, 'totals deleted leads'),
            safe(countOf(query(c('visitorProfiles'), where('blocked', '==', true))), 0, 'totals blocked'),
            safe(countOf(query(c('botShieldLog'), where('action', '!=', 'none'))), 0, 'totals bots'),
          ]);
          return { emails: Math.max(0, all - del), blocked, bots };
        })
      );
      if (cancelled) return;
      setTotals({
        emails: perSite.reduce((n, s) => n + s.emails, 0),
        blockedVisitors: perSite.reduce((n, s) => n + s.blocked, 0),
        botsStopped: perSite.reduce((n, s) => n + s.bots, 0),
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key, tick]);

  return totals;
}
