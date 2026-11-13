// components/analytics/model/behaviour.ts
//
// Visitor-side computations: channels, audience, retention, speed, sessions,
// searches. Pure functions over NormVisit[] (+ backend events where a number
// needs the customer's server to confirm it).
import type { NormVisit } from '@/lib/dashboardStats';
import { referrerHost } from '@/lib/dashboardStats';
import type { BackendEvent, SiteCustomEvent } from '../useAnalyticsExtras';

const WEEK = 7 * 86_400_000;

/* ── Channels ────────────────────────────────────────────────────── */
const SEARCH_RE = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave|startpage|ask)\./i;
const SOCIAL_RE = /(facebook|instagram|twitter|^x\.com|^t\.co|linkedin|lnkd|reddit|pinterest|tiktok|youtube|youtu\.be|threads|whatsapp|telegram|discord|snapchat)/i;

export function channelOf(source: string | null, medium: string | null, referrer: string): string {
  const m = (medium ?? '').toLowerCase();
  const s = (source ?? '').toLowerCase();
  if (/^(cpc|ppc|paid[-_ ]?search|paidsearch|sem)$/.test(m)) return 'Paid search';
  if (/paid[-_ ]?social|paidsocial|social[-_ ]?paid/.test(m)) return 'Paid social';
  if (/^(display|banner|cpm|retargeting)$/.test(m)) return 'Display';
  if (/^e?-?mail|newsletter/.test(m) || /newsletter|mailchimp|klaviyo/.test(s)) return 'Email';
  if (m === 'affiliate') return 'Affiliate';
  if (m === 'social' || m === 'organic_social') return 'Organic social';
  if (m === 'organic' || m === 'organic_search') return 'Organic search';
  const host = referrerHost(referrer);
  if (!source && host === 'Direct') return 'Direct';
  const probe = source ? s : host;
  if (SEARCH_RE.test(`${probe}.`) || SEARCH_RE.test(`${host}.`) || /^(google|bing|duckduckgo|yahoo)$/.test(s)) return 'Organic search';
  if (SOCIAL_RE.test(probe) || SOCIAL_RE.test(host)) return 'Organic social';
  if (host === 'Direct') return 'Direct';
  return 'Referral';
}

export const CHANNEL_COLORS: Record<string, string> = {
  'Organic search': '#14995f',
  Direct: '#6c7083',
  'Organic social': '#0f9aa6',
  'Paid social': '#c43e78',
  'Paid search': '#b67a16',
  Email: '#6a4fe0',
  Referral: '#8a6ff2',
  Display: '#d1344f',
  Affiliate: '#4a7bd8',
};
const PALETTE = ['#6a4fe0', '#0f9aa6', '#14995f', '#c43e78', '#b67a16', '#8a6ff2', '#6c7083', '#4a7bd8'];
export const colorFor = (name: string, i: number) => CHANNEL_COLORS[name] ?? PALETTE[i % PALETTE.length];

export interface Attribution {
  channel: string;
  source: string;
  medium: string | null;
  campaign: string | null;
}

/** First-touch attribution per visitor, from the earliest visit loaded for them. */
export function attributions(visits: NormVisit[]): Map<string, Attribution> {
  const first = new Map<string, NormVisit>();
  for (const v of visits) {
    if (v.blocked) continue;
    const cur = first.get(v.visitorId);
    if (!cur || v.ts < cur.ts) first.set(v.visitorId, v);
  }
  const out = new Map<string, Attribution>();
  first.forEach((v, id) => {
    const host = referrerHost(v.referrer);
    out.set(id, {
      channel: channelOf(v.utmSource, v.utmMedium, v.referrer),
      source: v.utmSource ?? host,
      medium: v.utmMedium,
      campaign: v.utmCampaign,
    });
  });
  return out;
}

/* ── Sessions ────────────────────────────────────────────────────── */
export interface SessionInfo {
  id: string;
  start: number;
  pages: number;
  durationSec: number;
  dark: boolean | null;
}

export function sessionsOf(visits: NormVisit[]): SessionInfo[] {
  const m = new Map<string, NormVisit[]>();
  for (const v of visits) {
    if (v.blocked) continue;
    const arr = m.get(v.sessionId);
    if (arr) arr.push(v);
    else m.set(v.sessionId, [v]);
  }
  const out: SessionInfo[] = [];
  m.forEach((arr, id) => {
    arr.sort((a, b) => a.ts - b.ts);
    const last = arr[arr.length - 1];
    const span = (last.ts - arr[0].ts) / 1000;
    const tail = last.activeSeconds ?? 0;
    const scheme = arr.find((x) => x.colorScheme)?.colorScheme ?? null;
    out.push({ id, start: arr[0].ts, pages: arr.length, durationSec: Math.min(30 * 60, span + Math.min(tail, 600)), dark: scheme === null ? null : scheme === 'dark' });
  });
  return out;
}

