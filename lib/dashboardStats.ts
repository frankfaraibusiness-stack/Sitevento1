// lib/dashboardStats.ts
//
// Pure, side-effect-free derivations behind the main dashboard
// (components/dashboard/DashboardShell.tsx). Takes the visits that
// hooks/useDashboardData.ts already loaded and turns them into series,
// rankings, session metrics and a day-of-week × hour heatmap. No
// Firestore access here — every number is computed from what's passed in.
import { dayKey, startOfDay, type ResolvedRange } from './dashboardRange';
import type { Lead } from './types';

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
  // Engagement summary — see lib/types.ts's Visit interface for the
  // full contract (populated by at most one app/api/visit-end beacon
  // per visit; absent on a fair share of real visits by design, since
  // that beacon is best-effort). null here means "no summary for this
  // visit", and every aggregate below that reads these fields must
  // average over only the visits that HAVE a value, never treat a
  // missing one as 0 — a visit with no scroll data is not the same as
  // a visit where the visitor scrolled 0%.
  scrollDepthPct: number | null;
  activeSeconds: number | null;
  validClicks: number | null;
  connectionType: string | null;
  pageLoadMs: number | null;
  rageClicks: number | null;
  // Campaign attribution (landing visit only) and richer client signals —
  // all optional/unknown-safe, same contract as the fields above.
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  screen: string | null;
  colorScheme: 'dark' | 'light' | null;
  // Core Web Vitals (field data), reported once per page load.
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  ttfbMs: number | null;
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
    scrollDepthPct: typeof d.scrollDepthPct === 'number' && isFinite(d.scrollDepthPct) ? d.scrollDepthPct : null,
    activeSeconds: typeof d.activeSeconds === 'number' && isFinite(d.activeSeconds) ? d.activeSeconds : null,
    validClicks: typeof d.validClicks === 'number' && isFinite(d.validClicks) ? d.validClicks : null,
    connectionType: str(d.connectionType, '') || null,
    pageLoadMs: typeof d.pageLoadMs === 'number' && isFinite(d.pageLoadMs) ? d.pageLoadMs : null,
    rageClicks: typeof d.rageClicks === 'number' && isFinite(d.rageClicks) ? d.rageClicks : null,
    utmSource: str(d.utmSource, '') || null,
    utmMedium: str(d.utmMedium, '') || null,
    utmCampaign: str(d.utmCampaign, '') || null,
    screen: str(d.screen, '') || null,
    colorScheme: d.colorScheme === 'dark' || d.colorScheme === 'light' ? d.colorScheme : null,
    lcpMs: typeof d.lcpMs === 'number' && isFinite(d.lcpMs) ? d.lcpMs : null,
    inpMs: typeof d.inpMs === 'number' && isFinite(d.inpMs) ? d.inpMs : null,
    cls: typeof d.cls === 'number' && isFinite(d.cls) ? d.cls : null,
    ttfbMs: typeof d.ttfbMs === 'number' && isFinite(d.ttfbMs) ? d.ttfbMs : null,
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
  // ── Engagement summary aggregates ──────────────────────────────
  // All derived ONLY from visits that actually carry an engagement
  // beacon (see NormVisit's own comment) — never padded with zeros
  // for visits where it's simply missing, which would silently drag
  // every average down toward 0 as adoption of the new beacon ramps
  // up across a site's existing traffic.
  avgScrollDepthPct: number | null; // mean of scrollDepthPct across visits that reported one
  avgActiveSec: number | null; // mean of activeSeconds across visits that reported one — a real, measured number, unlike avgSessionSec above (which is only ever an inferred proxy from gaps between pageview timestamps)
  engagementSampleSize: number; // how many of `loaded` visits actually had an engagement beacon — lets the dashboard show "based on N visits" rather than implying full coverage
  validClicksTotal: number;
  connectionTypes: RankedRow[]; // ranked over visits with a known connectionType only
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

  // ── Engagement summary aggregates ────────────────────────────────
  // Single pass, independent of the loop above (which doesn't touch
  // these fields) — kept separate rather than folded in since these
  // three are the only ones that need an "only count visits that
  // actually have a value" denominator distinct from `visits.length`.
  let scrollSum = 0;
  let scrollCount = 0;
  let activeSecSum = 0;
  let activeSecCount = 0;
  let validClicksTotal = 0;
  let engagementSampleSize = 0;
  const connectionTypeValues: string[] = [];
  for (const v of visits) {
    let hadAny = false;
    if (v.scrollDepthPct !== null) {
      scrollSum += v.scrollDepthPct;
      scrollCount += 1;
      hadAny = true;
    }
    if (v.activeSeconds !== null) {
      activeSecSum += v.activeSeconds;
      activeSecCount += 1;
      hadAny = true;
    }
    if (v.validClicks !== null) {
      validClicksTotal += v.validClicks;
      hadAny = true;
    }
    if (hadAny) engagementSampleSize += 1;
    if (v.connectionType) connectionTypeValues.push(v.connectionType);
  }

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
    avgScrollDepthPct: scrollCount > 0 ? scrollSum / scrollCount : null,
    avgActiveSec: activeSecCount > 0 ? activeSecSum / activeSecCount : null,
    engagementSampleSize,
    validClicksTotal,
    connectionTypes: rank(connectionTypeValues, 6, (k) => k.charAt(0).toUpperCase() + k.slice(1)),
  };
}

