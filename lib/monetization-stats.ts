// lib/monetization-stats.ts
//
// Frontend-only mock data for the real Monetization dashboard
// (MonetizationDashboard.tsx), shown once config.enabled is true.
// There's no ad pool and no event pipeline yet (see
// MonetizationAdTypeGrid.tsx's header comment), so every number here
// is generated locally — nothing is fetched, nothing is persisted.
// Shaped close to how real data will eventually look so swapping this
// out for a real `useMonetizationStats(uid, site, period)` hook later
// is a drop-in: same field names, same per-period bucket shape.
//
// lib/monetization.ts still owns the on/off config
// (MonetizationConfig, TIER1_AVG_CPM_USD) — this file is additive,
// for the dashboard content that appears once that flag is on.

export type StatsPeriod = '7d' | '30d' | '90d';

export const STATS_PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
];

export const DEFAULT_STATS_PERIOD: StatsPeriod = '30d';

export interface MonetizationSummary {
  impressions: number;
  impressionsDeltaPct: number;
  cpmUsd: number;
  cpmDeltaPct: number;
  clicks: number;
  clicksDeltaPct: number;
  topCountry: string;
  topCountryFlag: string;
  topCountryShare: number; // 0-1, share of impressions
  balanceUsd: number;
  pendingPayoutUsd: number;
  nextPayoutDate: string;
}

export interface DayPoint {
  label: string; // short axis label, e.g. "Oct 3"
  impressions: number;
  clicks: number;
}

export interface AdTypeBreakdown {
  id: string;
  label: string;
  impressions: number;
  ctr: number; // 0-1
}

export interface CountryRow {
  code: string;
  flag: string;
  name: string;
  impressions: number;
  share: number; // 0-1
}

export type LogEventType = 'impression' | 'click';

export interface LogRow {
  id: string;
  timestamp: string; // human label, e.g. "2m ago"
  adType: string;
  event: LogEventType;
  country: string;
  flag: string;
}

// Deterministic pseudo-random so the mock numbers don't jump around
// on every re-render / fast refresh.
function seeded(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const POINT_COUNTS: Record<StatsPeriod, number> = { '7d': 7, '30d': 30, '90d': 12 };

export function getDailySeries(period: StatsPeriod): DayPoint[] {
  const count = POINT_COUNTS[period];
  const points: DayPoint[] = [];
  const base = period === '90d' ? 9200 : period === '30d' ? 2600 : 2100;

  for (let i = 0; i < count; i++) {
    const wobble = seeded(i * 7.31 + 1) * 0.5 + seeded(i * 3.1 + 5) * 0.3;
    const trend = 1 + (i / count) * 0.35;
    const impressions = Math.round(base * trend * (0.7 + wobble));
    const clicks = Math.round(impressions * (0.006 + seeded(i * 11.3) * 0.01));

    let label: string;
    if (period === '90d') {
      label = `Wk ${i + 1}`;
    } else {
      const d = new Date();
      d.setDate(d.getDate() - (count - 1 - i));
      label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    points.push({ label, impressions, clicks });
  }
  return points;
}

export function getSummary(period: StatsPeriod): MonetizationSummary {
  const series = getDailySeries(period);
  const impressions = series.reduce((sum, p) => sum + p.impressions, 0);
  const clicks = series.reduce((sum, p) => sum + p.clicks, 0);

  return {
    impressions,
    impressionsDeltaPct: 12.4,
    cpmUsd: 3.18,
    cpmDeltaPct: 4.1,
    clicks,
    clicksDeltaPct: -2.3,
    topCountry: 'United States',
    topCountryFlag: '🇺🇸',
    topCountryShare: 0.38,
    balanceUsd: 0,
    pendingPayoutUsd: 0,
    nextPayoutDate: 'Once your balance reaches $25',
  };
}

export function getAdTypeBreakdown(): AdTypeBreakdown[] {
  return [
    { id: 'banner', label: 'Banner', impressions: 48200, ctr: 0.012 },
    { id: 'popup', label: 'Popup', impressions: 21300, ctr: 0.034 },
    { id: 'interstitial', label: 'Interstitial', impressions: 15800, ctr: 0.028 },
    { id: 'overlay', label: 'Full-screen overlay', impressions: 9600, ctr: 0.041 },
    { id: 'sticky-footer', label: 'Sticky footer', impressions: 12100, ctr: 0.017 },
  ];
}

export function getCountryBreakdown(): CountryRow[] {
  const rows: Omit<CountryRow, 'share'>[] = [
    { code: 'US', flag: '🇺🇸', name: 'United States', impressions: 41200 },
    { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', impressions: 18650 },
    { code: 'CA', flag: '🇨🇦', name: 'Canada', impressions: 13420 },
    { code: 'DE', flag: '🇩🇪', name: 'Germany', impressions: 9870 },
    { code: 'AU', flag: '🇦🇺', name: 'Australia', impressions: 7310 },
  ];
  const total = rows.reduce((sum, r) => sum + r.impressions, 0);
  return rows.map((r) => ({ ...r, share: r.impressions / total }));
}

export function getRecentLogs(): LogRow[] {
  const types = ['Banner', 'Popup', 'Interstitial', 'Full-screen overlay', 'Sticky footer'];
  const countries: [string, string][] = [
    ['United States', '🇺🇸'],
    ['United Kingdom', '🇬🇧'],
    ['Canada', '🇨🇦'],
    ['Germany', '🇩🇪'],
    ['Brazil', '🇧🇷'],
  ];
  const ago = ['Just now', '2m ago', '6m ago', '14m ago', '22m ago', '41m ago', '1h ago', '2h ago'];

  const rows: LogRow[] = [];
  for (let i = 0; i < 8; i++) {
    const adType = types[Math.floor(seeded(i * 5.7) * types.length)];
    const [name, flag] = countries[Math.floor(seeded(i * 9.2 + 2) * countries.length)];
    const event: LogEventType = seeded(i * 13.1) > 0.82 ? 'click' : 'impression';
    rows.push({
      id: `log-${i}`,
      timestamp: ago[i] ?? `${i + 1}h ago`,
      adType,
      event,
      country: name,
      flag,
    });
  }
  return rows;
}

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}
