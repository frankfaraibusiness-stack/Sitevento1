// lib/analytics.ts
//
// Pure, client-side derivations over the Visit[] array the dashboard
// already subscribes to (useActiveSiteData) — no new Firestore reads,
// no backend changes. Powers the Analytics tab's trend chart and
// breakdown lists (top pages, referrers, devices/browsers, countries).
import type { Visit } from './types';

function toDate(ts: Visit['ts']): Date | null {
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
