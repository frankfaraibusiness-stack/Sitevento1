'use client';

// components/dashboard/AnalyticsPanel.tsx
//
// "Analytics" section for SiteManagePage.tsx. Every number here is a
// PURE CLIENT-SIDE DERIVATION over the Visit[] array the page already
// has in hand via useActiveSiteData (see lib/analytics.ts's own
// header) — no new Firestore reads, no new backend writes, no new
// usage-quota cost. lib/analytics.ts's buildDailySeries/topPages/
// topReferrers/deviceBreakdown/countryBreakdown/trendDelta were
// written in an earlier session but never rendered anywhere; this
// panel (plus sessionRollup/rumByPage/topExitPages/campaignBreakdown/
// utmSourceBreakdown, added alongside this panel) is what finally
// surfaces all of it.
//
// Built as a self-contained component (owns its own tab state, takes
// `visits` as a prop rather than re-subscribing) so SiteManagePage.tsx
// doesn't need to thread per-tab UI state through its own 500+ lines —
// same reasoning CustomEventsPanel.tsx gives for its own split, except
// this one takes visits as a prop instead of running its own
// subscription, since SiteManagePage already holds the exact same
// Visit[] array (from useActiveSiteData) that every derivation here
// needs — a second subscription to the same collection would be pure
// waste.
//
// No charting library in this codebase (checked before building this:
// no recharts/chart.js/etc in package.json) — the trend chart below is
// plain inline SVG bars, consistent with the "plain CSS, no new deps"
// visual language every other smp- panel already uses (the country
// breakdown's own bar-track/bar-fill divs are the same idea, just
// horizontal).
import { useMemo, useState } from 'react';
import type { Visit } from '@/lib/types';
import {
  buildDailySeries,
  topPages,
  topReferrers,
  deviceBreakdown,
  countryBreakdown,
  campaignBreakdown,
  utmSourceBreakdown,
  topExitPages,
  sessionRollup,
  rumByPage,
  trendDelta,
  type RankedItem,
} from '@/lib/analytics';

interface AnalyticsPanelProps {
  visits: Visit[];
}

type Tab = 'overview' | 'sessions' | 'campaigns' | 'speed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'speed', label: 'Speed' },
];

