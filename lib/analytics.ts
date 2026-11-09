// lib/analytics.ts
//
// Pure, client-side derivations over the Visit[] array the dashboard
// already subscribes to (useActiveSiteData) — no new Firestore reads,
// no backend changes. Powers the Analytics tab's trend chart and
// breakdown lists (top pages, referrers, devices/browsers, countries).
import type { Visit, VisitorProfile } from './types';

// Visit['ts'] and VisitorProfile's firstSeenAt/lastSeenAt are all the
// exact same shape ({toDate}|number|null) — widened here rather than
// duplicated, so retentionCohorts (below) can reuse this same helper
// instead of adding a near-identical copy for VisitorProfile's two
// timestamp fields.
type TimestampLike = { toDate: () => Date } | number | null | undefined;

function toDate(ts: TimestampLike): Date | null {
  if (!ts) return null;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  const d = new Date(ts as string | number);
  return isNaN(d.getTime()) ? null : d;
}

// Local calendar-day key (YYYY-MM-DD in the viewer's own timezone), not
// a UTC ISO slice — Date#toISOString() reports UTC, so round-tripping
// through it would shift the key a day for any viewer east of UTC (e.g.
// UTC+2 local midnight is still the previous day in UTC), making
// today's visits appear to land in yesterday's bucket.
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DailyPoint {
  label: string; // "Oct 12"
  date: string; // "2026-10-12" — stable key
  visits: number;
  uniques: number;
}

// Builds a fixed-length daily series ending today, zero-filled for days
// with no visits, so the trend chart always has a consistent x-axis
// instead of just plotting whatever days happen to have data.
export function buildDailySeries(visits: Visit[], days = 14): DailyPoint[] {
  const len = Math.min(Math.max(days, 1), 90);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const buckets = new Map<string, { date: Date; visits: number; visitors: Set<string> }>();
  for (let i = len - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(dayKey(d), { date: d, visits: 0, visitors: new Set() });
  }

  for (const v of visits) {
    const d = toDate(v.ts);
    if (!d) continue;
    const bucket = buckets.get(dayKey(d));
    if (!bucket) continue; // outside the window
    bucket.visits += 1;
    bucket.visitors.add(v.visitorId || v.id);
  }

  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    label: b.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    visits: b.visits,
    uniques: b.visitors.size,
  }));
}

export interface RankedItem {
  label: string;
  count: number;
  pct: number; // 0-100, share of total within this breakdown
}

function rank(values: (string | undefined | null)[], fallback: string, limit = 5): RankedItem[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const label = raw && raw.trim() ? raw.trim() : fallback;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const total = values.length || 1;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }));
}

export function topPages(visits: Visit[], limit = 5): RankedItem[] {
  return rank(visits.map((v) => v.path || '/'), '/', limit);
}

export function topReferrers(visits: Visit[], limit = 5): RankedItem[] {
  return rank(
    visits.map((v) => (v.referrer && v.referrer !== '' ? v.referrer : 'Direct')),
    'Direct',
    limit
  );
}

export function deviceBreakdown(visits: Visit[], limit = 5): RankedItem[] {
  return rank(visits.map((v) => v.device || 'Unknown'), 'Unknown', limit);
}

export function countryBreakdown(visits: Visit[], limit = 5): RankedItem[] {
  return rank(visits.map((v) => v.country || 'Unknown'), 'Unknown', limit);
}

export function campaignBreakdown(visits: Visit[], limit = 5): RankedItem[] {
  return rank(
    visits.map((v) => (v.utmCampaign && v.utmCampaign.trim() ? v.utmCampaign : null)).filter((v) => v !== null) as string[],
    'None',
    limit
  );
}

export function utmSourceBreakdown(visits: Visit[], limit = 5): RankedItem[] {
  return rank(
    visits.map((v) => (v.utmSource && v.utmSource.trim() ? v.utmSource : null)).filter((v) => v !== null) as string[],
    'None',
    limit
  );
}

// ── Exit pages ──────────────────────────────────────────────────────
// Symmetric to `landing` (the first page of a session) but derived
// client-side rather than stored: the LAST visit doc (by ts) within
// each sessionId is that session's exit page. No new backend signal
// needed — every Visit already carries sessionId and ts; this is
// purely "group by session, take the max-ts row, rank its path."
// Sessions with no sessionId (older visits recorded before that field
// existed, or a visit whose beacon somehow omitted it) are excluded
// entirely rather than guessed at, since a single orphaned visit has
// no way to know if it was really the last page viewed.
export function topExitPages(visits: Visit[], limit = 5): RankedItem[] {
  const bySession = new Map<string, { path: string; ts: number }>();
  for (const v of visits) {
    if (!v.sessionId) continue;
    const t = toDate(v.ts)?.getTime();
    if (t === undefined || t === null) continue;
    const existing = bySession.get(v.sessionId);
    if (!existing || t > existing.ts) {
      bySession.set(v.sessionId, { path: v.path || '/', ts: t });
    }
  }
  return rank(Array.from(bySession.values()).map((s) => s.path), '/', limit);
}

