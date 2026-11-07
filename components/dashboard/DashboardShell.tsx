'use client';

// components/dashboard/DashboardShell.tsx
//
// The main /dashboard page. One site, one period at a time:
//   - hooks/useDashboardData.ts loads that site's visits for the chosen
//     period (one bounded query, then a 60-second poll — no always-on
//     listeners) plus exact counts for the headline numbers.
//   - lib/dashboardStats.ts turns the loaded visits into chart series,
//     country/page/device rankings and the hour-by-day heatmap.
//   - components/dashboard/dx/* draws the controls, charts and panels.
//
// Colours: .dx follows the live page background (see hooks/useBgTone.ts and
// styles/dashboard/dx-dashboard.css), so a custom Theme Colour from
// Settings > Appearance keeps every number readable.
import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';
import type { DashState } from '@/hooks/useSites';
import { useBgTone } from '@/hooks/useBgTone';
import { useDashboardData, useAccountTotals } from '@/hooks/useDashboardData';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { useSiteMonetization } from '@/hooks/useSiteMonetization';
import { addDays, dayKey, resolveRange, startOfDay, type CustomRange, type RangeId } from '@/lib/dashboardRange';
import { aggregateVisits, aggregateDeviceExperience, aggregateJourneys } from '@/lib/dashboardStats';
import { LivePill, RangePicker, RefreshControl, SiteSwitcher, siteHost } from '@/components/dashboard/dx/DxControls';
import { TREND_METRICS, TrendChart, type TrendMetric } from '@/components/dashboard/dx/DxCharts';
import {
  AccountPanel,
  BehaviorPanel,
  BreakdownPanel,
  CountriesPanel,
  DeviceExperiencePanel,
  JourneyPanel,
  KpiStrip,
  LiveFeed,
  MonetizationCard,
  Panel,
  ProtectionPanel,
  QuickToolsPanel,
  SampleNote,
  StateCard,
} from '@/components/dashboard/dx/DxPanels';

interface DashboardShellProps {
  user: User;
  sites: Site[];
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string) => void;
  activeSite: Site | null;
  dashState: DashState;
  errorMessage: string | null;
  disconnectSite: (siteId: string) => void;
  onOpenAddSiteModal: () => void;
  onResumeVerification: (site: { id: string; url: string }) => void;
  onLeadsCountChange: (count: number) => void;
}

// Site docs carry a server-incremented stats.totalVisits (app/api/track), which
// the Site type doesn't declare. Read it defensively.
function siteTotalVisits(site: Site): number {
  const n = (site as Site & { stats?: { totalVisits?: unknown } }).stats?.totalVisits;
  return typeof n === 'number' && isFinite(n) && n > 0 ? n : 0;
}

