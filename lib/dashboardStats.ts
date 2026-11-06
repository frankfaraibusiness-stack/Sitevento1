// lib/dashboardStats.ts
//
// Pure, side-effect-free derivations behind the main dashboard
// (components/dashboard/DashboardShell.tsx). Takes the visits that
// hooks/useDashboardData.ts already loaded and turns them into series,
// rankings, session metrics and a day-of-week × hour heatmap. No
// Firestore access here — every number is computed from what's passed in.
import { dayKey, startOfDay, type ResolvedRange } from './dashboardRange';

export interface NormVisit {
  id: string;
  ts: number;
  path: string;
  referrer: string;
  device: string;
  browser: string;
  os: string;
  lang: string;
  landing: boolean;
  sessionId: string;
  country: string;
  city: string;
  visitorId: string;
  blocked: boolean;
}

export function toMs(ts: unknown): number | null {
  if (!ts) return null;
  if (typeof ts === 'number') return isFinite(ts) ? ts : null;
  if (typeof ts === 'object') {
    const t = ts as { toMillis?: () => number; toDate?: () => Date };
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.toDate === 'function') return t.toDate().getTime();
  }
  return null;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

export function normalizeVisit(id: string, d: Record<string, unknown>): NormVisit | null {
  const ts = toMs(d.ts);
  if (ts === null) return null;
  const visitorId = str(d.visitorId, id);
  return {
    id,
    ts,
    path: str(d.path, '/'),
    referrer: str(d.referrer, 'Direct'),
    device: str(d.device, 'Unknown'),
    browser: str(d.browser, 'Unknown'),
    os: str(d.os, 'Unknown'),
    lang: str(d.lang, ''),
    landing: d.landing === true,
    sessionId: str(d.sessionId, '') || `${visitorId}:${dayKey(new Date(ts))}`,
    country: str(d.country, ''),
    city: str(d.city, ''),
    visitorId,
    blocked: d.blocked === true,
  };
}

export function referrerHost(raw: string): string {
  if (!raw || raw === 'Direct') return 'Direct';
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '');
    return host || 'Direct';
  } catch {
    return raw.slice(0, 40);
  }
}

let languageNames: Intl.DisplayNames | null | undefined;
export function languageLabel(raw: string): string {
  if (!raw) return 'Unknown';
  const code = raw.split(/[-_]/)[0].toLowerCase();
  try {
    if (languageNames === undefined) {
      languageNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'language' }) : null;
    }
    return languageNames?.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export interface RankedRow {
  key: string;
  label: string;
  count: number;
  pct: number; // 0–100, share of the ranked total
  sub?: string;
}

function rank(values: string[], limit: number, labelOf: (k: string) => string = (k) => k): RankedRow[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const total = values.length || 1;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, label: labelOf(key), count, pct: (count / total) * 100 }));
}

export interface CountryRow {
  code: string; // '' = unknown
  visits: number;
  visitors: number;
  pct: number;
}

export interface SeriesPoint {
  t: number;
  label: string;
  long: string;
  visits: number;
  uniques: number;
  blocked: number;
  clicks: number;
}

export interface HeatGrid {
  cells: number[][]; // [dow 0=Mon..6=Sun][hour 0..23]
  max: number;
  peakDow: number;
  peakHour: number;
  total: number;
}

export interface VisitAggregates {
  loaded: number;
  uniqueLoaded: number;
  sessions: number;
  bounceRate: number | null; // 0–1
  pagesPerSession: number | null;
  avgSessionSec: number | null;
  blockedLoaded: number;
  landings: number;
  series: SeriesPoint[];
  step: 'hour' | 'day' | 'week' | 'month';
  clicksTotal: number;
  clicksAvailable: boolean;
  countries: CountryRow[];
  pages: RankedRow[];
  entryPages: RankedRow[];
  referrers: RankedRow[];
  devices: RankedRow[];
  browsers: RankedRow[];
  systems: RankedRow[];
  languages: RankedRow[];
  cities: RankedRow[];
  heat: HeatGrid;
  activeNow: number;
  recent: NormVisit[];
}

type Step = 'hour' | 'day' | 'week' | 'month';

