// components/analytics/model/build.ts
//
// buildModel(): turns the loaded visits (hooks/useDashboardData.ts), the
// backend events + other collections (useAnalyticsExtras.ts) and the
// selected period into ONE view-model with a field for every section of the
// Analytics page. Each field is `null` when there is genuinely nothing to
// show yet — sections render an honest empty state with the way to fix it,
// never sample numbers.
import {
  aggregateDeviceExperience,
  aggregateJourneys,
  aggregateVisits,
  DOW_LABELS,
  fmtDuration,
  fmtMs,
  fmtNum,
  fmtPct,
  hourLabel,
  languageLabel,
  timeAgo,
  type NormVisit,
  type VisitAggregates,
} from '@/lib/dashboardStats';
import type { ResolvedRange } from '@/lib/dashboardRange';
import type { DashboardData } from '@/hooks/useDashboardData';
import type { AnalyticsExtras, BackendEvent } from '../useAnalyticsExtras';
import type { Dir, GoalIcon, DiagIcon, MetricId, RankedRow, Stat, TechRow, Tone } from '../sections/analyticsTypes';
import { deltaOf, fmtMoney, pickCurrency, productsFor, saasFor, totalsFor, type PeriodTotals, type ProductModel, type SaasModel } from './revenue';
import { attributions, channelOf, colorFor, median, percentile, retentionFor, searchesFor, sessionsOf, SESSION_BUCKETS, type RetentionResult } from './behaviour';

/* ── helpers ─────────────────────────────────────────────────────── */
const DAY = 86_400_000;
const pctRow = (rows: { count: number }[]) => Math.max(1, ...rows.map((r) => r.count));

export function countryName(code: string): string {
  if (!code) return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
export function flagOf(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)));
}
const pathLabel = (p: string) => (p === '/' ? '/ (home)' : p);

function ranked(rows: { key: string; label: string; count: number; pct: number }[], labelOf?: (k: string) => string): RankedRow[] {
  const max = pctRow(rows);
  return rows.map((r) => ({
    label: labelOf ? labelOf(r.key) : r.label,
    title: r.key,
    value: fmtNum(r.count),
    share: `${Math.round(r.pct)}%`,
    pct: (r.count / max) * 100,
  }));
}

/* ── output types ────────────────────────────────────────────────── */
export interface MetricView {
  rangeLabel: string;
  value: string;
  delta: { text: string; dir: Dir } | null;
  series: number[];
  labels: string[];
  longs: string[];
  fmt: (v: number) => string;
  unit: string;
}
export interface LogEvent {
  kind: 'req' | 'conv' | 'err' | 'block';
  label: string;
  flag: string;
  lead: string;
  strong: string;
  tail: string;
  meta: string;
  ago: string;
  ts: number;
}
export interface RevenueView {
  currency: string;
  excluded: number;
  totals: PeriodTotals;
  prev: PeriodTotals | null;
  saas: SaasModel;
  products: ProductModel;
  tiles: { label: string; value: string; delta: string; dir: Dir; accent?: boolean }[];
  mix: { label: string; pct: number; value: string; tone: string }[];
  plSplit: { label: string; pct: number; tone: string }[];
  plRows: { label: string; value: string; kind?: 'total' | 'net'; sign?: 'pos' | 'neg' }[];
  truncated: boolean;
}
export interface GoalRow {
  name: string;
  icon: GoalIcon;
  count: number;
  share: string;
  pct: number;
  rate: string;
}
export interface ChannelRow {
  name: string;
  hint: string;
  color: string;
  visitors: number;
  conversions: number;
  rate: string;
  revenue: string;
  spend: string;
  roas: string;
}
export interface Diagnostic {
  title: string;
  metric: string;
  desc: string;
  fix: string;
  severity: 'high' | 'med' | 'low';
  icon: DiagIcon;
}

export interface AnalyticsModel {
  now: number;
  agg: VisitAggregates;
  loadedVisits: number;
  overview: Record<MetricId, MetricView>;
  geo: { countries: RankedRow[]; note: string; live: { flag: string; path: string; meta: string; time: string; blocked: boolean; key: string }[] };
  people: Record<string, RankedRow[]>;
  devices: { tabs: { id: string; note: string }[]; byDevice: Record<string, { stats: Stat[]; topPagesTitle: string; topPages: RankedRow[] }>; sampleSize: number };
  journeys: { subtitle: string; landing: RankedRow[]; exits: RankedRow[]; paths: Record<string, { steps: string[]; count: string }[]> };
  protection: { cleanPct: string; botsPct: string; stats: Stat[]; note: string };
  revenue: RevenueView | null;
  goals: { summary: { label: string; value: string }[]; rows: GoalRow[] } | null;
  campaigns: Record<string, ChannelRow[]>;
  campaignHasSpend: boolean;
  audience: { split: { label: string; pct: number; tone: string }[]; frequency: { label: string; pct: number; value: string }[] } | null;
  engagement: { events: { kind: string; name: string; count: string }[]; eventsTotal: number; search: { terms: { term: string; count: number }[]; noResults: RankedRow[]; foundRate: number | null; total: number } };
  retention: RetentionResult | null;
  speed: { name: string; status: string; tone: 'good' | 'ok' | 'bad' | 'none'; value: string; desc: string }[];
  speedSamples: number;
  health: {
    status: { label: string; value: string; tone: Tone }[];
    uptime: { classes: (string | undefined)[]; summary: string; from: string; to: string; hasData: boolean };
    diagnostics: Diagnostic[];
    heat: { cells: number[][]; peak: string; quiet: string; hasData: boolean };
    session: { buckets: { label: string; pct: number }[]; median: string; pages: string; hasData: boolean };
    appearance: { dark: string; light: string; note: string; hasData: boolean };
    browsers: TechRow[];
    systems: TechRow[];
    screens: TechRow[];
    connection: Stat[];
    errors: { code: string; klass: '4xx' | '5xx' | 'js'; path: string; meta: string; count: string }[];
    jsNote: { count: number; message: string; where: string; browser: string } | null;
  };
  apiHealth: {
    status: { text: string; tone: Tone };
    funnel: { label: string; value: string; note: string; tone?: Tone }[];
    tiles: { label: string; value: string; note: string; tone?: Tone }[];
    note: { throughput: string; peak: string; test: number } | null;
    hasData: boolean;
  };
  liveLog: LogEvent[];
}

/* ── series per bucket ───────────────────────────────────────────── */
function bucketIndex(series: { t: number }[], ts: number): number {
  let lo = 0;
  let hi = series.length - 1;
  if (!series.length || ts < series[0].t) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid].t <= ts) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const CONVERSION_EVENTS = new Set(['order.completed', 'user.signed_up', 'trial.started', 'subscription.started', 'goal.completed']);