function toDateSafe(ts: { toDate: () => Date } | null | undefined): Date | null {
  if (!ts || typeof ts.toDate !== 'function') return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

// Placeholder panels while a site's first load is in flight. They carry the
// same layout classes as the real panels so the grid doesn't jump.
const SKELETON_CLASSES = [
  'dx-kpis',
  'dx-tools-panel',
  'dx-chart-panel',
  'dx-money',
  'dx-countries',
  'dx-breakdown',
  'dx-behavior',
  'dx-protect-panel',
];

export function DashboardShell({
  user,
  sites,
  activeSiteId,
  setActiveSiteId,
  activeSite,
  dashState,
  errorMessage,
  onOpenAddSiteModal,
  onResumeVerification,
  onLeadsCountChange,
}: DashboardShellProps) {
  const tone = useBgTone();

  const [rangeId, setRangeId] = useState<RangeId>('7d');
  const [custom, setCustom] = useState<CustomRange>({ from: '', to: '' });
  const [metric, setMetric] = useState<TrendMetric>('visits');

  // "Lifetime" runs from the day the site was connected. The day key is in
  // the dependency list so a tab left open overnight rolls "today" forward
  // on its next render (the 60s poll re-renders this component).
  const lifetimeStartMs = toDateSafe(activeSite?.createdAt)?.getTime() ?? null;
  const today = dayKey(startOfDay(new Date()));
  const range = useMemo(
    () => resolveRange(rangeId, custom, lifetimeStartMs ? new Date(lifetimeStartMs) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeId, custom.from, custom.to, lifetimeStartMs, today]
  );

  const { data, status, refreshing, error, updatedAt, refresh, loadTick } = useDashboardData(
    user.uid,
    activeSite?.id ?? null,
    range
  );
  const totals = useAccountTotals(user.uid, sites, loadTick);
  const { limits } = useAccountLimits(user);
  const { config: monetization } = useSiteMonetization(user.uid, activeSite);

  const agg = useMemo(
    () =>
      aggregateVisits(data.visits, range, {
        coveredFrom: data.coveredFrom,
        clicksByDay: data.clicksByDay,
        now: updatedAt ?? Date.now(),
      }),
    [data.visits, data.coveredFrom, data.clicksByDay, range, updatedAt]
  );

  // Device experience intelligence — pure derivation over the same
  // visits + the attributed leads useDashboardData already downloaded
  // for this range; see lib/dashboardStats.ts's aggregateDeviceExperience
  // for the full reasoning (no new reads, no new writes).
  const deviceExp = useMemo(
    () => aggregateDeviceExperience(data.visits, data.leadsAttributed),
    [data.visits, data.leadsAttributed]
  );

  // Visitor journey intelligence — same "no new reads" derivation as
  // deviceExp above; see lib/dashboardStats.ts's aggregateJourneys.
  const journeys = useMemo(
    () => aggregateJourneys(data.visits, data.leadsAttributed),
    [data.visits, data.leadsAttributed]
  );

  // The sidebar shows the email count as a badge.
  useEffect(() => {
    onLeadsCountChange(data.leadsTotal);
  }, [data.leadsTotal, onLeadsCountChange]);

  const allSitesVisits = useMemo(() => sites.reduce((n, s) => n + siteTotalVisits(s), 0), [sites]);
  const verifiedCount = useMemo(() => sites.filter((s) => s.status === 'verified' && !s.paused).length, [sites]);

  const verified = activeSite?.status === 'verified';
  const firstLoad = status === 'loading' && updatedAt === null;
  const switching = status === 'loading' && updatedAt !== null;

  function onRangeChange(id: RangeId, next?: CustomRange) {
    if (next) setCustom(next);
    setRangeId(id);
  }

  // ── No sites / sites failed to load ─────────────────────────────
  if (dashState === 'empty') {
    return (
      <div className="dx" data-tone={tone}>
        <div className="dx-wrap" id="dashMain">
          <StateCard
            title="Connect your first site"
            body="Add the sitevento tag to your website and its visits, countries and clicks will show up here."
            actionLabel="Connect a site"
            onAction={onOpenAddSiteModal}
          />
        </div>
      </div>
    );
  }

  if (dashState === 'error') {
    return (
      <div className="dx" data-tone={tone}>
        <div className="dx-wrap" id="dashMain">
          <StateCard
            title="We couldn’t load your sites"
            body={errorMessage || 'Check your connection and reload the page.'}
            actionLabel="Reload"
            onAction={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dx" data-tone={tone}>
      <div className="dx-wrap" id="dashMain">
        {/* Deliberately a <div>, not a <header> — base.css's bare
            `header { position: fixed; ... }` rule matches ANY <header>
            element on the page, not just the real app-level one
            (components/layout/Header.tsx). This row used to be a
            <header> and was silently being pinned fixed to the top of
            the viewport on top of the real header, which is why the
            site switcher / live pill / refresh controls and the
            period chips below them used to visually collide. */}
        <div className="dx-top">
          <div className="dx-top-left">
            <h1 className="dx-title">Overview</h1>
            <SiteSwitcher sites={sites} activeSiteId={activeSiteId} onChange={setActiveSiteId} onAdd={onOpenAddSiteModal} />
          </div>
          <div className="dx-top-right">
            <LivePill count={agg.activeNow} />
            <RefreshControl onRefresh={refresh} refreshing={refreshing} updatedAt={updatedAt} live={range.live} error={error} />
          </div>
        </div>

        <RangePicker value={rangeId} custom={custom} onChange={onRangeChange} />

        {activeSite && activeSite.paused && (
          <p className="dx-banner" role="status">
            Tracking is paused for {siteHost(activeSite)}. New visits aren’t being recorded until you resume it.
          </p>
        )}
        {activeSite && !activeSite.paused && !verified && (
          <p className="dx-banner" role="status">
            {siteHost(activeSite)} isn’t verified yet, so no visits are coming in.{' '}
            <button
              type="button"
              className="dx-link"
              onClick={() => onResumeVerification({ id: activeSite.id, url: activeSite.url })}
            >
              Finish verification
            </button>
          </p>
        )}

        {status === 'error' && !firstLoad ? (
          <StateCard
            title="We couldn’t load this site"
            body={error || 'Check your connection and try again.'}
            actionLabel="Try again"
            onAction={refresh}
          />
        ) : firstLoad ? (
          <div className="dx-grid" aria-busy="true" aria-label="Loading analytics">
            {SKELETON_CLASSES.map((c) => (
              <section key={c} className={`dx-panel dx-skel ${c}`} />
            ))}
          </div>
        ) : (
          <>
            <div className={switching ? 'dx-grid is-switching' : 'dx-grid'}>
              <KpiStrip data={data} agg={agg} range={range} />

              <QuickToolsPanel />

              <Panel
                className="dx-chart-panel"
                title="Traffic"
                hint={range.label}
                action={
                  <div className="dx-metric-tabs" role="tablist" aria-label="Chart metric">
                    {TREND_METRICS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="tab"
                        aria-selected={metric === m.id}
                        className={metric === m.id ? 'dx-tab is-on' : 'dx-tab'}
                        onClick={() => setMetric(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <TrendChart series={agg.series} metric={metric} clicksAvailable={agg.clicksAvailable} />
                {metric === 'visits' && (
                  <p className="dx-legend">
                    <span>
                      <i className="dx-sw" /> Visits
                    </span>
                    <span>
                      <i className="dx-sw is-2" /> Unique users
                    </span>
                  </p>
                )}
                <LiveFeed agg={agg} />
                <SampleNote visible={data.truncated} loaded={agg.loaded} total={data.total} since={data.coveredFrom} />
              </Panel>

              <MonetizationCard data={data} range={range} config={monetization} verified={verified} />

              <CountriesPanel agg={agg} total={data.total} />

              <BreakdownPanel agg={agg} />

              <DeviceExperiencePanel deviceExp={deviceExp} brokenLinks={data.brokenLinks} />

              <JourneyPanel journeys={journeys} />

              <BehaviorPanel
                data={data}
                agg={agg}
                range={range}
                siteStats={{
                  impressions: activeSite?.overlayStats?.impressions ?? 0,
                  ctaClicks: activeSite?.overlayStats?.ctaClicks ?? 0,
                }}
              />

              <ProtectionPanel data={data} />
            </div>

            <div className="dx-grid" style={{ marginTop: 14 }}>
              <AccountPanel
                limits={limits}
                totals={totals}
                siteCount={sites.length}
                allSitesVisits={allSitesVisits}
                verifiedCount={verifiedCount}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