function pickStep(spanDays: number, hourly: boolean): Step {
  if (hourly) return 'hour';
  if (spanDays <= 92) return 'day';
  if (spanDays <= 400) return 'week';
  return 'month';
}

function floorTo(d: Date, step: Step): Date {
  const x = new Date(d);
  if (step === 'hour') {
    x.setMinutes(0, 0, 0);
    return x;
  }
  x.setHours(0, 0, 0, 0);
  if (step === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  if (step === 'month') x.setDate(1);
  return x;
}

function nextOf(d: Date, step: Step): Date {
  const x = new Date(d);
  if (step === 'hour') x.setHours(x.getHours() + 1);
  else if (step === 'day') x.setDate(x.getDate() + 1);
  else if (step === 'week') x.setDate(x.getDate() + 7);
  else x.setMonth(x.getMonth() + 1);
  return x;
}

function labelsFor(d: Date, step: Step): { label: string; long: string } {
  if (step === 'hour') {
    return {
      label: d.toLocaleTimeString(undefined, { hour: 'numeric' }),
      long: d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' }),
    };
  }
  if (step === 'month') {
    return {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      long: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  }
  const short = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return {
    label: short,
    long:
      step === 'week'
        ? `Week of ${short}`
        : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
  };
}

const SESSION_CAP_SEC = 30 * 60;
const ACTIVE_WINDOW_MS = 5 * 60_000;

export function aggregateVisits(
  visits: NormVisit[],
  range: ResolvedRange,
  opts: {
    /** Oldest timestamp actually covered by `visits` when the load was truncated; null when everything in range is loaded. */
    coveredFrom: number | null;
    clicksByDay: Record<string, number>;
    now: number;
  }
): VisitAggregates {
  const { now, clicksByDay, coveredFrom } = opts;

  const visitors = new Set<string>();
  const sessions = new Map<string, { n: number; min: number; max: number }>();
  const countryMap = new Map<string, { visits: number; visitors: Set<string> }>();
  const heat: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let oldest = Infinity;
  let blockedLoaded = 0;
  let landings = 0;
  const activeSet = new Set<string>();

  for (const v of visits) {
    visitors.add(v.visitorId);
    if (v.ts < oldest) oldest = v.ts;
    if (v.blocked) blockedLoaded += 1;
    if (v.landing) landings += 1;
    if (now - v.ts <= ACTIVE_WINDOW_MS && !v.blocked) activeSet.add(v.visitorId);

    const s = sessions.get(v.sessionId);
    if (s) {
      s.n += 1;
      if (v.ts < s.min) s.min = v.ts;
      if (v.ts > s.max) s.max = v.ts;
    } else {
      sessions.set(v.sessionId, { n: 1, min: v.ts, max: v.ts });
    }

    const c = countryMap.get(v.country);
    if (c) {
      c.visits += 1;
      c.visitors.add(v.visitorId);
    } else {
      countryMap.set(v.country, { visits: 1, visitors: new Set([v.visitorId]) });
    }

    const dt = new Date(v.ts);
    heat[(dt.getDay() + 6) % 7][dt.getHours()] += 1;
  }

  // ── Sessions ────────────────────────────────────────────────────
  let bounced = 0;
  let multiSec = 0;
  let multiCount = 0;
  sessions.forEach((s) => {
    if (s.n === 1) bounced += 1;
    else {
      multiSec += Math.min((s.max - s.min) / 1000, SESSION_CAP_SEC);
      multiCount += 1;
    }
  });
  const sessionCount = sessions.size;

  // ── Series ──────────────────────────────────────────────────────
  const rangeStartMs = range.start ? range.start.getTime() : isFinite(oldest) ? oldest : now;
  const seriesStartMs = Math.max(rangeStartMs, coveredFrom ?? 0);
  const seriesEndMs = Math.min(range.end.getTime(), now + 1);
  const spanDays = Math.max(1, Math.round((seriesEndMs - seriesStartMs) / 86_400_000));
  const step = pickStep(spanDays, range.hourly);

  const bucketStarts: Date[] = [];
  let cursor = floorTo(new Date(seriesStartMs), step);
  while (cursor.getTime() < seriesEndMs && bucketStarts.length < 400) {
    bucketStarts.push(cursor);
    cursor = nextOf(cursor, step);
  }
  const index = new Map<number, number>();
  const clicksAvailable = step !== 'hour';
  const series: SeriesPoint[] = bucketStarts.map((d, i) => {
    index.set(d.getTime(), i);
    const { label, long } = labelsFor(d, step);
    let clicks = 0;
    if (clicksAvailable) {
      const stop = nextOf(d, step);
      for (let c = new Date(d); c < stop; c.setDate(c.getDate() + 1)) clicks += clicksByDay[dayKey(c)] || 0;
    }
    return { t: d.getTime(), label, long, visits: 0, uniques: 0, blocked: 0, clicks };
  });
  const bucketVisitors: Set<string>[] = series.map(() => new Set<string>());
  for (const v of visits) {
    const i = index.get(floorTo(new Date(v.ts), step).getTime());
    if (i === undefined) continue;
    series[i].visits += 1;
    if (v.blocked) series[i].blocked += 1;
    bucketVisitors[i].add(v.visitorId);
  }
  series.forEach((p, i) => {
    p.uniques = bucketVisitors[i].size;
  });

  // ── Clicks across the whole range (independent of loaded visits) ─
  let clicksTotal = 0;
  const startKey = range.start ? dayKey(range.start) : '0000-00-00';
  const endKey = dayKey(range.end); // exclusive
  for (const [k, n] of Object.entries(clicksByDay)) {
    if (k >= startKey && k < endKey) clicksTotal += n;
  }

  // ── Rankings ────────────────────────────────────────────────────
  const total = visits.length || 1;
  const countries: CountryRow[] = Array.from(countryMap.entries())
    .map(([code, v]) => ({ code, visits: v.visits, visitors: v.visitors.size, pct: (v.visits / total) * 100 }))
    .sort((a, b) => b.visits - a.visits);

  let max = 0;
  let peakDow = 0;
  let peakHour = 0;
  let heatTotal = 0;
  heat.forEach((row, dow) =>
    row.forEach((n, hour) => {
      heatTotal += n;
      if (n > max) {
        max = n;
        peakDow = dow;
        peakHour = hour;
      }
    })
  );

  const landingVisits = visits.filter((v) => v.landing);

  return {
    loaded: visits.length,
    uniqueLoaded: visitors.size,
    sessions: sessionCount,
    bounceRate: sessionCount > 0 ? bounced / sessionCount : null,
    pagesPerSession: sessionCount > 0 ? visits.length / sessionCount : null,
    avgSessionSec: multiCount > 0 ? multiSec / multiCount : null,
    blockedLoaded,
    landings,
    series,
    step,
    clicksTotal,
    clicksAvailable,
    countries,
    pages: rank(visits.map((v) => v.path), 8),
    entryPages: rank(landingVisits.map((v) => v.path), 8),
    referrers: rank(visits.map((v) => referrerHost(v.referrer)), 8),
    devices: rank(visits.map((v) => v.device), 6),
    browsers: rank(visits.map((v) => v.browser), 6),
    systems: rank(visits.map((v) => v.os), 6),
    languages: rank(visits.map((v) => v.lang), 6, languageLabel),
    cities: rank(
      visits.filter((v) => v.city).map((v) => `${v.city}${v.country ? `, ${v.country}` : ''}`),
      8
    ),
    heat: { cells: heat, max, peakDow, peakHour, total: heatTotal },
    activeNow: activeSet.size,
    recent: visits.slice(0, 5),
  };
}

// ── Formatting helpers shared by the dashboard components ──────────

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${(n / 1000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString();
}

export function fmtDecimal(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function fmtPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !isFinite(ratio)) return '—';
  return `${(ratio * 100).toLocaleString(undefined, { maximumFractionDigits: digits })}%`;
}

export function fmtDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !isFinite(sec)) return '—';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '$0.00';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: n < 100 ? 2 : 0 });
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function hourLabel(h: number): string {
  const d = startOfDay(new Date());
  d.setHours(h);
  return d.toLocaleTimeString(undefined, { hour: 'numeric' });
}