export interface BuildInput {
  range: ResolvedRange;
  data: DashboardData;
  extras: AnalyticsExtras;
  /** Recent activity for the live log when the period itself isn't "now". */
  recent: { visits: NormVisit[]; custom: { name: string; ts: number; visitorId: string }[]; backend: BackendEvent[] } | null;
  origin: string;
  now: number;
}

const rangeTitle = (r: ResolvedRange, s: number, e: number) => {
  if (r.id === 'lifetime') return 'All time';
  const f = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return r.hourly ? 'Today' : `${f(s)} — ${f(e - 1)}`;
};

export function buildModel(input: BuildInput): AnalyticsModel {
  const { range, data, extras, now } = input;
  const visits = data.visits;
  const from = range.start ? range.start.getTime() : visits.length ? Math.min(...visits.map((v) => v.ts)) : now - 30 * DAY;
  const to = Math.min(range.end.getTime(), now + 60_000);
  const prevFrom = range.prevStart ? range.prevStart.getTime() : null;
  const prevTo = range.prevEnd ? range.prevEnd.getTime() : null;

  const agg = aggregateVisits(visits, range, { coveredFrom: data.coveredFrom, clicksByDay: data.clicksByDay, now });
  const sessions = sessionsOf(visits);
  const attr = attributions(visits);

  const backendAsc = [...extras.backend].sort((a, b) => a.at - b.at);
  const inPeriod = backendAsc.filter((e) => e.at >= from && e.at < to);
  const { currency, excluded } = pickCurrency(backendAsc);

  /* ── revenue ── */
  const totals = totalsFor(backendAsc, from, to, currency);
  const prev = prevFrom !== null && prevTo !== null ? totalsFor(backendAsc, prevFrom, prevTo, currency) : null;
  const money = (n: number) => fmtMoney(n, currency || 'USD');
  const hasRevenueData = backendAsc.some((e) => ['subscriptions', 'orders', 'refunds', 'expenses', 'ad-spend', 'plan-catalog', 'product-catalog'].includes(e.type)) || extras.catalog.length > 0;
  let revenue: RevenueView | null = null;
  if (hasRevenueData) {
    const saas = saasFor(backendAsc, extras.catalog, from, to, currency);
    const products = productsFor(backendAsc, extras.catalog, from, to, currency, totals);
    const gross = totals.revenue - totals.cogs;
    const net = gross - totals.opex;
    const pGross = prev ? prev.revenue - prev.cogs : null;
    const pNet = prev && pGross !== null ? pGross - prev.opex : null;
    const margin = (x: number) => (totals.revenue > 0 ? `${((x / totals.revenue) * 100).toFixed(1)}% margin` : '');
    // Only compare against a prior period that actually had activity — "new vs prior" on an empty window would mislead.
    const tile = (label: string, value: number, before: number | null, accent?: boolean, note = '') => {
      const dd = before !== null && before !== 0 ? deltaOf(value, before) : null;
      return { label, value: money(value), delta: [dd ? dd.text : '', note].filter(Boolean).join(' · '), dir: (dd ? dd.dir : 'flat') as Dir, accent };
    };
    const expenses = totals.cogs + totals.opex;
    const totalRev = Math.max(0, totals.saasRevenue) + Math.max(0, totals.productRevenue);
    revenue = {
      currency,
      excluded,
      totals,
      prev,
      saas,
      products,
      tiles: [
        tile('Total revenue', totals.revenue, prev ? prev.revenue : null, true),
        tile('Gross profit', gross, pGross, false, margin(gross)),
        tile('Total expenses', expenses, prev ? prev.cogs + prev.opex : null),
        tile('Net profit', net, pNet, false, margin(net)),
      ],
      mix: [
        { label: 'SaaS subscriptions', pct: totalRev ? (Math.max(0, totals.saasRevenue) / totalRev) * 100 : 0, value: money(totals.saasRevenue), tone: 'saas' },
        { label: 'Product sales', pct: totalRev ? (Math.max(0, totals.productRevenue) / totalRev) * 100 : 0, value: money(totals.productRevenue), tone: 'product' },
      ],
      plSplit:
        totals.revenue > 0
          ? [
              { label: `Gross profit · ${money(gross)}`, pct: Math.max(0, Math.min(100, (gross / totals.revenue) * 100)), tone: 'gross' },
              { label: `COGS · ${money(totals.cogs)}`, pct: Math.max(0, Math.min(100, (totals.cogs / totals.revenue) * 100)), tone: 'cogs' },
            ]
          : [],
      plRows: [
        { label: 'Revenue', value: money(totals.revenue) },
        { label: 'Refunds & chargebacks (included above)', value: totals.refunded > 0 ? `−${money(totals.refunded)}` : money(0), sign: totals.refunded > 0 ? 'neg' : undefined },
        { label: 'Cost of goods (hosting, fees, fulfilment)', value: totals.cogs > 0 ? `−${money(totals.cogs)}` : money(0), sign: totals.cogs > 0 ? 'neg' : undefined },
        { label: 'Gross profit', value: money(gross), kind: 'total' },
        { label: 'Operating costs (team, tools, marketing)', value: totals.opex > 0 ? `−${money(totals.opex)}` : money(0), sign: totals.opex > 0 ? 'neg' : undefined },
        { label: 'Net profit', value: money(net), kind: 'total', sign: net >= 0 ? 'pos' : 'neg' },
      ],
      truncated: extras.backendTruncated,
    };
  }

  /* ── goals ── */
  const goalCounts = new Map<string, { icon: GoalIcon; count: number; value: number; valued: number }>();
  const bump = (name: string, icon: GoalIcon, value: number | null) => {
    const g = goalCounts.get(name) ?? { icon, count: 0, value: 0, valued: 0 };
    g.count += 1;
    if (value !== null && value > 0) {
      g.value += value;
      g.valued += 1;
    }
    goalCounts.set(name, g);
  };
  const converters = new Set<string>();
  for (const e of inPeriod) {
    if (!CONVERSION_EVENTS.has(e.event)) continue;
    const who = e.visitorId ?? e.userId;
    if (who) converters.add(who);
    const cur = e.data.currency;
    const ok = !cur || cur === currency;
    if (e.event === 'order.completed') bump('Checkout completed', 'check', ok ? Number(e.data.total) - Number(e.data.tax || 0) : null);
    else if (e.event === 'subscription.started') bump('Subscription started', 'check', ok ? Number(e.data.amount) * (Number(e.data.quantity) || 1) : null);
    else if (e.event === 'user.signed_up') bump('Signup completed', 'send', null);
    else if (e.event === 'trial.started') bump('Trial started', 'clock', null);
    else if (e.event === 'goal.completed') bump(String(e.data.goal ?? 'Goal'), 'check', ok && typeof e.data.value === 'number' ? e.data.value : null);
  }
  if (data.leadsInRange > 0) {
    for (const l of data.leadsAttributed) if (l.visitorId) converters.add(l.visitorId);
    const g = goalCounts.get('Email captured') ?? { icon: 'send' as GoalIcon, count: 0, value: 0, valued: 0 };
    g.count += data.leadsInRange;
    goalCounts.set('Email captured', g);
  }
  const visitorsTotal = Math.max(1, data.uniqueUsers);
  let goals: AnalyticsModel['goals'] = null;
  if (goalCounts.size) {
    const list = Array.from(goalCounts.entries()).sort((a, b) => b[1].count - a[1].count);
    const total = list.reduce((a, [, g]) => a + g.count, 0);
    const top = list[0][1].count;
    const valuedN = list.reduce((a, [, g]) => a + g.valued, 0);
    const valueSum = list.reduce((a, [, g]) => a + g.value, 0);
    goals = {
      summary: [
        { label: 'Goal completions', value: fmtNum(total) },
        { label: 'Conversion rate', value: fmtPct(Math.min(1, converters.size / visitorsTotal), 2) },
        { label: 'Avg. value per conversion', value: valuedN ? money(valueSum / valuedN) : '—' },
      ],
      rows: list.map(([name, g]) => ({
        name,
        icon: g.icon,
        count: g.count,
        share: `${Math.round((g.count / total) * 100)}%`,
        pct: (g.count / top) * 100,
        rate: g.valued ? money(g.value / g.valued) : fmtPct(g.count / visitorsTotal, 2),
      })),
    };
  }
  const conversionsTotal = goals ? goals.rows.reduce((a, r) => a + r.count, 0) : 0;

  /* ── campaigns ── */
  type Acc = { visitors: Set<string>; conv: Set<string>; revenue: number; spend: number; top: Map<string, number> };
  const tabs: Record<string, Map<string, Acc>> = { Channels: new Map(), Sources: new Map(), Campaigns: new Map(), Mediums: new Map() };
  const touch = (tab: string, key: string | null, id: string, a: Attribution2) => {
    if (!key) return;
    const m = tabs[tab];
    const cur = m.get(key) ?? { visitors: new Set(), conv: new Set(), revenue: 0, spend: 0, top: new Map() };
    cur.visitors.add(id);
    cur.top.set(a.source, (cur.top.get(a.source) || 0) + 1);
    m.set(key, cur);
  };
  type Attribution2 = { channel: string; source: string; medium: string | null; campaign: string | null };
  attr.forEach((a, id) => {
    touch('Channels', a.channel, id, a);
    touch('Sources', a.source, id, a);
    touch('Campaigns', a.campaign, id, a);
    touch('Mediums', a.medium, id, a);
  });
  const keysFor = (a: Attribution2) => ({ Channels: a.channel, Sources: a.source, Campaigns: a.campaign, Mediums: a.medium });
  const credit = (id: string, revenueAmt: number) => {
    const a = attr.get(id);
    if (!a) return;
    const k = keysFor(a);
    for (const tab of Object.keys(tabs)) {
      const key = k[tab as keyof typeof k];
      const acc = key ? tabs[tab].get(key) : null;
      if (acc) {
        acc.conv.add(id);
        acc.revenue += revenueAmt;
      }
    }
  };
  for (const l of data.leadsAttributed) if (l.visitorId) credit(l.visitorId, 0);
  for (const e of inPeriod) {
    if (!e.visitorId || e.data.currency && e.data.currency !== currency) {
      if (e.visitorId && CONVERSION_EVENTS.has(e.event)) credit(e.visitorId, 0);
      continue;
    }
    if (CONVERSION_EVENTS.has(e.event)) {
      const rev = e.event === 'order.completed' ? Number(e.data.total) - Number(e.data.tax || 0) : e.event === 'subscription.started' ? Number(e.data.amount) * (Number(e.data.quantity) || 1) : 0;
      credit(e.visitorId, rev);
    } else if (e.event === 'subscription.renewed') credit(e.visitorId, Number(e.data.amount) * (Number(e.data.quantity) || 1));
  }
  let campaignHasSpend = false;
  for (const e of inPeriod) {
    if (e.event !== 'adspend.recorded' || (e.data.currency && e.data.currency !== currency)) continue;
    campaignHasSpend = true;
    const amt = Number(e.data.amount) || 0;
    const ch = channelOfSpend(e);
    const add = (tab: string, key: string | null) => {
      if (!key) return;
      const m = tabs[tab];
      const cur = m.get(key) ?? { visitors: new Set(), conv: new Set(), revenue: 0, spend: 0, top: new Map() };
      cur.spend += amt;
      m.set(key, cur);
    };
    add('Channels', ch);
    add('Sources', String(e.data.source));
    add('Campaigns', e.data.campaign ? String(e.data.campaign) : null);
    add('Mediums', e.data.medium ? String(e.data.medium) : null);
  }
  const campaigns: Record<string, ChannelRow[]> = {};
  for (const tab of Object.keys(tabs)) {
    campaigns[tab] = Array.from(tabs[tab].entries())
      .map(([name, a], i) => {
        const topSource = Array.from(a.top.entries()).sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
        const v = a.visitors.size;
        return {
          name,
          hint: tab === 'Channels' && topSource && topSource !== name ? topSource : '',
          color: colorFor(name, i),
          visitors: v,
          conversions: a.conv.size,
          rate: v ? fmtPct(a.conv.size / v, 1) : '—',
          revenue: a.revenue > 0 ? money(a.revenue) : '—',
          spend: a.spend > 0 ? money(a.spend) : '—',
          roas: a.spend > 0 && a.revenue > 0 ? `${(a.revenue / a.spend).toFixed(1)}×` : '—',
        };
      })
      .sort((x, y) => y.visitors - x.visitors)
      .slice(0, 12);
  }

  /* ── audience ── */
  let audience: AnalyticsModel['audience'] = null;
  const nu = data.newUsers;
  const ru = data.returningUsers;
  if (nu !== null && ru !== null && nu + ru > 0) {
    const newPct = Math.round((nu / (nu + ru)) * 100);
    const perVisitor = new Map<string, number>();
    for (const v of visits) if (!v.blocked) perVisitor.set(v.visitorId, (perVisitor.get(v.visitorId) || 0) + 1);
    const buckets = [
      { label: '1 visit', test: (n: number) => n === 1 },
      { label: '2–4 visits', test: (n: number) => n >= 2 && n <= 4 },
      { label: '5–10 visits', test: (n: number) => n >= 5 && n <= 10 },
      { label: '11+ visits', test: (n: number) => n > 10 },
    ].map((b) => ({ label: b.label, n: Array.from(perVisitor.values()).filter(b.test).length }));
    const max = Math.max(1, ...buckets.map((b) => b.n));
    audience = {
      split: [
        { label: 'New', pct: newPct, tone: 'violet' },
        { label: 'Returning', pct: 100 - newPct, tone: 'cyan' },
      ],
      frequency: buckets.map((b) => ({ label: b.label, pct: (b.n / max) * 100, value: fmtNum(b.n) })),
    };
  }

  /* ── engagement ── */
  const evCounts = new Map<string, { kind: string; count: number }>();
  for (const c of extras.customEvents) {
    if (c.name === 'search' || c.ts < from || c.ts >= to) continue;
    const cur = evCounts.get(c.name) ?? { kind: 'Page', count: 0 };
    cur.count += 1;
    evCounts.set(c.name, cur);
  }
  for (const e of inPeriod) {
    if (!e.event.startsWith('custom.')) continue;
    const name = String(e.data.name ?? e.event.slice(7));
    const cur = evCounts.get(name) ?? { kind: 'Server', count: 0 };
    cur.count += 1;
    evCounts.set(name, cur);
  }
  const events = Array.from(evCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, v]) => ({ kind: v.kind, name, count: fmtNum(v.count) }));
  const srch = searchesFor(extras.customEvents, backendAsc, from, to);

  /* ── speed ── */
  const pick = (f: (v: NormVisit) => number | null) => visits.map(f).filter((x): x is number => x !== null);
  const lcp = pick((v) => v.lcpMs);
  const inp = pick((v) => v.inpMs);
  const cls = pick((v) => v.cls);
  const ttfb = pick((v) => v.ttfbMs);
  const vital = (name: string, desc: string, xs: number[], good: number, poor: number, f: (n: number) => string) => {
    const p = percentile(xs, 75);
    if (p === null) return { name, status: 'No data yet', tone: 'none' as const, value: '—', desc };
    return { name, status: p <= good ? 'Good' : p <= poor ? 'Needs work' : 'Poor', tone: (p <= good ? 'good' : p <= poor ? 'ok' : 'bad') as 'good' | 'ok' | 'bad', value: f(p), desc };
  };
  const speed = [
    vital('LCP', 'Largest contentful paint', lcp, 2500, 4000, fmtMs),
    vital('INP', 'Interaction to next paint', inp, 200, 500, fmtMs),
    vital('CLS', 'Cumulative layout shift', cls, 0.1, 0.25, (n) => n.toFixed(2)),
    vital('TTFB', 'Time to first byte', ttfb, 800, 1800, fmtMs),
  ];

  /* ── people / devices / journeys / geo / protection ── */
  const people: Record<string, RankedRow[]> = {
    Pages: ranked(agg.pages, pathLabel),
    'Entry pages': ranked(agg.entryPages, pathLabel),
    Referrers: ranked(agg.referrers),
    Devices: ranked(agg.devices),
    Browsers: ranked(agg.browsers),
    Systems: ranked(agg.systems),
    Languages: ranked(agg.languages, (k) => languageLabel(k)),
    Cities: ranked(agg.cities),
  };

  const dx = aggregateDeviceExperience(visits, data.leadsAttributed);
  const byDevice: AnalyticsModel['devices']['byDevice'] = {};
  for (const r of dx.rows) {
    byDevice[r.device] = {
      stats: [
        { label: 'Conversion rate', value: fmtPct(r.conversionRate, 2), note: r.conversionRate === null ? 'not enough data yet' : `of ${fmtNum(r.uniqueVisitors)} visitors` },
        { label: 'Avg. load time', value: fmtMs(r.avgLoadMs), note: r.avgLoadMs === null ? 'not enough data yet' : `from ${fmtNum(r.loadSampleSize)} page loads` },
        { label: 'Exit rate', value: fmtPct(r.exitRate, 0), note: 'sessions that ended on this device' },
        { label: 'Possible broken clicks', value: fmtNum(r.rageClicksTotal), note: "rapid repeat clicks — may mean something didn't respond", tone: r.rageClicksTotal > 0 ? 'warn' : undefined },
      ],
      topPagesTitle: r.bestPages.length ? `Most successful pages on ${r.device.toLowerCase()}` : `Busiest pages on ${r.device.toLowerCase()}`,
      topPages: r.bestPages.length
        ? r.bestPages.slice(0, 5).map((p) => ({ label: pathLabel(p.path), title: p.path, value: `${Math.round((1 - p.exitRate) * 100)}% stay` }))
        : r.topPages.slice(0, 5).map((p) => ({ label: pathLabel(p.path), title: p.path, value: `${fmtNum(p.visits)} visits` })),
    };
  }

  const jr = aggregateJourneys(visits, data.leadsAttributed);
  const pathRows = (rows: { steps: string[]; count: number }[]) => rows.slice(0, 6).map((p) => ({ steps: p.steps.map(pathLabel), count: fmtNum(p.count) }));
  const journeys = {
    subtitle: `From ${fmtNum(jr.sessionsWithJourney)} multi-page sessions`,
    landing: jr.entryPages.slice(0, 5).map((r) => ({ label: pathLabel(r.key), title: r.key, value: fmtNum(r.count) })),
    exits: jr.exitPages.slice(0, 5).map((r) => ({ label: pathLabel(r.key), title: r.key, value: fmtNum(r.count) })),
    paths: {
      'Most common': pathRows(jr.topJourneys),
      'Led to a lead': pathRows(jr.successfulJourneys.filter((j) => j.ledToLeadCount > 0).map((j) => ({ steps: j.steps, count: j.ledToLeadCount }))),
    },
  };

  const countries = agg.countries.slice(0, 8).map<RankedRow>((c) => ({
    label: countryName(c.code),
    flag: flagOf(c.code),
    value: fmtNum(c.visits),
    share: `${Math.round(c.pct)}%`,
    pct: (c.visits / Math.max(1, agg.countries[0]?.visits ?? 1)) * 100,
  }));
  const live = agg.recent.slice(0, 8).map((v) => ({
    key: v.id,
    flag: flagOf(v.country),
    path: v.path,
    meta: [v.city, v.country && countryName(v.country), v.device, v.browser].filter(Boolean).join(' · '),
    time: timeAgo(v.ts, now),
    blocked: v.blocked,
  }));

  const loaded = Math.max(1, agg.loaded);
  const botShare = agg.blockedLoaded / loaded;
  const protection = {
    cleanPct: fmtPct(1 - botShare, 0),
    botsPct: fmtPct(botShare, 0),
    stats: [
      { label: 'Bots stopped', value: `${fmtNum(data.botsStopped)}${data.botsCapped ? '+' : ''}` },
      { label: 'Blocked visits', value: fmtNum(data.blockedVisits) },
      { label: 'Blocked users', value: fmtNum(data.blockedVisitors) },
      { label: 'Restricted now', value: fmtNum(data.restrictedVisitors) },
    ] as Stat[],
    note: data.flaggedNetworks > 0 ? `${fmtNum(data.flaggedNetworks)} visitor${data.flaggedNetworks === 1 ? '' : 's'} came from hosting or proxy networks.` : 'No visitors came from hosting or proxy networks.',
  };

  /* ── site health ── */
  const up = [...extras.uptime].sort((a, b) => (a.day < b.day ? -1 : 1));
  const upSamples = up.reduce((a, d) => a + d.samples, 0);
  const upDown = up.reduce((a, d) => a + d.down, 0);
  const upDeg = up.reduce((a, d) => a + d.degraded, 0);
  const uptimePct = upSamples ? ((upSamples - upDown) / upSamples) * 100 : null;
  const dayMap = new Map(up.map((d) => [d.day, d]));
  const today = new Date(now);
  const classes: (string | undefined)[] = [];
  for (let i = 89; i >= 0; i--) {
    const k = new Date(today.getTime() - i * DAY).toISOString().slice(0, 10);
    const d = dayMap.get(k);
    classes.push(!d || !d.samples ? 'is-empty' : d.down / d.samples >= 0.5 ? 'is-down' : d.down > 0 || d.degraded > 0 ? 'is-degraded' : undefined);
  }
  const last7 = up.slice(-7);
  const l7s = last7.reduce((a, d) => a + d.samples, 0);
  const probeMs = l7s ? last7.reduce((a, d) => a + d.totalMs, 0) / l7s : null;
  const metrics = inPeriod.filter((e) => e.event === 'server.metrics');
  const mReq = metrics.reduce((a, e) => a + (Number(e.data.requests) || 0), 0);
  const mErr = metrics.reduce((a, e) => a + (Number(e.data.errors) || 0), 0);
  const mAvgW = metrics.reduce((a, e) => a + (Number(e.data.avgMs) || 0) * (Number(e.data.requests) || 0), 0);
  const avgMs = mReq && mAvgW ? mAvgW / mReq : probeMs;
  const jsInPeriod = extras.jsErrors.reduce((a, e) => {
    let c = 0;
    for (const [day, n] of Object.entries(e.days)) {
      const t = Date.parse(`${day}T12:00:00Z`);
      if (t >= from - DAY / 2 && t < to) c += n;
    }
    return a + c;
  }, 0);
  const serverErrs = inPeriod.filter((e) => e.event === 'server.error').reduce((a, e) => a + (Number(e.data.count) || 1), 0);
  const tone = (v: number | null, ok: number, warn: number, higherIsWorse = true): Tone => (v === null ? 'ok' : higherIsWorse ? (v < ok ? 'ok' : v < warn ? 'warn' : 'bad') : v >= ok ? 'ok' : v >= warn ? 'warn' : 'bad');
  const errValue = mReq ? mErr / mReq : null;
  const status = [
    { label: 'Uptime', value: uptimePct === null ? 'Checking…' : `${uptimePct.toFixed(uptimePct >= 99.95 ? 1 : 2)}%`, tone: tone(uptimePct, 99.5, 97, false) },
    { label: 'Avg. response', value: avgMs === null ? '—' : fmtMs(avgMs), tone: tone(avgMs, 800, 1800) },
    { label: 'Bounce rate', value: fmtPct(agg.bounceRate, 0), tone: tone(agg.bounceRate === null ? null : agg.bounceRate * 100, 55, 72) },
    errValue !== null
      ? { label: 'Error rate', value: fmtPct(errValue, 2), tone: tone(errValue * 100, 1, 3) }
      : { label: 'JS errors', value: fmtNum(jsInPeriod + serverErrs), tone: tone(jsInPeriod + serverErrs, 1, 20) },
    { label: 'Active now', value: fmtNum(agg.activeNow), tone: 'ok' as Tone },
  ] as { label: string; value: string; tone: Tone }[];

  // diagnostics from real signals
  const diagnostics: Diagnostic[] = [];
  const entryBy = new Map<string, { n: number; bounced: number }>();
  const sessFirst = new Map<string, NormVisit>();
  const sessCount = new Map<string, number>();
  for (const v of visits) {
    if (v.blocked) continue;
    sessCount.set(v.sessionId, (sessCount.get(v.sessionId) || 0) + 1);
    const f = sessFirst.get(v.sessionId);
    if (!f || v.ts < f.ts) sessFirst.set(v.sessionId, v);
  }
  sessFirst.forEach((v, id) => {
    const e = entryBy.get(v.path) ?? { n: 0, bounced: 0 };
    e.n += 1;
    if ((sessCount.get(id) || 0) === 1) e.bounced += 1;
    entryBy.set(v.path, e);
  });
  const worst = Array.from(entryBy.entries())
    .filter(([, e]) => e.n >= 20 && e.bounced / e.n >= 0.6 && (agg.bounceRate === null || e.bounced / e.n >= agg.bounceRate + 0.12))
    .sort((a, b) => b[1].bounced / b[1].n - a[1].bounced / a[1].n)[0];
  if (worst) {
    const r = worst[1].bounced / worst[1].n;
    diagnostics.push({ title: `${pathLabel(worst[0])} loses most visitors`, metric: `${Math.round(r * 100)}% bounce`, desc: `${fmtNum(worst[1].n)} sessions started here and ${Math.round(r * 100)}% left without a second page${agg.bounceRate !== null ? ` (site average ${Math.round(agg.bounceRate * 100)}%)` : ''}.`, fix: 'Make the next step obvious above the fold — one clear button or link — and check the page loads fast on mobile.', severity: r >= 0.75 ? 'high' : 'med', icon: 'warning' });
  }
  for (const s of speed) {
    if (s.tone === 'ok' || s.tone === 'bad') diagnostics.push({ title: `${s.name} ${s.tone === 'bad' ? 'is poor' : 'needs work'}`, metric: s.value, desc: `${s.desc} measured on real visits is ${s.value} (75th percentile).`, fix: s.name === 'CLS' ? 'Reserve space for images, ads and embeds so the page stops jumping while it loads.' : s.name === 'LCP' ? 'Compress your largest image or hero section and serve it from a CDN.' : s.name === 'INP' ? 'Break up long scripts that run when people click, and delay non-essential ones.' : 'Use caching or a CDN so the first byte arrives sooner.', severity: s.tone === 'bad' ? 'high' : 'med', icon: 'clock' });
  }
  if (data.brokenLinks.length) diagnostics.push({ title: `${data.brokenLinks.length} broken link${data.brokenLinks.length === 1 ? '' : 's'} on your site`, metric: `${data.brokenLinks.length} found`, desc: 'Visitors clicked links that lead nowhere.', fix: 'Open the Broken links list on your dashboard and fix or redirect each one.', severity: data.brokenLinks.length > 5 ? 'high' : 'med', icon: 'layers' });
  if (extras.jsErrors.length && jsInPeriod > 0) {
    const topErr = [...extras.jsErrors].sort((a, b) => b.count - a.count)[0];
    diagnostics.push({ title: 'JavaScript errors on your pages', metric: `${fmtNum(jsInPeriod)} in period`, desc: `Most common: “${topErr.message.slice(0, 90)}” on ${topErr.path}.`, fix: 'Open your browser console on that page, reproduce the error and fix the line it points to.', severity: jsInPeriod > 50 ? 'high' : 'med', icon: 'warning' });
  }
  if (upDown > 0 && upSamples) diagnostics.push({ title: 'Your site was unreachable at times', metric: `${upDown} failed check${upDown === 1 ? '' : 's'}`, desc: `${upDown} of ${upSamples} uptime checks over the last 90 days couldn’t reach your site.`, fix: 'Check your hosting status page and set up an alert with your host.', severity: upDown / upSamples > 0.02 ? 'high' : 'med', icon: 'clock' });
  if (serverErrs > 0) diagnostics.push({ title: 'Your server returned errors', metric: `${fmtNum(serverErrs)} errors`, desc: 'Your backend reported 4xx/5xx responses in this period (see the error log below).', fix: 'Start with the route that fails most often in the error log.', severity: serverErrs > 100 ? 'high' : 'low', icon: 'warning' });
  const rage = visits.reduce((a, v) => a + (v.rageClicks ?? 0), 0);
  if (rage >= 10) diagnostics.push({ title: 'Buttons that may not respond', metric: `${fmtNum(rage)} rapid-click bursts`, desc: 'Visitors clicked the same spot repeatedly — a sign something looked clickable but did nothing.', fix: 'Look at the Device experience section to see which device it happens on, then test that button there.', severity: 'low', icon: 'layers' });

  // heatmap + sessions + appearance + tech
  const heat = agg.heat;
  const cells = heat.cells.map((row) => row.map((v) => (heat.max ? Math.round((v / heat.max) * 100) : 0)));
  const dowTotals = heat.cells.map((r) => r.reduce((a, b) => a + b, 0));
  const hourTotals = Array.from({ length: 24 }, (_, h) => heat.cells.reduce((a, r) => a + r[h], 0));
  const quietDow = dowTotals.indexOf(Math.min(...dowTotals));
  const quietHour = hourTotals.indexOf(Math.min(...hourTotals));
  const buckets = SESSION_BUCKETS.map((b, i) => ({ label: b.label, n: sessions.filter((s) => s.durationSec >= (i ? SESSION_BUCKETS[i - 1].max : 0) && s.durationSec < b.max).length }));
  const bMax = Math.max(1, ...buckets.map((b) => b.n));
  const medSec = median(sessions.map((s) => s.durationSec));
  const withScheme = sessions.filter((s) => s.dark !== null);
  const darkS = withScheme.filter((s) => s.dark);
  const lightS = withScheme.filter((s) => !s.dark);
  const bounceOf = (xs: typeof sessions) => (xs.length ? xs.filter((s) => s.pages === 1).length / xs.length : null);
  const bd = bounceOf(darkS);
  const bl = bounceOf(lightS);
  const appearance = {
    hasData: withScheme.length > 0,
    dark: withScheme.length ? fmtPct(darkS.length / withScheme.length, 0) : '—',
    light: withScheme.length ? fmtPct(lightS.length / withScheme.length, 0) : '—',
    note:
      bd !== null && bl !== null && darkS.length >= 20 && lightS.length >= 20
        ? `Dark mode visitors bounce ${Math.abs(Math.round((bl - bd) * 100))}% ${bd <= bl ? 'less' : 'more'} than light mode visitors.`
        : withScheme.length
          ? `Based on ${fmtNum(withScheme.length)} sessions that reported a preference.`
          : 'Shows up once visitors’ browsers report their theme.',
  };
  const BROWSER_ICON: Record<string, string> = { Chrome: '🌐', Safari: '🧭', Firefox: '🦊', Edge: '🌊' };
  const OS_ICON: Record<string, string> = { Windows: '🪟', macOS: '🍎', iOS: '📱', Android: '🤖', Linux: '🐧' };
  const tech = (rows: { key: string; count: number; pct: number }[], icon: (k: string) => string): TechRow[] => {
    const max = pctRow(rows);
    return rows.slice(0, 5).map((r) => ({ icon: icon(r.key), label: r.key, value: `${r.pct.toFixed(1)}%`, pct: (r.count / max) * 100 }));
  };
  const screenCounts = new Map<string, number>();
  for (const v of visits) if (v.screen && !v.blocked) screenCounts.set(v.screen, (screenCounts.get(v.screen) || 0) + 1);
  const scrTotal = Array.from(screenCounts.values()).reduce((a, b) => a + b, 0);
  const scrTop = Array.from(screenCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const screens: TechRow[] = scrTop.map(([k, c]) => ({ icon: parseInt(k, 10) >= 1000 ? '🖥️' : '📱', label: k.replace('x', '×'), value: `${((c / scrTotal) * 100).toFixed(1)}%`, pct: (c / scrTop[0][1]) * 100 }));
  const conn = agg.connectionTypes;
  const connPct = (name: string) => conn.find((c) => c.key.toLowerCase() === name)?.pct;
  const mobileShare = agg.devices.filter((d) => /mobile|tablet/i.test(d.key)).reduce((a, d) => a + d.pct, 0);
  const connection: Stat[] = [
    { label: 'Wi-Fi', value: connPct('wifi') !== undefined ? `${Math.round(connPct('wifi')!)}%` : '—', note: conn.length ? 'of visits that report a connection' : 'reported by Chromium browsers' },
    { label: 'Cellular', value: connPct('cellular') !== undefined ? `${Math.round(connPct('cellular')!)}%` : '—' },
    { label: 'Ethernet', value: connPct('ethernet') !== undefined ? `${Math.round(connPct('ethernet')!)}%` : '—' },
    { label: 'Phones & tablets', value: agg.devices.length ? `${Math.round(mobileShare)}%` : '—', note: 'of all visits' },
  ];

  // error log
  const errMap = new Map<string, { code: number; path: string; count: number; msg: string; last: number }>();
  for (const e of inPeriod) {
    if (e.event !== 'server.error') continue;
    const key = `${e.data.status} ${e.data.path}`;
    const cur = errMap.get(key) ?? { code: Number(e.data.status), path: String(e.data.path), count: 0, msg: '', last: 0 };
    cur.count += Number(e.data.count) || 1;
    if (e.at > cur.last) {
      cur.last = e.at;
      cur.msg = String(e.data.message ?? '');
    }
    errMap.set(key, cur);
  }
  const errors: AnalyticsModel['health']['errors'] = Array.from(errMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((e) => ({ code: String(e.code), klass: e.code >= 500 ? '5xx' : '4xx', path: e.path, meta: [e.msg, `last ${timeAgo(e.last, now)}`].filter(Boolean).join(' · '), count: `${fmtNum(e.count)}×` }));
  for (const j of [...extras.jsErrors].sort((a, b) => b.count - a.count).slice(0, 4)) {
    errors.push({ code: 'JS', klass: 'js', path: j.message.slice(0, 80), meta: `${j.path} · ${j.browser}${j.lastSeen ? ` · last ${timeAgo(j.lastSeen, now)}` : ''}`, count: `${fmtNum(j.count)}×` });
  }
  const topJs = [...extras.jsErrors].sort((a, b) => b.count - a.count)[0];

  /* ── API health ── */
  const hours = extras.apiHours;
  const sum = (f: (h: (typeof hours)[number]) => number) => hours.reduce((a, h) => a + f(h), 0);
  const totalReq = sum((h) => h.total);
  const accepted = sum((h) => h.accepted + h.acceptedTest);
  const dup = sum((h) => h.duplicate);
  const rejP = sum((h) => h.rejPermission);
  const rejR = sum((h) => h.rejReserved);
  const rejI = sum((h) => h.rejInvalid);
  const refused = rejP + rejR + rejI;
  const successRate = totalReq ? (accepted + dup) / totalReq : null;
  const totalMsSum = sum((h) => h.totalMs);
  const peak = hours.reduce((m, h) => Math.max(m, h.total), 0);
  const spanHours = Math.max(1, (to - from) / 3_600_000);
  const lastH = hours[0];
  const recentRefused = lastH && lastH.total ? (lastH.rejPermission + lastH.rejReserved + lastH.rejInvalid) / lastH.total : 0;
  const apiHealth: AnalyticsModel['apiHealth'] = {
    hasData: totalReq > 0,
    status: !totalReq ? { text: 'No events yet', tone: 'warn' } : recentRefused > 0.25 ? { text: 'Many events refused', tone: 'warn' } : { text: 'Receiving events', tone: 'ok' },
    funnel: [
      { label: 'Requests received', value: fmtNum(totalReq), note: 'after your key was checked' },
      { label: 'Accepted', value: fmtNum(accepted), note: 'recorded in your analytics', tone: 'ok' },
      { label: 'Duplicates ignored', value: fmtNum(dup), note: 'same id sent twice' },
      { label: 'Refused', value: fmtNum(refused), note: refused ? 'see the reasons below' : 'nothing refused', tone: refused ? 'bad' : undefined },
    ],
    tiles: [
      { label: 'Success rate', value: fmtPct(successRate, 1), note: 'accepted or safely de-duplicated', tone: successRate === null ? undefined : successRate >= 0.98 ? 'ok' : successRate >= 0.9 ? 'warn' : 'bad' },
      { label: 'Switched off', value: fmtNum(rejP), note: 'event type not allowed — enable it on the API page', tone: rejP ? 'warn' : undefined },
      { label: 'Traffic writes blocked', value: fmtNum(rejR), note: 'tried to send visits, clicks or visitors', tone: rejR ? 'warn' : undefined },
      { label: 'Avg. processing time', value: totalReq ? `${Math.round(totalMsSum / totalReq)}ms` : '—', note: 'per request, on our side' },
    ],
    note: totalReq ? { throughput: `${(totalReq / spanHours).toFixed(totalReq / spanHours < 10 ? 1 : 0)}/hour`, peak: `${fmtNum(peak)} in one hour`, test: sum((h) => h.acceptedTest) } : null,
  };

  /* ── live log (last hour) ── */
  const cut = now - 3_600_000;
  const src = input.recent ?? { visits: visits.filter((v) => v.ts >= cut), custom: extras.customEvents.filter((c) => c.ts >= cut), backend: backendAsc.filter((e) => e.at >= cut) };
  const log: LogEvent[] = [];
  for (const v of src.visits) {
    if (v.ts < cut) continue;
    log.push({ kind: v.blocked ? 'block' : 'req', label: v.blocked ? 'Blocked' : 'View', flag: flagOf(v.country), lead: v.blocked ? 'Blocked visit to ' : 'Page view ', strong: v.path, tail: '', meta: [v.city, v.country && countryName(v.country), v.device, v.browser].filter(Boolean).join(' · '), ago: timeAgo(v.ts, now), ts: v.ts });
  }
  for (const c of src.custom) if (c.ts >= cut) log.push({ kind: 'req', label: c.name === 'search' ? 'Search' : 'Event', flag: '🖱️', lead: c.name === 'search' ? 'Site search ' : 'Event ', strong: c.name, tail: '', meta: 'From the page', ago: timeAgo(c.ts, now), ts: c.ts });
  for (const e of src.backend) {
    if (e.at < cut) continue;
    const money2 = (n: unknown) => fmtMoney(Number(n) || 0, String(e.data.currency || currency || 'USD'));
    let kind: LogEvent['kind'] = 'req';
    let label = 'API';
    let lead = '';
    let strong = e.event;
    let tail = '';
    if (e.event === 'order.completed') { kind = 'conv'; label = 'Sale'; lead = 'Order '; strong = money2(e.data.total); tail = ` · ${e.data.orderId}`; }
    else if (e.event === 'subscription.started') { kind = 'conv'; label = 'Sale'; lead = 'New subscription '; strong = String(e.data.plan); tail = ` · ${money2(e.data.amount)}/${e.data.interval}`; }
    else if (e.event === 'subscription.renewed') { kind = 'conv'; label = 'Sale'; lead = 'Renewal '; strong = String(e.data.plan); tail = ` · ${money2(e.data.amount)}`; }
    else if (e.event === 'subscription.canceled') { kind = 'err'; label = 'Churn'; lead = 'Cancelled '; strong = String(e.data.subscriptionId); }
    else if (e.event === 'user.signed_up') { kind = 'conv'; label = 'Goal'; lead = 'Sign-up '; strong = e.userId ?? ''; }
    else if (e.event === 'goal.completed') { kind = 'conv'; label = 'Goal'; lead = 'Goal '; strong = String(e.data.goal); }
    else if (e.event === 'trial.started') { kind = 'conv'; label = 'Goal'; lead = 'Trial started '; strong = e.userId ?? ''; }
    else if (e.event === 'server.error') { kind = 'err'; label = String(e.data.status); lead = 'Server error '; strong = String(e.data.path); }
    else if (e.event === 'order.refunded' || e.event === 'order.chargeback') { kind = 'err'; label = 'Refund'; lead = 'Refund '; strong = money2(e.data.amount); }
    log.push({ kind, label, flag: '🧾', lead, strong, tail, meta: 'From your backend', ago: timeAgo(e.at, now), ts: e.at });
  }
  log.sort((a, b) => b.ts - a.ts);

  /* ── overview chart series ── */
  const series = agg.series;
  const revPer = series.map(() => 0);
  const convPer = series.map(() => 0);
  for (const e of inPeriod) {
    const i = bucketIndex(series, e.at);
    if (i < 0) continue;
    const c = e.data.currency;
    if (!c || c === currency) {
      if (e.event === 'order.completed') revPer[i] += Number(e.data.total) - Number(e.data.tax || 0);
      else if (e.event === 'subscription.started' || e.event === 'subscription.renewed') revPer[i] += Number(e.data.amount) * (Number(e.data.quantity) || 1);
      else if (e.event === 'order.refunded' || e.event === 'order.chargeback') revPer[i] -= Number(e.data.amount);
    }
    if (CONVERSION_EVENTS.has(e.event)) convPer[i] += 1;
  }
  for (const l of data.leadsAttributed) {
    const t = typeof l.ts === 'number' ? l.ts : l.ts && typeof (l.ts as any).toDate === 'function' ? (l.ts as any).toDate().getTime() : null;
    if (t === null) continue;
    const i = bucketIndex(series, t);
    if (i >= 0) convPer[i] += 1;
  }
  const bounceSeries = series.map(() => ({ n: 0, b: 0, dur: 0 }));
  for (const s of sessions) {
    const i = bucketIndex(series, s.start);
    if (i < 0) continue;
    bounceSeries[i].n += 1;
    if (s.pages === 1) bounceSeries[i].b += 1;
    bounceSeries[i].dur += s.durationSec;
  }
  const labels = series.map((p) => p.label);
  const longs = series.map((p) => p.long);
  const label = (name: string) => `${name} · ${rangeTitle(range, from, to)}`;
  const ctrNow = agg.clicksAvailable && agg.loaded ? agg.clicksTotal / agg.loaded : null;
  const mk = (name: string, value: string, delta: MetricView['delta'], vals: number[], fmt: (v: number) => string, unit = ''): MetricView => ({ rangeLabel: label(name), value, delta, series: vals, labels, longs, fmt, unit });
  const convRate = data.uniqueUsers ? Math.min(1, converters.size / data.uniqueUsers) : null;
  const overview: Record<MetricId, MetricView> = {
    revenue: mk('Revenue', hasRevenueData ? money(totals.revenue) : '—', hasRevenueData && prev ? deltaOf(totals.revenue, prev.revenue) : null, revPer, (v) => money(v)),
    views: mk('Views', fmtNum(data.total), deltaOf(data.total, data.prevTotal), series.map((p) => p.visits), (v) => fmtNum(v)),
    clicks: mk('Clicks', agg.clicksAvailable ? fmtNum(agg.clicksTotal) : '—', null, series.map((p) => p.clicks), (v) => fmtNum(v)),
    ctr: mk('CTR', ctrNow === null ? '—' : fmtPct(ctrNow, 2), null, series.map((p) => (p.visits ? p.clicks / p.visits : 0)), (v) => fmtPct(v, 2)),
    conv: mk('Conversion', convRate === null ? '—' : fmtPct(convRate, 2), null, series.map((p, i) => (p.uniques ? convPer[i] / p.uniques : 0)), (v) => fmtPct(v, 2)),
    users: mk('Unique users', fmtNum(data.uniqueUsers), null, series.map((p) => p.uniques), (v) => fmtNum(v)),
    bounce: mk('Bounce rate', fmtPct(agg.bounceRate, 1), null, bounceSeries.map((b) => (b.n ? b.b / b.n : 0)), (v) => fmtPct(v, 0)),
    session: mk('Avg. session', fmtDuration(agg.avgActiveSec ?? agg.avgSessionSec), null, bounceSeries.map((b) => (b.n ? b.dur / b.n : 0)), (v) => fmtDuration(v)),
  };

  return {
    now,
    agg,
    loadedVisits: visits.length,
    overview,
    geo: { countries, note: agg.countries.length ? `${agg.countries.length} countries` : 'No visits yet', live },
    people,
    devices: { tabs: dx.rows.map((r) => ({ id: r.device, note: `(${fmtNum(r.visits)})` })), byDevice, sampleSize: dx.sampleSize },
    journeys,
    protection,
    revenue,
    goals,
    campaigns,
    campaignHasSpend,
    audience,
    engagement: {
      events,
      eventsTotal: Array.from(evCounts.values()).reduce((a, e) => a + e.count, 0),
      search: { terms: srch.terms, noResults: srch.noResults.map((r) => ({ label: r.term, title: r.term, value: `${fmtNum(r.count)}×` })), foundRate: srch.foundRate, total: srch.total },
    },
    retention: retentionFor(visits, backendAsc, from, to),
    speed,
    speedSamples: Math.max(lcp.length, inp.length, cls.length, ttfb.length),
    health: {
      status,
      uptime: {
        classes,
        hasData: upSamples > 0,
        summary: upSamples ? `${uptimePct!.toFixed(2)}% · ${fmtNum(upSamples)} checks · ${upDown} down · ${upDeg} slow` : 'Checks start with your next visit to this page',
        from: new Date(now - 89 * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        to: 'Today',
      },
      diagnostics,
      heat: { cells, hasData: heat.total > 0, peak: heat.total ? `${DOW_LABELS[heat.peakDow]}s, ${hourLabel(heat.peakHour)} (visitor’s local time)` : '—', quiet: heat.total ? `${DOW_LABELS[quietDow]}s around ${hourLabel(quietHour)}` : '—' },
      session: { hasData: sessions.length > 0, buckets: buckets.map((b) => ({ label: b.label, pct: (b.n / bMax) * 100 })), median: fmtDuration(medSec), pages: agg.pagesPerSession === null ? '—' : agg.pagesPerSession.toFixed(1) },
      appearance,
      browsers: tech(agg.browsers, (k) => BROWSER_ICON[k] ?? '🎭'),
      systems: tech(agg.systems, (k) => OS_ICON[k] ?? '💽'),
      screens,
      connection,
      errors,
      jsNote: topJs && jsInPeriod > 0 ? { count: jsInPeriod, message: topJs.message.slice(0, 80), where: topJs.path, browser: topJs.browser } : null,
    },
    apiHealth,
    liveLog: log.slice(0, 80),
  };
}

function channelOfSpend(e: BackendEvent): string {
  return channelOf(String(e.data.source), e.data.medium ? String(e.data.medium) : null, '');
}