// ── Device experience intelligence ──────────────────────────────────
// Compares mobile/desktop/tablet on the handful of things an owner
// can actually act on: does this device convert, does it load fast,
// do visitors leave from it, and are its buttons responding. Built
// ENTIRELY from visits + leads the dashboard already downloaded for
// the period — no new Firestore reads, no new write volume, this is
// pure derivation over existing data (plus pageLoadMs/rageClicks).
//
// Every rate below is reported ONLY when its denominator is large
// enough to mean something (MIN_SAMPLE) — a device with 2 visits
// showing a "100% exit rate" would be technically true and completely
// misleading, so that device's numbers come back null (shown as "not
// enough data yet" in the UI) rather than a volatile, confident-
// looking value.
const MIN_SAMPLE = 5;

export interface DeviceExperienceRow {
  device: string; // 'Mobile' | 'Desktop' | 'Tablet' | any other value app/api/track ever writes
  visits: number;
  uniqueVisitors: number;
  sessions: number;
  // null = fewer than MIN_SAMPLE sessions/visits for this device in
  // range — not "zero", just not enough data to report honestly.
  conversionRate: number | null; // leads attributed to this device ÷ unique visitors on it
  avgLoadMs: number | null; // mean pageLoadMs across visits on this device that reported one
  loadSampleSize: number; // how many of this device's visits actually had a pageLoadMs
  exitRate: number | null; // sessions whose LAST page view was on this device ÷ sessions that touched this device at all
  rageClicksTotal: number; // sum of rageClicks across this device's visits — "buttons receiving clicks but not working"
  topPages: { path: string; visits: number; exitRate: number | null }[]; // this device's own pages, ranked by traffic, each with its own exit rate
  bestPages: { path: string; visits: number; exitRate: number }[]; // same device's pages with the LOWEST exit rate among those with enough traffic — the "most successful pages on this device" the feature spec asked for
}

export interface DeviceExperience {
  rows: DeviceExperienceRow[];
  sampleSize: number; // total visits this is built from
}