// ── Session-level rollup ──────────────────────────────────────────────
// Pages/session, average session duration, and bounce rate — all
// derived purely from grouping the existing Visit[] by sessionId, the
// same field every visit already carries. "Duration" is the span
// between a session's first and last visit ts (a lower bound — it
// can't know about engagement past the last tracked page view, same
// caveat as every other duration metric built only from page-view
// timestamps rather than a dedicated session-end beacon). A session is
// a "bounce" if it has exactly one tracked page view.
export interface SessionStats {
  sessionCount: number;
  avgPagesPerSession: number;
  avgSessionDurationSeconds: number;
  bounceRatePct: number; // 0-100
}

export function sessionRollup(visits: Visit[]): SessionStats {
  const bySession = new Map<string, number[]>(); // sessionId -> sorted list of ts (ms)
  for (const v of visits) {
    if (!v.sessionId) continue;
    const t = toDate(v.ts)?.getTime();
    if (t === undefined || t === null) continue;
    const arr = bySession.get(v.sessionId) || [];
    arr.push(t);
    bySession.set(v.sessionId, arr);
  }

  const sessionCount = bySession.size;
  if (sessionCount === 0) {
    return { sessionCount: 0, avgPagesPerSession: 0, avgSessionDurationSeconds: 0, bounceRatePct: 0 };
  }

  let totalPages = 0;
  let totalDurationMs = 0;
  let bounces = 0;
  for (const arr of bySession.values()) {
    arr.sort((a, b) => a - b);
    totalPages += arr.length;
    if (arr.length === 1) bounces += 1;
    totalDurationMs += arr[arr.length - 1] - arr[0];
  }

  return {
    sessionCount,
    avgPagesPerSession: Math.round((totalPages / sessionCount) * 10) / 10,
    avgSessionDurationSeconds: Math.round(totalDurationMs / sessionCount / 1000),
    bounceRatePct: Math.round((bounces / sessionCount) * 100),
  };
}

// ── RUM (Real User Monitoring) by page ─────────────────────────────────
// p75 pageLoadMs grouped by path — pageLoadMs is already captured by
// public/sitevento.js's capturePageLoadMs and already rides the
// visit-end beacon (see lib/types.ts's Visit.pageLoadMs comment), so
// this is purely a client-side aggregation over data that's already
// there. p75 (not average) on purpose: load-time distributions are
// heavily right-skewed (a handful of very slow loads drag the mean up
// far more than they should), and p75 is the industry-standard choice
// for "most visitors experience this or better" (same percentile Core
// Web Vitals itself reports on).
export interface RumPageStat {
  path: string;
  p75Ms: number;
  sampleCount: number;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[Math.max(0, idx)];
}

export function rumByPage(visits: Visit[], limit = 5, minSamples = 1): RumPageStat[] {
  const byPath = new Map<string, number[]>();
  for (const v of visits) {
    if (typeof v.pageLoadMs !== 'number' || v.pageLoadMs < 0) continue;
    const path = v.path || '/';
    const arr = byPath.get(path) || [];
    arr.push(v.pageLoadMs);
    byPath.set(path, arr);
  }

  const rows: RumPageStat[] = [];
  for (const [path, values] of byPath.entries()) {
    if (values.length < minSamples) continue;
    const sorted = [...values].sort((a, b) => a - b);
    rows.push({ path, p75Ms: Math.round(percentile(sorted, 75)), sampleCount: values.length });
  }

  return rows.sort((a, b) => b.p75Ms - a.p75Ms).slice(0, limit);
}