function RankList({ items, emptyLabel }: { items: RankedItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="smp-panel-empty">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="smp-rank-list">
      {items.map((item) => (
        <li className="smp-rank-row" key={item.label}>
          <span className="smp-rank-label" title={item.label}>
            {item.label}
          </span>
          <span className="smp-rank-bar-track">
            <span className="smp-rank-bar-fill" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
          </span>
          <span className="smp-rank-count">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

// Fixed-size SVG bar chart for the daily trend — no library, so the
// chart's own geometry (width/height/padding) is computed by hand.
// viewBox-based so it scales responsively via CSS (width: 100%,
// height: auto) rather than needing a resize observer.
function TrendChart({ series }: { series: ReturnType<typeof buildDailySeries> }) {
  const width = 680;
  const height = 180;
  const paddingBottom = 20;
  const paddingTop = 8;
  const barGap = 4;
  const barWidth = Math.max(4, (width - barGap * (series.length - 1)) / series.length);
  const maxVisits = Math.max(...series.map((d) => d.visits), 1);
  const chartHeight = height - paddingBottom - paddingTop;

  // Only label every Nth bar so labels don't collide on a wide series.
  const labelEvery = series.length > 21 ? 4 : series.length > 10 ? 2 : 1;

  return (
    <div className="smp-trend-chart-wrap">
      <svg
        className="smp-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Visits per day over the selected period"
      >
        {series.map((d, i) => {
          const barHeight = maxVisits > 0 ? (d.visits / maxVisits) * chartHeight : 0;
          const x = i * (barWidth + barGap);
          const y = paddingTop + (chartHeight - barHeight);
          return (
            <g key={d.date}>
              <rect className="smp-trend-bar" x={x} y={y} width={barWidth} height={Math.max(barHeight, d.visits > 0 ? 2 : 0)} rx={2}>
                <title>{`${d.label}: ${d.visits} visit${d.visits === 1 ? '' : 's'}, ${d.uniques} unique`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text className="smp-trend-axis-label" x={x + barWidth / 2} y={height - 4} textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="smp-trend-legend">
        <span>
          <span className="smp-trend-legend-dot" />
          Visits per day
        </span>
      </div>
    </div>
  );
}

export function AnalyticsPanel({ visits }: AnalyticsPanelProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [rangeDays, setRangeDays] = useState(14);

  const series = useMemo(() => buildDailySeries(visits, rangeDays), [visits, rangeDays]);
  const delta = useMemo(() => trendDelta(visits, 24), [visits]);
  const pages = useMemo(() => topPages(visits), [visits]);
  const referrers = useMemo(() => topReferrers(visits), [visits]);
  const devices = useMemo(() => deviceBreakdown(visits), [visits]);
  const countries = useMemo(() => countryBreakdown(visits), [visits]);
  const exitPages = useMemo(() => topExitPages(visits), [visits]);
  const session = useMemo(() => sessionRollup(visits), [visits]);
  const campaigns = useMemo(() => campaignBreakdown(visits), [visits]);
  const sources = useMemo(() => utmSourceBreakdown(visits), [visits]);
  const rum = useMemo(() => rumByPage(visits, 8), [visits]);

  if (visits.length === 0) {
    return (
      <div className="smp-section">
        <div className="smp-section-head">
          <h2>Analytics</h2>
        </div>
        <div className="smp-panel">
          <p className="smp-panel-empty">No visits tracked yet — analytics will appear once traffic starts coming in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="smp-section">
      <div className="smp-section-head">
        <h2>Analytics</h2>
      </div>

      <div className="smp-analytics-tabs" role="tablist" aria-label="Analytics views">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`smp-analytics-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="smp-panel smp-trend-card">
            <h3>
              Daily visits{' '}
              <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--walnut)' }}>
                ({delta.direction === 'flat' ? 'steady' : `${delta.direction === 'up' ? '+' : '-'}${delta.pct}%`} vs
                prior 24h)
              </span>
            </h3>
            <div className="smp-analytics-tabs" style={{ marginBottom: 12 }}>
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`smp-analytics-tab${rangeDays === d ? ' is-active' : ''}`}
                  onClick={() => setRangeDays(d)}
                >
                  {d}d
                </button>
              ))}
            </div>
            <TrendChart series={series} />
          </div>

          <div className="smp-rank-grid">
            <div className="smp-panel">
              <h3>Top pages</h3>
              <RankList items={pages} emptyLabel="No page data yet." />
            </div>
            <div className="smp-panel">
              <h3>Top referrers</h3>
              <RankList items={referrers} emptyLabel="No referrer data yet." />
            </div>
            <div className="smp-panel">
              <h3>Devices</h3>
              <RankList items={devices} emptyLabel="No device data yet." />
            </div>
            <div className="smp-panel">
              <h3>Countries</h3>
              <RankList items={countries} emptyLabel="No location data yet." />
            </div>
          </div>
        </>
      )}

      {tab === 'sessions' && (
        <>
          <div className="smp-session-grid">
            <div className="smp-stat-card">
              <span className="smp-stat-label">Sessions</span>
              <span className="smp-stat-value">{session.sessionCount}</span>
            </div>
            <div className="smp-stat-card">
              <span className="smp-stat-label">Pages / session</span>
              <span className="smp-stat-value">{session.avgPagesPerSession}</span>
            </div>
            <div className="smp-stat-card">
              <span className="smp-stat-label">Avg. duration</span>
              <span className="smp-stat-value">{formatDuration(session.avgSessionDurationSeconds)}</span>
            </div>
            <div className="smp-stat-card">
              <span className="smp-stat-label">Bounce rate</span>
              <span className="smp-stat-value">{session.bounceRatePct}%</span>
            </div>
          </div>
          <div className="smp-panel">
            <h3>Top exit pages</h3>
            <RankList items={exitPages} emptyLabel="Not enough session data yet." />
          </div>
        </>
      )}

      {tab === 'campaigns' && (
        <div className="smp-rank-grid">
          <div className="smp-panel">
            <h3>Top campaigns (utm_campaign)</h3>
            <RankList items={campaigns} emptyLabel="No tagged campaign traffic yet — link visits with ?utm_campaign=... to see them here." />
          </div>
          <div className="smp-panel">
            <h3>Top sources (utm_source)</h3>
            <RankList items={sources} emptyLabel="No tagged source traffic yet." />
          </div>
        </div>
      )}

      {tab === 'speed' && (
        <div className="smp-panel">
          <h3>
            Page load time (p75){' '}
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--walnut)' }}>— slowest pages first</span>
          </h3>
          {rum.length === 0 ? (
            <p className="smp-panel-empty">No load-time data yet.</p>
          ) : (
            <table className="smp-rum-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>p75 load time</th>
                  <th>Samples</th>
                </tr>
              </thead>
              <tbody>
                {rum.map((row) => (
                  <tr key={row.path}>
                    <td>
                      <span className="smp-rum-path" title={row.path}>
                        {row.path}
                      </span>
                    </td>
                    <td className={row.p75Ms > 3000 ? 'smp-rum-slow' : undefined}>{(row.p75Ms / 1000).toFixed(2)}s</td>
                    <td>{row.sampleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