export function aggregateDeviceExperience(visits: NormVisit[], leads: Lead[]): DeviceExperience {
  const devices = new Map<string, NormVisit[]>();
  for (const v of visits) {
    const list = devices.get(v.device);
    if (list) list.push(v);
    else devices.set(v.device, [v]);
  }

  // ── Exit page per session, computed ONCE over ALL visits (not
  // per-device) so a session that happens to span devices is still
  // attributed to whichever device it ACTUALLY ended on. ─────────────
  const bySession = new Map<string, NormVisit[]>();
  for (const v of visits) {
    const list = bySession.get(v.sessionId);
    if (list) list.push(v);
    else bySession.set(v.sessionId, [v]);
  }
  const exitByDevice = new Map<string, number>(); // device -> count of sessions exiting there
  const touchedByDevice = new Map<string, number>(); // device -> count of sessions that touched it at all
  const exitPageBySessionDevice = new Map<string, number>(); // `${device}:${path}` -> exit count
  for (const [, sessVisits] of bySession) {
    sessVisits.sort((a, b) => a.ts - b.ts);
    const last = sessVisits[sessVisits.length - 1];
    exitByDevice.set(last.device, (exitByDevice.get(last.device) || 0) + 1);
    const key = `${last.device}:${last.path}`;
    exitPageBySessionDevice.set(key, (exitPageBySessionDevice.get(key) || 0) + 1);
    const touched = new Set(sessVisits.map((v) => v.device));
    for (const d of touched) touchedByDevice.set(d, (touchedByDevice.get(d) || 0) + 1);
  }

  // ── Leads by device — from Lead.device, the attribution
  // resolveLeadAttribution added (lib/leadAttribution.ts). A lead
  // with no device (captured before that field existed, or
  // attribution lookup missed) simply isn't counted toward ANY
  // device's conversion rate — never guessed into one. ───────────────
  const leadsByDevice = new Map<string, number>();
  for (const l of leads) {
    if (!l.device) continue;
    if (l.deletedAt) continue; // soft-deleted leads aren't real conversions any more than a soft-deleted anything else in this app
    leadsByDevice.set(l.device, (leadsByDevice.get(l.device) || 0) + 1);
  }

  const rows: DeviceExperienceRow[] = [];
  for (const [device, dVisits] of devices) {
    const uniqueVisitors = new Set(dVisits.map((v) => v.visitorId)).size;
    const sessionsForDevice = new Set(dVisits.map((v) => v.sessionId)).size;

    const loadValues = dVisits.map((v) => v.pageLoadMs).filter((v): v is number => v !== null);
    const avgLoadMs = loadValues.length > 0 ? loadValues.reduce((a, b) => a + b, 0) / loadValues.length : null;

    const touched = touchedByDevice.get(device) || 0;
    const exited = exitByDevice.get(device) || 0;
    const exitRate = touched >= MIN_SAMPLE ? exited / touched : null;

    const rageClicksTotal = dVisits.reduce((sum, v) => sum + (v.rageClicks || 0), 0);

    // Per-page breakdown, scoped to THIS device only.
    const pageVisitCounts = new Map<string, number>();
    for (const v of dVisits) pageVisitCounts.set(v.path, (pageVisitCounts.get(v.path) || 0) + 1);
    const topPages = Array.from(pageVisitCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, pvisits]) => {
        const exits = exitPageBySessionDevice.get(`${device}:${path}`) || 0;
        // Exit rate PER PAGE here is "share of this page's own visits
        // that were a session's last page view" — a different,
        // page-local denominator than the device-level exitRate
        // above (which divides by sessions, not visits). Both are
        // legitimate, commonly-used readings of "exit rate"; this one
        // answers "if someone's on this page, how likely do they
        // leave from here", which is what a per-page list needs.
        return { path, visits: pvisits, exitRate: pvisits >= MIN_SAMPLE ? exits / pvisits : null };
      });
    const bestPages = topPages
      .filter((p): p is { path: string; visits: number; exitRate: number } => p.exitRate !== null && p.visits >= MIN_SAMPLE)
      .sort((a, b) => a.exitRate - b.exitRate)
      .slice(0, 5);

    rows.push({
      device,
      visits: dVisits.length,
      uniqueVisitors,
      sessions: sessionsForDevice,
      conversionRate: uniqueVisitors >= MIN_SAMPLE ? (leadsByDevice.get(device) || 0) / uniqueVisitors : null,
      avgLoadMs,
      loadSampleSize: loadValues.length,
      exitRate,
      rageClicksTotal,
      topPages,
      bestPages,
    });
  }

  rows.sort((a, b) => b.visits - a.visits);
  return { rows, sampleSize: visits.length };
}

// ── Visitor journey intelligence ────────────────────────────────────
// Shows the actual paths visitors take — where they land, what they
// view next, where sessions end, and which specific sequences most
// often end in a lead. Entirely derived from the same visits +
// attributed leads every other aggregator on this page uses; no new
// data collection beyond what's already tracked (sessionId + ts
// ordering + Lead.visitorId are all that's needed).
//
// Deliberately capped to the first JOURNEY_STEP_CAP distinct pages of
// each session: a journey table ranking every possible full-length
// path a visitor could take would mostly show one-off noise (any two
// sessions rarely take the EXACT same 15-page tour) — capping to the
// first few steps is what makes "common journeys" a meaningful,
// non-empty ranking instead of every row having a count of 1.
const JOURNEY_STEP_CAP = 4;
const JOURNEY_MIN_COUNT = 2; // a "common journey" that only happened once isn't a pattern

export interface JourneyRow {
  steps: string[]; // ordered distinct pages, length 2–JOURNEY_STEP_CAP
  count: number; // how many sessions took exactly this path (within the step cap)
  ledToLeadCount: number; // of those sessions, how many are linked to a lead — see "successful journeys" below
}

export interface JourneyIntelligence {
  entryPages: RankedRow[]; // same ranking aggregateVisits already exposes, included here too so this is a self-contained read
  exitPages: RankedRow[]; // last page of each session, ranked — "where visitors abandon the site"
  topJourneys: JourneyRow[]; // most common step sequences
  successfulJourneys: JourneyRow[]; // same sequences, ranked by ledToLeadCount instead of raw count — "which journeys lead to purchases/signups" (concretely: lead capture is this app's only trackable conversion — see this function's own header)
  sessionsWithJourney: number; // denominator for the two rankings above
}

