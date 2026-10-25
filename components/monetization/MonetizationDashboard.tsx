'use client';

// components/monetization/MonetizationDashboard.tsx
//
// The real monetization dashboard — everything shown in place of the
// old placeholder note once config.enabled is true (see
// MonetizationPageClient.tsx). Frontend/design only: every number
// comes from lib/monetization-stats.ts's mock generators, nothing is
// fetched or persisted. Structure, top to bottom:
//   1. Site header + period selector (default 30d)
//   2. Stat grid — Impressions, CPM, Clicks, Top country
//   3. Balance card — full-width, standalone
//   4. Charts — trend over time, by ad type, by country
//   5. Ad format toggles (the future ad pool's on/off switches)
//   6. Recent activity log
// Styled with styles/monetization/monetization-dashboard.css's
// `mon-` classes, following the stat-tile/toggle-row conventions
// already established by dashboard-premium.css and agent-page.css.
import { useMemo, useState } from 'react';
import type { Site } from '@/lib/types';
import {
  DEFAULT_STATS_PERIOD,
  getAdTypeBreakdown,
  getCountryBreakdown,
  getDailySeries,
  getRecentLogs,
  getSummary,
  type StatsPeriod,
} from '@/lib/monetization-stats';
import { MonetizationSiteHeader } from './MonetizationSiteHeader';
import { MonetizationStatGrid } from './MonetizationStatGrid';
import { MonetizationBalanceCard } from './MonetizationBalanceCard';
import { MonetizationTrendChart } from './MonetizationTrendChart';
import { MonetizationAdTypeChart } from './MonetizationAdTypeChart';
import { MonetizationCountryChart } from './MonetizationCountryChart';
import { MonetizationAdTypeGrid } from './MonetizationAdTypeGrid';
import { MonetizationActivityLog } from './MonetizationActivityLog';

interface MonetizationDashboardProps {
  site: Site;
}

export function MonetizationDashboard({ site }: MonetizationDashboardProps) {
  const [period, setPeriod] = useState<StatsPeriod>(DEFAULT_STATS_PERIOD);

  // Recomputed per period change only — the ad-type/country breakdowns
  // and the log are intentionally period-independent mock snapshots
  // (no per-period variant exists yet), same way a real aggregation
  // pipeline would likely keep "all time top ad types" separate from
  // the time-boxed trend line.
  const summary = useMemo(() => getSummary(period), [period]);
  const series = useMemo(() => getDailySeries(period), [period]);
  const adTypeData = useMemo(() => getAdTypeBreakdown(), []);
  const countryData = useMemo(() => getCountryBreakdown(), []);
  const logs = useMemo(() => getRecentLogs(), []);

  return (
    <div className="mon-dash">
      <MonetizationSiteHeader site={site} period={period} onPeriodChange={setPeriod} />

      <MonetizationStatGrid summary={summary} />

      <MonetizationBalanceCard summary={summary} />

      <section className="mon-section">
        <div className="mon-section-head">
          <h2 className="mon-section-title">Stats</h2>
        </div>
        <div className="mon-chart-stack">
          <MonetizationTrendChart series={series} />
          <div className="mon-chart-row">
            <MonetizationAdTypeChart data={adTypeData} />
            <MonetizationCountryChart data={countryData} />
          </div>
        </div>
      </section>

      <MonetizationAdTypeGrid />

      <MonetizationActivityLog rows={logs} />
    </div>
  );
}
