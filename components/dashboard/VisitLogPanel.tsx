// components/dashboard/VisitLogPanel.tsx — the Analytics tab.
//
// Previously just the raw visit-row table. Rebuilt to look like the
// siterifty seller dashboard's analytics view: a KPI row (visits,
// unique visitors, top page, top source — each with a trend delta), a
// visits-over-time chart, top pages/referrers/devices/countries
// breakdowns, then the detailed per-visit log below. All derived
// client-side from the same `visits` array (lib/analytics.ts) — no new
// Firestore reads.
'use client';

import { useMemo, useState } from 'react';
import { formatTs } from '@/lib/format';
import type { Visit } from '@/lib/types';
import {
  buildDailySeries,
  countryBreakdown,
  deviceBreakdown,
  topPages,
  topReferrers,
  trendDelta,
} from '@/lib/analytics';
import { BarList, TrendChart } from './AnalyticsCharts';

interface VisitLogPanelProps {
  visits: Visit[];
  onToggleBlock: (visitId: string, blockedValue: boolean, visitorId: string) => void;
}

type RangeOption = 7 | 14 | 30;

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
  </svg>
);
const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5" />
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M9.5 14.5l5-5" />
    <path d="M7 17a4 4 0 0 1 0-5.6l2-2" />
    <path d="M17 7a4 4 0 0 1 0 5.6l-2 2" />
  </svg>
);
const TrendUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="M4 15l6-6 4 4 6-8" />
    <path d="M14 5h6v6" />
  </svg>
);
const TrendDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="M4 9l6 6 4-4 6 8" />
    <path d="M14 19h6v-6" />
  </svg>
);

function KpiChange({ pct, direction }: { pct: number; direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'flat') return null;
  return (
    <span className={`ac-kpi-change ${direction}`}>
      {direction === 'up' ? <TrendUpIcon /> : <TrendDownIcon />}
      {pct}%
    </span>
  );
}

export function VisitLogPanel({ visits, onToggleBlock }: VisitLogPanelProps) {
  const [range, setRange] = useState<RangeOption>(14);

  const daily = useMemo(() => buildDailySeries(visits, range), [visits, range]);
  const pages = useMemo(() => topPages(visits), [visits]);
  const referrers = useMemo(() => topReferrers(visits), [visits]);
  const devices = useMemo(() => deviceBreakdown(visits), [visits]);
  const countries = useMemo(() => countryBreakdown(visits), [visits]);
  const delta = useMemo(() => trendDelta(visits, 24), [visits]);

  const totalVisits = visits.length;
  const uniqueVisitors = useMemo(() => new Set(visits.map((v) => v.visitorId || v.id)).size, [visits]);
  const topPage = pages[0]?.label || '—';
  const topSource = referrers[0]?.label || '—';

  return (
    <div className="dash-panel ac-panel" id="panelVisits">
      <div className="dash-panel-head">
        <div>
          <h3>Analytics</h3>
          <span className="dp-sub">How this site is performing, and who&apos;s landed on it.</span>
        </div>
        <div className="ac-range-switch" role="group" aria-label="Date range">
          {([7, 14, 30] as RangeOption[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`ac-range-btn${range === r ? ' is-active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="dash-panel-body">
        <div className="ac-kpi-grid">
          <div className="ac-kpi-card ac-tone-green">
            <span className="ac-kpi-icon"><EyeIcon /></span>
            <span className="ac-kpi-label">Visits</span>
            <span className="ac-kpi-value">{totalVisits}</span>
            <KpiChange {...delta} />
          </div>
          <div className="ac-kpi-card ac-tone-purple">
            <span className="ac-kpi-icon"><PersonIcon /></span>
            <span className="ac-kpi-label">Unique Visitors</span>
            <span className="ac-kpi-value">{uniqueVisitors}</span>
          </div>
          <div className="ac-kpi-card ac-tone-blue">
            <span className="ac-kpi-icon"><FileIcon /></span>
            <span className="ac-kpi-label">Top Page</span>
            <span className="ac-kpi-value ac-kpi-value-text" title={topPage}>{topPage}</span>
          </div>
          <div className="ac-kpi-card ac-tone-orange">
            <span className="ac-kpi-icon"><LinkIcon /></span>
            <span className="ac-kpi-label">Top Source</span>
            <span className="ac-kpi-value ac-kpi-value-text" title={topSource}>{topSource}</span>
          </div>
        </div>

        <div className="ac-chart-card">
          <div className="ac-chart-head">
            <h4>Visits over time</h4>
            <span className="ac-legend">
              <span className="ac-legend-item"><i className="ac-dot ac-dot-visits" />Visits</span>
              <span className="ac-legend-item"><i className="ac-dot ac-dot-uniques" />Unique visitors</span>
            </span>
          </div>
          <TrendChart data={daily} />
        </div>

        <div className="ac-breakdown-grid">
          <div className="ac-chart-card">
            <div className="ac-chart-head"><h4>Top pages</h4></div>
            <BarList items={pages} tone="blue" />
          </div>
          <div className="ac-chart-card">
            <div className="ac-chart-head"><h4>Top referrers</h4></div>
            <BarList items={referrers} tone="purple" />
          </div>
          <div className="ac-chart-card">
            <div className="ac-chart-head"><h4>Devices</h4></div>
            <BarList items={devices} tone="green" />
          </div>
          <div className="ac-chart-card">
            <div className="ac-chart-head"><h4>Countries</h4></div>
            <BarList items={countries} tone="orange" />
          </div>
        </div>

        <div className="ac-log-head">
          <h4>Visit log</h4>
          <span className="dp-sub">Everyone who&apos;s landed on this site, in real time.</span>
        </div>

        {visits.length === 0 ? (
          <div className="empty-row">No visits logged yet for this site.</div>
        ) : (
          visits.map((v) => (
            <div key={v.id} className={`visit-row${v.blocked ? ' blocked' : ''}`}>
              <span className="v-path">
                {v.landing && <span className="v-landing-badge" title="Landing page">Entry</span>}
                {v.path || '/'}
              </span>
              <span className="v-meta">
                {v.referrer || 'Direct'} &middot; {v.device || 'Unknown device'}
                {v.browser ? ` (${v.browser}${v.os ? ' / ' + v.os : ''})` : ''} &middot; {v.country || 'Unknown'}
                {v.city ? `, ${v.city}` : ''}
              </span>
              <span className="v-meta">{formatTs(v.ts)}</span>
              <span className="v-status">
                <span className="vdot" />
                {v.blocked ? 'Blocked' : 'Allowed'}
              </span>
              <button className="v-block" onClick={() => onToggleBlock(v.id, !v.blocked, v.visitorId || '')}>
                {v.blocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