export function aggregateJourneys(visits: NormVisit[], leads: Lead[]): JourneyIntelligence {
  const bySession = new Map<string, NormVisit[]>();
  for (const v of visits) {
    const list = bySession.get(v.sessionId);
    if (list) list.push(v);
    else bySession.set(v.sessionId, [v]);
  }

  // A session "led to a lead" if some lead in this range shares its
  // visitorId AND the lead's own timestamp falls within this specific
  // session's span (±30 minutes grace on the end, since a capture
  // widget's own popup delay can fire well after the pageview beacon
  // that started the session). This is a heuristic, not a database
  // relationship (there is no sessionId stored on Lead) — good enough
  // to mark "a session from this visitor, around this time, ended in
  // a lead" without overclaiming precision beyond what the data
  // actually supports.
  const LEAD_SESSION_GRACE_MS = 30 * 60 * 1000;
  const leadsByVisitor = new Map<string, number[]>(); // visitorId -> sorted lead timestamps
  for (const l of leads) {
    if (!l.visitorId || l.deletedAt) continue;
    const ts = toMs(l.ts);
    if (ts === null) continue;
    const list = leadsByVisitor.get(l.visitorId);
    if (list) list.push(ts);
    else leadsByVisitor.set(l.visitorId, [ts]);
  }
  for (const list of leadsByVisitor.values()) list.sort((a, b) => a - b);

  function sessionLedToLead(sessVisits: NormVisit[]): boolean {
    const visitorId = sessVisits[0]?.visitorId;
    if (!visitorId) return false;
    const leadTimes = leadsByVisitor.get(visitorId);
    if (!leadTimes || leadTimes.length === 0) return false;
    const start = sessVisits[0].ts;
    const end = sessVisits[sessVisits.length - 1].ts;
    return leadTimes.some((lt) => lt >= start && lt <= end + LEAD_SESSION_GRACE_MS);
  }

  const exitPaths: string[] = [];
  const journeyCounts = new Map<string, { steps: string[]; count: number; ledToLeadCount: number }>();
  let sessionsWithJourney = 0;

  for (const [, raw] of bySession) {
    const sessVisits = [...raw].sort((a, b) => a.ts - b.ts);
    exitPaths.push(sessVisits[sessVisits.length - 1].path);

    // Collapse consecutive duplicate pages (an SPA re-render that
    // calls sendVisit() again for the same path isn't a new "step" in
    // the journey) and cap to the first JOURNEY_STEP_CAP distinct
    // pages — see this section's header for why.
    const steps: string[] = [];
    for (const v of sessVisits) {
      if (steps[steps.length - 1] !== v.path) steps.push(v.path);
      if (steps.length >= JOURNEY_STEP_CAP) break;
    }
    if (steps.length < 2) continue; // a single-page session has no "journey" to speak of
    sessionsWithJourney += 1;

    const key = steps.join(' \u2192 ');
    const ledToLead = sessionLedToLead(sessVisits);
    const existing = journeyCounts.get(key);
    if (existing) {
      existing.count += 1;
      if (ledToLead) existing.ledToLeadCount += 1;
    } else {
      journeyCounts.set(key, { steps, count: 1, ledToLeadCount: ledToLead ? 1 : 0 });
    }
  }

  const allJourneys = Array.from(journeyCounts.values()).filter((j) => j.count >= JOURNEY_MIN_COUNT);
  const topJourneys = [...allJourneys].sort((a, b) => b.count - a.count).slice(0, 10);
  const successfulJourneys = allJourneys
    .filter((j) => j.ledToLeadCount > 0)
    .sort((a, b) => b.ledToLeadCount - a.ledToLeadCount || b.ledToLeadCount / b.count - a.ledToLeadCount / a.count)
    .slice(0, 10);

  return {
    entryPages: rank(
      visits.filter((v) => v.landing).map((v) => v.path),
      8
    ),
    exitPages: rank(exitPaths, 8),
    topJourneys,
    successfulJourneys,
    sessionsWithJourney,
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

// Dedicated formatter for millisecond-scale durations (page load time)
// — fmtDuration below rounds to whole seconds, which is fine for
// session length but would show "0s" for a perfectly normal ~400ms
// load and hide exactly the differences (300ms vs 900ms) a site
// owner most needs to see here.
export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
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