export const SESSION_BUCKETS: { label: string; max: number }[] = [
  { label: '<10s', max: 10 },
  { label: '10-30s', max: 30 },
  { label: '30s-2m', max: 120 },
  { label: '2-5m', max: 300 },
  { label: '5-15m', max: 900 },
  { label: '15-30m', max: 1800 },
  { label: '30m+', max: Infinity },
];

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1))];
}

/* ── Retention ───────────────────────────────────────────────────── */
export interface RetentionResult {
  weeks: { label: string; pct: number }[];
  cohortSize: number;
  basis: 'accounts' | 'visitors';
}

/** Pooled week-N return rate: of everyone first seen in week k, who was active again in week k+N. */
function pooled(first: Map<string, number>, activity: Map<string, Set<number>>, origin: number, lastWeek: number): { pct: number[]; size: number } {
  const num = new Array(8).fill(0);
  const den = new Array(8).fill(0);
  first.forEach((ts, id) => {
    const k = Math.floor((ts - origin) / WEEK);
    const acts = activity.get(id);
    for (let nWeek = 0; nWeek < 8; nWeek++) {
      if (k + nWeek > lastWeek) break;
      den[nWeek] += 1;
      if (nWeek === 0 || acts?.has(k + nWeek)) num[nWeek] += 1;
    }
  });
  return { pct: num.map((x, i) => (den[i] ? Math.round((x / den[i]) * 100) : -1)), size: first.size };
}

export function retentionFor(visits: NormVisit[], backend: BackendEvent[], from: number, to: number): RetentionResult | null {
  // Prefer real accounts (sign-up → login) when the backend sends both.
  const signups = new Map<string, number>();
  const logins = new Map<string, Set<number>>();
  const origin = from;
  for (const e of backend) {
    if (!e.userId) continue;
    if (e.event === 'user.signed_up' && e.at >= from && e.at < to) signups.set(e.userId, e.at);
    if (e.event === 'user.logged_in') {
      const w = Math.floor((e.at - origin) / WEEK);
      const s = logins.get(e.userId) ?? new Set<number>();
      s.add(w);
      logins.set(e.userId, s);
    }
  }
  const lastWeek = Math.floor((to - 1 - origin) / WEEK);
  if (signups.size >= 10 && lastWeek >= 1) {
    const r = pooled(signups, logins, origin, lastWeek);
    const weeks = r.pct.map((p, i) => ({ label: i === 0 ? 'Wk 0' : `Wk ${i}`, pct: p })).filter((w) => w.pct >= 0);
    if (weeks.length >= 2) return { weeks, cohortSize: r.size, basis: 'accounts' };
  }

  const first = new Map<string, number>();
  const act = new Map<string, Set<number>>();
  for (const v of visits) {
    if (v.blocked) continue;
    const cur = first.get(v.visitorId);
    if (cur === undefined || v.ts < cur) first.set(v.visitorId, v.ts);
    const w = Math.floor((v.ts - origin) / WEEK);
    const s = act.get(v.visitorId) ?? new Set<number>();
    s.add(w);
    act.set(v.visitorId, s);
  }
  if (first.size < 10 || lastWeek < 1) return null;
  const r = pooled(first, act, origin, lastWeek);
  const weeks = r.pct.map((p, i) => ({ label: i === 0 ? 'Wk 0' : `Wk ${i}`, pct: p })).filter((w) => w.pct >= 0);
  return weeks.length >= 2 ? { weeks, cohortSize: r.size, basis: 'visitors' } : null;
}

/* ── Searches ────────────────────────────────────────────────────── */
export interface SearchModel {
  total: number;
  foundRate: number | null;
  terms: { term: string; count: number }[];
  noResults: { term: string; count: number }[];
}

export function searchesFor(custom: SiteCustomEvent[], backend: BackendEvent[], from: number, to: number): SearchModel {
  const rows: { term: string; results: number | null }[] = [];
  for (const c of custom) {
    if (c.name !== 'search' || c.ts < from || c.ts >= to) continue;
    const term = typeof c.properties.term === 'string' ? c.properties.term.trim().toLowerCase() : '';
    if (!term) continue;
    rows.push({ term, results: typeof c.properties.results === 'number' ? c.properties.results : null });
  }
  for (const e of backend) {
    if (e.event !== 'search.performed' || e.at < from || e.at >= to) continue;
    rows.push({ term: String(e.data.term ?? ''), results: typeof e.data.results === 'number' ? e.data.results : null });
  }
  const all = new Map<string, number>();
  const none = new Map<string, number>();
  let known = 0;
  let found = 0;
  for (const r of rows) {
    if (!r.term) continue;
    all.set(r.term, (all.get(r.term) || 0) + 1);
    if (r.results !== null) {
      known += 1;
      if (r.results > 0) found += 1;
      else none.set(r.term, (none.get(r.term) || 0) + 1);
    }
  }
  const top = (m: Map<string, number>, k: number) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([term, count]) => ({ term, count }));
  return { total: rows.length, foundRate: known ? found / known : null, terms: top(all, 10), noResults: top(none, 5) };
}