// Visits in the last N hours vs the N hours before that — the small
// up/down delta shown next to each KPI, same spirit as Siterifty's
// kpi-change pill.
export function trendDelta(visits: Visit[], hours = 24): { pct: number; direction: 'up' | 'down' | 'flat' } {
  const now = Date.now();
  const windowMs = hours * 3600_000;
  let recent = 0;
  let prior = 0;
  for (const v of visits) {
    const d = toDate(v.ts);
    if (!d) continue;
    const age = now - d.getTime();
    if (age >= 0 && age < windowMs) recent += 1;
    else if (age >= windowMs && age < windowMs * 2) prior += 1;
  }
  if (prior === 0) {
    if (recent === 0) return { pct: 0, direction: 'flat' };
    return { pct: 100, direction: 'up' };
  }
  const pct = Math.round(((recent - prior) / prior) * 100);
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

// ── Retention cohorts ────────────────────────────────────────────────
// Takes VisitorProfile[], not Visit[] — the only function in this file
// that does, since this needs ONE row per real person (firstSeenAt,
// lastSeenAt), not one row per page view. hooks/useVisitorProfiles.ts
// already subscribes to exactly this collection for the Users page, so
// this reuses that same live data — no new Firestore reads, same
// "pure client-side derivation over data that's already there" spirit
// as every other function in this file.
//
// Classic weekly-cohort shape: group visitors by the LOCAL calendar
// week they were first seen (their "cohort"), then for each cohort,
// what % of them were ALSO seen again in each subsequent week. Weekly
// (not daily) buckets on purpose — a daily grid dilutes fast for any
// site without very high traffic (most cells read "1 of 1, 100%" or
// "0 of 1, blank"), where weekly buckets give each cohort enough
// people for the percentages to mean something sooner.
//
// IMPORTANT caveat this function cannot fix: retention here means
// "we saw this visitor again," via lastSeenAt — which is only ever as
// current as the last beacon that visitor's browser actually sent
// (see Visit's own "best-effort, by design" framing for exactly this
// kind of gap). A visitor who returns without yet having sent a fresh
// beacon this session (should never happen in practice — firstSeenAt/
// lastSeenAt update on first beacon) is not a real concern; the real
// caveat is the opposite direction — someone who returns is credited
// to whatever week their RETURN visit's lastSeenAt update lands in,
// which is correct and exactly what "retained in week N" should mean.

function startOfLocalWeek(d: Date): Date {
  // Monday-start week, same convention most analytics tools default
  // to (ISO 8601) rather than Sunday-start — arbitrary but needs to be
  // picked once and used consistently for cohort math to be internally
  // consistent.
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0 = Sunday ... 6 = Saturday
  const diff = (day === 0 ? -6 : 1) - day; // days to subtract/add to reach Monday
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export interface RetentionCohort {
  cohortWeek: string; // "2026-10-12" — the Monday of the week this cohort was first seen
  cohortLabel: string; // "Oct 12"
  cohortSize: number; // visitors first seen that week
  // Index 0 = the cohort's own first week (always 100% by definition,
  // included anyway so the UI can render a uniform grid without a
  // special case for column 0), index 1 = one week later, etc.
  retainedPct: (number | null)[]; // null = that week hasn't happened yet for this cohort (not "0% retained") — see weeksOut below
}

// Builds a fixed set of cohort rows (most recent `cohortWeeks` weeks
// that have at least one new visitor) x `weeksOut+1` columns. A cell
// is null, not 0, when that week-offset is still in the future for
// that particular cohort (e.g. a cohort from 2 weeks ago has no
// meaningful "retained at week 5" value yet) — the dashboard must
// render null as a blank/dash, never as "0% retained," same
// "missing is not zero" framing lib/types.ts already uses for every
// best-effort engagement field on Visit.
export function retentionCohorts(profiles: VisitorProfile[], cohortWeeks = 8, weeksOut = 6): RetentionCohort[] {
  const nowWeekStart = startOfLocalWeek(new Date());

  // Bucket visitors by their first-seen week, keeping each visitor's
  // own firstSeenAt/lastSeenAt week offsets rather than raw dates, so
  // the retention check below is simple integer comparison.
  const byCohort = new Map<string, { firstWeekStart: Date; visitors: { lastSeenWeekOffset: number }[] }>();

  for (const p of profiles) {
    const first = toDate(p.firstSeenAt);
    if (!first) continue; // no usable signup date — excluded, not counted as an unretained cohort member
    const cohortStart = startOfLocalWeek(first);
    const key = dayKey(cohortStart);
    let entry = byCohort.get(key);
    if (!entry) {
      entry = { firstWeekStart: cohortStart, visitors: [] };
      byCohort.set(key, entry);
    }
    const last = toDate(p.lastSeenAt) || first; // a profile with no lastSeenAt yet has only ever been seen once — that's their own first-week visit
    const lastWeekStart = startOfLocalWeek(last);
    const weekOffset = Math.round((lastWeekStart.getTime() - cohortStart.getTime()) / (7 * 86400_000));
    entry.visitors.push({ lastSeenWeekOffset: Math.max(0, weekOffset) });
  }

  // Most recent `cohortWeeks` cohorts that actually have members,
  // newest first — an owner cares most about recent signups, and an
  // empty site (no visitors some week) shouldn't render a blank row.
  const sortedCohortKeys = Array.from(byCohort.keys()).sort((a, b) => (a < b ? 1 : -1));
  const chosenKeys = sortedCohortKeys.slice(0, Math.max(1, Math.min(cohortWeeks, 52)));

  return chosenKeys.map((key) => {
    const { firstWeekStart, visitors } = byCohort.get(key)!;
    const cohortSize = visitors.length;
    const maxOffsetSoFar = Math.round((nowWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 86400_000));

    const retainedPct: (number | null)[] = [];
    for (let offset = 0; offset <= weeksOut; offset++) {
      if (offset > maxOffsetSoFar) {
        retainedPct.push(null); // this week-offset hasn't happened yet for this cohort
        continue;
      }
      if (cohortSize === 0) {
        retainedPct.push(0);
        continue;
      }
      // "Retained at week N" = last seen in week N or later — a
      // visitor who returned in week 2 and never came back again still
      // counts as retained at week 1 (they were present then), the
      // same ">=" convention every standard cohort-retention chart
      // uses, not "returned in EXACTLY week N."
      const retained = visitors.filter((v) => v.lastSeenWeekOffset >= offset).length;
      retainedPct.push(Math.round((retained / cohortSize) * 100));
    }

    return {
      cohortWeek: key,
      cohortLabel: firstWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cohortSize,
      retainedPct,
    };
  });
}
