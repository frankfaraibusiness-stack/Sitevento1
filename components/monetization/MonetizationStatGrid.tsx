'use client';

// components/monetization/MonetizationStatGrid.tsx
//
// Hero stat row for the monetization dashboard. Five tiles now —
// Impressions, Clicks, CTR, CPM, Revenue — CTR and Revenue are new:
// CTR is derived (clicks/impressions), Revenue is this period's
// earnings (cpmUsd * impressions / 1000, matching how
// useMonetizationStats.ts already derives cpmUsd from period
// earnings). Each tile gets a tiny inline sparkline drawn from
// `series` so the number isn't just sitting there cold — a glance at
// shape, not a second full chart. Purely presentational; `summary`
// and `series` are real, period-scoped data from
// hooks/useMonetizationStats.ts by the time they reach here.
import type { ReactNode } from 'react';
import { formatCompactNumber, type DayPoint, type MonetizationSummary } from '@/lib/monetization-stats';

interface MonetizationStatGridProps {
  summary: MonetizationSummary;
  series: DayPoint[];
  enabled: boolean;
}

export function MonetizationStatGrid({ summary, series, enabled }: MonetizationStatGridProps) {
  const ctr = summary.impressions > 0 ? summary.clicks / summary.impressions : 0;
  const revenueUsd = (summary.cpmUsd * summary.impressions) / 1000;

  return (
    <div className="mon-stat-grid">
      <StatTile
        tone="green"
        label="Impressions"
        value={formatCompactNumber(summary.impressions)}
        delta={summary.impressionsDeltaPct}
        points={series.map((p) => p.impressions)}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
      />
      <StatTile
        tone="blue"
        label="Clicks"
        value={formatCompactNumber(summary.clicks)}
        delta={summary.clicksDeltaPct}
        points={series.map((p) => p.clicks)}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 9 21 4l-5 17-4-7-7-4Z" />
          </svg>
        }
      />
      <StatTile
        tone="purple"
        label="CTR"
        sub="clicks per impression"
        value={`${(ctr * 100).toFixed(2)}%`}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l4-5 3 3 5-7" />
          </svg>
        }
      />
      <StatTile
        tone="orange"
        label="CPM"
        sub="per 1,000 impressions"
        value={`$${summary.cpmUsd.toFixed(2)}`}
        delta={summary.cpmDeltaPct}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
      />
      <StatTile
        tone="green"
        label="Revenue"
        sub={enabled ? 'this period' : 'ads are off'}
        value={`$${revenueUsd.toFixed(2)}`}
        wide
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v10M9 9.5c0-1.1 1.2-2 2.7-2h.6c1.5 0 2.7.9 2.7 2 0 2.3-6 1.1-6 3.5 0 1.1 1.2 2 2.7 2h.6c1.5 0 2.7-.9 2.7-2" />
          </svg>
        }
      />
    </div>
  );
}

interface StatTileProps {
  tone: 'green' | 'purple' | 'blue' | 'orange';
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  points?: number[];
  wide?: boolean;
  icon: ReactNode;
}

function StatTile({ tone, label, value, sub, delta, points, wide, icon }: StatTileProps) {
  return (
    <div className={`mon-stat-tile mon-tone-${tone}${wide ? ' mon-stat-wide' : ''}`}>
      <div className="mon-stat-top">
        <span className="mon-stat-icon">{icon}</span>
        {typeof delta === 'number' ? (
          <span className={`mon-stat-delta${delta >= 0 ? ' is-up' : ' is-down'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        ) : points && points.length > 1 ? (
          <Sparkline points={points} />
        ) : null}
      </div>
      <span className="mon-stat-num">{value}</span>
      <span className="mon-stat-label">{label}</span>
      {sub && <span className="mon-stat-sub">{sub}</span>}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 56;
  const h = 20;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg className="mon-stat-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" />
    </svg>
  );
}
