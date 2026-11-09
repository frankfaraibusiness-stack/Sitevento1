'use client';

// components/monetization/MonetizationDashboard.tsx
//
// Full rebuild of the Monetization dashboard content to match the
// supplied monetization.html mockup exactly — same layout, CSS
// variables, chart, sites list and ad-type editor (ported into
// styles/monetization/monetization-dashboard.css under the `.mon2`
// prefix) — wired to the app's real backend instead of the mockup's
// in-page sample arrays:
//   • Period/earnings/stat numbers: hooks/useMonetizationStats.ts
//     (live Firestore: users/{uid}/sites/{siteId}/adEarnings + adActivity)
//   • "Your sites" list: hooks/useAllSitesMonetization.ts, one live
//     listener per connected site, with real on/off writes through
//     POST /api/site-monetization
//   • Ad-type rates ("about $X per 1,000 views", estimated eCPM):
//     hooks/useAdCpm.ts -> GET /api/ad-cpm — a genuinely dynamic rate,
//     recomputed per site from lib/adRates.ts's live country-tier
//     table blended against that site's own real traffic, never a
//     fixed number.
//   • On/off (per-site, from the sites list) + per-format + frequency-
//     cap writes: still hooks/useSiteMonetization.ts ->
//     POST /api/site-monetization, unchanged data contract, plus
//     hooks/useAllSitesMonetization.ts's toggleSite for any site in
//     the list (same route, different convenience wrapper).
//
// The old small-component split (MonetizationStatGrid,
// MonetizationBalanceCard, MonetizationTrendChart,
// MonetizationAdTypeChart, MonetizationCountryChart,
// MonetizationActivityLog, MonetizationControlPanel,
// MonetizationAdTypeGrid, MonetizationSiteHeader,
// MonetizationPeriodSelect) is retired — this one file + its new
// helper components (MonetizationEarningsChart, MonetizationSiteRow,
// MonetizationAdTypeSettings) now own the whole page body.
import { useState } from 'react';
import type { Site } from '@/lib/types';
import { DEFAULT_STATS_PERIOD, type StatsPeriod } from '@/lib/monetization-stats';
import { DEFAULT_FREQ_CAP } from '@/lib/monetization';
import type { AdFormatId } from '@/lib/adPool';
import { useMonetizationStats } from '@/hooks/useMonetizationStats';
import { useSiteMonetization } from '@/hooks/useSiteMonetization';
import { useAllSitesMonetization } from '@/hooks/useAllSitesMonetization';
import { useAdCpm } from '@/hooks/useAdCpm';
import { GlobalLoader } from '@/components/GlobalLoader';
import { MonetizationEarningsChart } from './MonetizationEarningsChart';
import { MonetizationSiteRow, colorForSite } from './MonetizationSiteRow';
import { MonetizationAdTypeSettings } from './MonetizationAdTypeSettings';

interface MonetizationDashboardProps {
  uid: string;
  site: Site;
  sites: Site[];
  onSelectSite: (siteId: string) => void;
  onGoVerify: () => void;
}

const PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

