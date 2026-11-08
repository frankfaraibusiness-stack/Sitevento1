'use client';

// components/monetization/MonetizationDashboard.tsx
//
// The whole Monetization page content, always mounted once a user and
// an active site are known (see MonetizationPageClient.tsx — the old
// full-screen "off" gate is gone). Structure, top to bottom:
//   1. Site header + period selector
//   2. Inline on/off control (MonetizationControlPanel) — replaces the
//      old non-dismissable dark overlay with a single switch that
//      reads "No ads are running yet" until it's flipped on
//   3. Hero stat cards — Impressions, Clicks, CTR, CPM, Revenue
//   4. Trend chart + breakdown charts (ad type, country) — hidden
//      behind a calm empty state until there's real activity
//   5. Ad format settings, grouped and labelled
//   6. Recent activity feed
// Data still comes from hooks/useMonetizationStats.ts (live Firestore)
// and hooks/useSiteMonetization.ts (the on/off + format flags) — this
// pass only touches presentation, not the data contract.
import { useState } from 'react';
import type { Site } from '@/lib/types';
import { DEFAULT_STATS_PERIOD, type StatsPeriod } from '@/lib/monetization-stats';
import { useMonetizationStats } from '@/hooks/useMonetizationStats';
import { useSiteMonetization } from '@/hooks/useSiteMonetization';
import { MonetizationSiteHeader } from './MonetizationSiteHeader';
import { MonetizationControlPanel } from './MonetizationControlPanel';
import { MonetizationStatGrid } from './MonetizationStatGrid';
import { MonetizationBalanceCard } from './MonetizationBalanceCard';
import { MonetizationTrendChart } from './MonetizationTrendChart';
import { MonetizationAdTypeChart } from './MonetizationAdTypeChart';
import { MonetizationCountryChart } from './MonetizationCountryChart';
import { MonetizationAdTypeGrid } from './MonetizationAdTypeGrid';
import { MonetizationActivityLog } from './MonetizationActivityLog';
import { GlobalLoader } from '@/components/GlobalLoader';

interface MonetizationDashboardProps {
  uid: string;
  site: Site;
  onGoVerify: () => void;
}

export function MonetizationDashboard({ uid, site, onGoVerify }: MonetizationDashboardProps) {
  const [period, setPeriod] = useState<StatsPeriod>(DEFAULT_STATS_PERIOD);

  const { summary, series, adTypeData, countryData, logs, hasAnyData, loading: statsLoading } = useMonetizationStats(
    uid,
    site.id,
    period
  );
  const { config, loading: configLoading, busy, setEnabled, setAdFormats } = useSiteMonetization(uid, site);

  const siteVerified = site.status === 'verified';

  if (configLoading) {
    return <GlobalLoader variant="inline" label="Loading monetization" />;
  }

  return (
    <div className="mon-dash">
      <MonetizationSiteHeader site={site} period={period} onPeriodChange={setPeriod} />

      <MonetizationControlPanel
        enabled={config.enabled}
        busy={busy}
        siteVerified={siteVerified}
        setEnabled={setEnabled}
        onGoVerify={onGoVerify}
      />

      <MonetizationStatGrid summary={summary} series={series} enabled={config.enabled} />

      <MonetizationBalanceCard summary={summary} enabled={config.enabled} />

      <section className="mon-section">
        <div className="mon-section-head">
          <h2 className="mon-section-title">Performance</h2>
          {hasAnyData && <span className="mon-section-count">Last {PERIOD_LABEL[period]}</span>}
        </div>
        {!statsLoading && !hasAnyData ? (
          <EmptyStats enabled={config.enabled} />
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

      {hasAnyData ? <MonetizationActivityLog rows={logs} /> : null}
    </div>
  );
}

const PERIOD_LABEL: Record<StatsPeriod, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

function EmptyStats({ enabled }: { enabled: boolean }) {
  return (
    <div className="mon-empty-card">
      <div className="mon-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M21 7h-6" />
          <path d="M21 7v6" />
        </svg>
      </div>
      <p className="mon-empty-title">No activity yet</p>
      <p className="mon-empty-sub">
        {enabled
          ? 'Your charts will fill in as soon as real visits start showing ads.'
          : 'Turn monetization on above and your stats will start showing up here.'}
      </p>
    </div>
  );
}
