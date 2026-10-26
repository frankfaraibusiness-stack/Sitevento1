'use client';

// components/monetization/MonetizationDashboard.tsx
//
// The real monetization dashboard — everything shown in place of the
// old placeholder note once config.enabled is true (see
// MonetizationPageClient.tsx). Numbers now come from
// hooks/useMonetizationStats.ts (live Firestore — adEarnings +
// adActivity), not lib/monetization-stats.ts's mock generators; that
// file's TYPES are still the contract every child component below
// reads (MonetizationSummary/DayPoint/AdTypeBreakdown/CountryRow/
// LogRow), so none of them needed prop changes — only this
// component's data source did. Structure, top to bottom:
//   1. Site header + period selector (default 30d)
//   2. Stat grid — Impressions, CPM, Clicks, Top country
//   3. Balance card — full-width, standalone (lifetime balance)
//   4. Charts — trend over time, by ad type, by country
//   5. Ad format toggles (now persisted — see MonetizationAdTypeGrid)
//   6. Recent activity log
// Styled with styles/monetization/monetization-dashboard.css's
// `mon-` classes, following the stat-tile/toggle-row conventions
// already established by dashboard-premium.css and agent-page.css.
import { useState } from 'react';
import type { Site } from '@/lib/types';
import { DEFAULT_STATS_PERIOD, type StatsPeriod } from '@/lib/monetization-stats';
import { useMonetizationStats } from '@/hooks/useMonetizationStats';
import { useSiteMonetization } from '@/hooks/useSiteMonetization';
import { MonetizationSiteHeader } from './MonetizationSiteHeader';
import { MonetizationStatGrid } from './MonetizationStatGrid';
import { MonetizationBalanceCard } from './MonetizationBalanceCard';
import { MonetizationTrendChart } from './MonetizationTrendChart';
import { MonetizationAdTypeChart } from './MonetizationAdTypeChart';
import { MonetizationCountryChart } from './MonetizationCountryChart';
import { MonetizationAdTypeGrid } from './MonetizationAdTypeGrid';
import { MonetizationActivityLog } from './MonetizationActivityLog';

interface MonetizationDashboardProps {
  uid: string;
  site: Site;
}

export function MonetizationDashboard({ uid, site }: MonetizationDashboardProps) {
  const [period, setPeriod] = useState<StatsPeriod>(DEFAULT_STATS_PERIOD);

  const { summary, series, adTypeData, countryData, logs, hasAnyData, loading } = useMonetizationStats(uid, site.id, period);

  // Same hook MonetizationPageClient.tsx already reads for the on/off
  // switch — reused here so the ad-format toggle grid below can read
  // config.adFormats and persist through the same setAdFormats
  // setter, instead of its old local-only useState.
  const { config, setAdFormats } = useSiteMonetization(uid, site);

  return (
    <div className="mon-dash">
      <MonetizationSiteHeader site={site} period={period} onPeriodChange={setPeriod} />

      <MonetizationStatGrid summary={summary} />

      <MonetizationBalanceCard summary={summary} />

      <section className="mon-section">
        <div className="mon-section-head">
          <h2 className="mon-section-title">Stats</h2>
        </div>
        {!loading && !hasAnyData ? (
          <p className="mon-row-note">
            No ad activity yet — ads will start showing once your site has live traffic and the ad pool has advertisers.
          </p>
        ) : (
          <div className="mon-chart-stack">
            <MonetizationTrendChart series={series} />
            <div className="mon-chart-row">
              <MonetizationAdTypeChart data={adTypeData} />
              <MonetizationCountryChart data={countryData} />
            </div>
          </div>
        )}
      </section>

      <MonetizationAdTypeGrid adFormats={config.adFormats} onChange={setAdFormats} />

      {hasAnyData && <MonetizationActivityLog rows={logs} />}
    </div>
  );
}
