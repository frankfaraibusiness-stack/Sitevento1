// hooks/useProfileStats.ts
//
// The four headline numbers on /profile (all-time views, all-time clicks,
// average session, sites connected) plus the 30-day growth badge and the
// unique-visitor count the Users quick tool shows. Every figure is read
// from the account's real Firestore data — nothing is estimated:
//
//   - views          users/{uid}/sites/{siteId}.stats.totalVisits, the counter
//                    app/api/track increments on every recorded visit. A site
//                    that predates that counter falls back to an exact
//                    count() over its visits collection.
//   - last30/prev30  two exact count() aggregations per site over the
//                    visits collection (the last 30 days, and the 30 days
//                    before that) — the growth badge compares the two.
//   - clicks         sum(validClicks) across every visit. validClicks is the
//                    human-paced click count app/api/visit-end stores on each
//                    visit, so this is "clicks by real people", not raw clicks.
//   - avg session    sum(activeSeconds) / count over visits that reported an
//                    engagement beacon (time the tab was actually visible).
//   - visitors       count() of the visitorProfiles collection.
//
// Aggregations are billed at ~1 read per 1,000 index entries, so the whole
// result is cached in sessionStorage for a couple of minutes — navigating
// away from the profile and back doesn't re-run it.
//
// A metric whose query failed (permissions, offline, missing index) is
// reported as null — the UI shows "—" — instead of quietly rendering 0 as
// if it were a real number.
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  count,
  getAggregateFromServer,
  getCountFromServer,
  query,
  sum,
  Timestamp,
  where,
  type Query,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { Site } from '@/lib/types';

const DAY_MS = 86_400_000;
const CACHE_TTL_MS = 2 * 60_000;

export interface ProfileStats {
  views: number | null;
  viewsLast30: number | null;
  viewsPrev30: number | null;
  /** Percent change, last 30 days vs the 30 days before. null when there is no earlier period to compare against. */
  growthPct: number | null;
  clicks: number | null;
  avgSessionSec: number | null;
  /** How many visits the average session is based on. */
  engagedVisits: number;
  uniqueVisitors: number | null;
}

interface SiteResult {
  views: number | null;
  last30: number | null;
  prev30: number | null;
  clicks: number | null;
  secs: number | null;
  engaged: number | null;
  visitors: number | null;
}

async function attempt<T>(run: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    console.error(`[profile] ${label} failed`, err);
    return null;
  }
}

async function countOf(q: Query): Promise<number> {
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

function storedTotalVisits(site: Site): number {
  const n = (site as Site & { stats?: { totalVisits?: unknown } }).stats?.totalVisits;
  return typeof n === 'number' && isFinite(n) && n > 0 ? n : 0;
}

async function loadSite(uid: string, site: Site, now: number): Promise<SiteResult> {
  const db = getFirebaseDb();
  const visits = collection(db, 'users', uid, 'sites', site.id, 'visits');
  const from30 = Timestamp.fromMillis(now - 30 * DAY_MS);
  const from60 = Timestamp.fromMillis(now - 60 * DAY_MS);
  const stored = storedTotalVisits(site);

  const [views, last30, prev30, clicks, engagement, visitors] = await Promise.all([
    stored > 0 ? Promise.resolve<number | null>(stored) : attempt(() => countOf(query(visits)), 'all-time views'),
    attempt(() => countOf(query(visits, where('ts', '>=', from30))), 'views last 30 days'),
    attempt(() => countOf(query(visits, where('ts', '>=', from60), where('ts', '<', from30))), 'views previous 30 days'),
    attempt(async () => {
      const snap = await getAggregateFromServer(visits, { clicks: sum('validClicks') });
      return Number(snap.data().clicks) || 0;
    }, 'clicks'),
    attempt(async () => {
      const snap = await getAggregateFromServer(query(visits, where('activeSeconds', '>=', 0)), {
        secs: sum('activeSeconds'),
        n: count(),
      });
      const data = snap.data();
      return { secs: Number(data.secs) || 0, n: Number(data.n) || 0 };
    }, 'engagement'),
    attempt(() => countOf(query(collection(db, 'users', uid, 'sites', site.id, 'visitorProfiles'))), 'unique visitors'),
  ]);

  return {
    views,
    last30,
    prev30,
    clicks,
    secs: engagement ? engagement.secs : null,
    engaged: engagement ? engagement.n : null,
    visitors,
  };
}

/** Sum of a per-site metric, or null if any site failed to report it. */
function total(results: SiteResult[], pick: (r: SiteResult) => number | null): number | null {
  let out = 0;
  for (const r of results) {
    const v = pick(r);
    if (v === null) return null;
    out += v;
  }
  return out;
}

function combine(results: SiteResult[]): ProfileStats {
  const viewsLast30 = total(results, (r) => r.last30);
  const viewsPrev30 = total(results, (r) => r.prev30);
  const secs = total(results, (r) => r.secs);
  const engaged = total(results, (r) => r.engaged);

  let growthPct: number | null = null;
  if (viewsLast30 !== null && viewsPrev30 !== null && viewsPrev30 > 0) {
    growthPct = ((viewsLast30 - viewsPrev30) / viewsPrev30) * 100;
  }

  return {
    views: total(results, (r) => r.views),
    viewsLast30,
    viewsPrev30,
    growthPct,
    clicks: total(results, (r) => r.clicks),
    avgSessionSec: secs !== null && engaged !== null && engaged > 0 ? secs / engaged : null,
    engagedVisits: engaged ?? 0,
    uniqueVisitors: total(results, (r) => r.visitors),
  };
}

const EMPTY_ACCOUNT: ProfileStats = {
  views: 0,
  viewsLast30: 0,
  viewsPrev30: 0,
  growthPct: null,
  clicks: 0,
  avgSessionSec: null,
  engagedVisits: 0,
  uniqueVisitors: 0,
};

function readCache(key: string): ProfileStats | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; stats: ProfileStats };
    if (!parsed || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.stats;
  } catch {
    return null;
  }
}

function writeCache(key: string, stats: ProfileStats) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), stats }));
  } catch {
    /* storage unavailable — the cache is only an optimisation */
  }
}

export function useProfileStats(uid: string | null, sites: Site[], enabled: boolean) {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const siteKey = useMemo(() => sites.map((s) => s.id).join(','), [sites]);

  useEffect(() => {
    if (!uid || !enabled) {
      setStats(null);
      setLoading(true);
      return;
    }
    if (sites.length === 0) {
      setStats(EMPTY_ACCOUNT);
      setLoading(false);
      return;
    }

    const cacheKey = `pf-stats:${uid}:${siteKey}`;
    const cached = readCache(cacheKey);
    if (cached) {
      setStats(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      const now = Date.now();
      const results = await Promise.all(sites.map((s) => loadSite(uid, s, now)));
      if (cancelled) return;
      const next = combine(results);
      setStats(next);
      setLoading(false);
      writeCache(cacheKey, next);
    })();

    return () => {
      cancelled = true;
    };
    // `sites` is intentionally keyed by id (siteKey): the live site snapshot
    // emits a new array on every unrelated field change, which must not
    // re-run these aggregations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, enabled, siteKey]);

  return { stats, loading };
}