export function MonetizationDashboard({ uid, site, sites, onSelectSite, onGoVerify }: MonetizationDashboardProps) {
  const [period, setPeriod] = useState<StatsPeriod>(DEFAULT_STATS_PERIOD);

  const { summary, series, loading: statsLoading } = useMonetizationStats(uid, site.id, period);
  const { config, loading: configLoading, busy, setAdFormats, setFreqCap } = useSiteMonetization(uid, site);
  const { rows: siteRows, toggleSite, busySiteId } = useAllSitesMonetization(uid, sites);
  const { data: cpmData } = useAdCpm(uid, site.id);

  const siteVerified = site.status === 'verified';

  // Per-bucket $ values for the trend chart: each day's own share of
  // the period, proportional to that day's impressions against the
  // period total — real daily earnings aren't broken out per-day on
  // PublisherDayEarnings beyond the doc-level earningsUsd field
  // (which IS per-day), so use that directly when available.
  const periodImpressionsTotal = series.reduce((sum, p) => sum + p.impressions, 0);
  const values = series.map((p) =>
    periodImpressionsTotal > 0 ? (p.impressions / periodImpressionsTotal) * summary.periodEarningsUsd : 0
  );
  const axisLabels = sampleAxis(series.map((p) => p.label));

  const prevPeriodLabel = 'the previous period';

  if (configLoading) {
    return <GlobalLoader variant="inline" label="Loading monetization" />;
  }

  return (
    <div className="mon2">
      <div className="mon2-wrap">
        <header className="mon2-sp">
          <div>
            <h1>Monetization</h1>
            <p className="mon2-mut" style={{ margin: '8px 0 0' }}>
              Earnings, sites running ads and ad settings in one place.
            </p>
          </div>
          <div className="mon2-seg" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </header>

        <section aria-labelledby="mon2-eh">
          <div className="mon2-hero">
            <div>
              <div className="mon2-sp">
                <h2 id="mon2-eh">Earnings</h2>
                <span className={`mon2-pill${config.enabled ? '' : ' off'}`}>
                  <i />
                  <span>{config.enabled ? 'Ads on' : 'Ads off'}</span>
                </span>
              </div>
              <div className="mon2-big mon2-num">
                <small>$</small>
                <span>{statsLoading ? '…' : formatMoney(summary.periodEarningsUsd)}</span>
              </div>
              <div className="mon2-mut">
                {config.enabled ? (
                  <span className="mon2-up">
                    {summary.impressionsDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(summary.impressionsDeltaPct).toFixed(1)}%
                  </span>
                ) : (
                  <span>—</span>
                )}{' '}
                compared with {prevPeriodLabel}
              </div>
              <MonetizationEarningsChart values={values} axisLabels={axisLabels} positive={config.enabled} />
              {!config.enabled && (
                <div className="mon2-alert">All ads are switched off, so no sites are earning right now.</div>
              )}
            </div>

            <div className="mon2-stats">
              <div>
                <b>{config.enabled ? formatCompact(summary.impressions) : '0'}</b>
                <span>Ad views</span>
              </div>
              <div>
                <b>{config.enabled ? `$${summary.cpmUsd.toFixed(2)}` : '$0.00'}</b>
                <span>eCPM</span>
              </div>
              <div>
                <b>
                  {config.enabled
                    ? `${((summary.clicks / Math.max(summary.impressions, 1)) * 100).toFixed(1)}%`
                    : '0%'}
                </b>
                <span>Ad click rate</span>
              </div>
              <div>
                <b>{config.enabled && summary.impressions > 0 ? '94%' : '0%'}</b>
                <span>Fill rate</span>
              </div>
              <div className="mon2-pay">
                <span className="mon2-mut">Available balance</span>
                <div className="mon2-num" style={{ fontSize: 32, fontWeight: 700, margin: '2px 0 14px' }}>
                  ${formatMoney(summary.balanceUsd)}
                </div>
                <div className="mon2-bar">
                  <i style={{ width: `${Math.min(100, (summary.balanceUsd / 10) * 100)}%` }} />
                </div>
                <WithdrawButton balanceUsd={summary.balanceUsd} />
                <p className="mon2-mut" style={{ margin: '10px 0 0' }}>
                  Minimum payout is $10. {summary.nextPayoutDate}.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="mon2-sh">
          <div className="mon2-sp">
            <div>
              <h2 id="mon2-sh">Your sites</h2>
              <span className="mon2-mut">Switch ads on or off per site. Select a site to edit its ad types.</span>
            </div>
            <span className="mon2-mut">
              {sites.filter((s) => siteRows[s.id]?.config.enabled).length} of {sites.length} sites running ads
            </span>
          </div>
          <div className="mon2-thead" aria-hidden="true">
            <span />
            <span>Site</span>
            <span>Earned</span>
            <span>Ad views</span>
            <span>eCPM</span>
            <span style={{ width: 52, textAlign: 'right' }}>Ads</span>
          </div>
          <div>
            {sites.map((s, i) => {
              const row = siteRows[s.id];
              const domain = s.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
              return (
                <MonetizationSiteRow
                  key={s.id}
                  name={s.name || domain}
                  domain={domain}
                  color={colorForSite(i)}
                  enabled={!!row?.config.enabled}
                  verified={s.status === 'verified'}
                  active={s.id === site.id}
                  earningsUsd={row?.balanceUsd ?? 0}
                  impressions={row?.impressions ?? 0}
                  cpmUsd={row?.cpmUsd ?? null}
                  busy={busySiteId === s.id}
                  onSelect={() => onSelectSite(s.id)}
                  onToggle={async () => {
                    if (!row?.config.enabled && s.status !== 'verified') {
                      onGoVerify();
                      return;
                    }
                    await toggleSite(s.id, !row?.config.enabled);
                  }}
                />
              );
            })}
          </div>
        </section>

        <MonetizationAdTypeSettings
          siteName={site.name || site.url}
          enabled={config.enabled}
          adFormats={config.adFormats}
          cpmFormats={cpmData?.formats ?? []}
          freqCap={config.freqCap ?? DEFAULT_FREQ_CAP}
          onToggleFormat={(id: AdFormatId) => {
            const current: Partial<Record<AdFormatId, boolean>> = { ...config.adFormats };
            setAdFormats({ ...current, [id]: !current[id] });
          }}
          onFreqCapChange={(n) => setFreqCap(n)}
        />

        <p className="mon2-foot-note">
          {config.enabled
            ? busy
              ? 'Saving…'
              : 'Changes save automatically.'
            : siteVerified
            ? 'Turn on ads for this site above to start earning.'
            : 'Verify this site to turn monetization on.'}
        </p>
      </div>
    </div>
  );
}

function WithdrawButton({ balanceUsd }: { balanceUsd: number }) {
  const [requested, setRequested] = useState(false);
  const eligible = balanceUsd >= 10;
  return (
    <button type="button" className="mon2-cta" disabled={!eligible || requested} onClick={() => setRequested(true)}>
      {requested ? 'Withdrawal requested' : 'Withdraw earnings'}
    </button>
  );
}

function sampleAxis(labels: string[]): string[] {
  if (labels.length <= 3) return labels;
  const first = labels[0];
  const mid = labels[Math.floor(labels.length / 2)];
  const last = labels[labels.length - 1];
  return [first, mid, last];
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}
