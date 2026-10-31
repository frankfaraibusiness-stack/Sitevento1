'use client';

// components/monetization/MonetizationStatGrid.tsx
//
// The 4-up stat row at the top of the real monetization dashboard
// (MonetizationDashboard.tsx), styled after the main dashboard's
// `.dnx-stat-tile` (styles/dashboard/dashboard-premium.css) — same
// frosted-glass tile, tone-tinted corner glow and rise-in stagger,
// just scoped under `mon-stat-*` instead of `dnx-stat-*` so this
// route's CSS stays self-contained (see monetization-dashboard.css's
// header comment). Purely presentational — `summary` is real,
// period-scoped data from hooks/useMonetizationStats.ts by the time
// it reaches here (see MonetizationDashboard.tsx); this component
// itself fetches and persists nothing.
import type { ReactNode } from 'react';
import { formatCompactNumber, type MonetizationSummary } from '@/lib/monetization-stats';

interface MonetizationStatGridProps {
  summary: MonetizationSummary;
}

export function MonetizationStatGrid({ summary }: MonetizationStatGridProps) {
  return (
    <div className="mon-stat-grid">
      <StatTile
        tone="green"
        label="Impressions"
        value={formatCompactNumber(summary.impressions)}
        delta={summary.impressionsDeltaPct}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
      />
      <StatTile
        tone="purple"
        label="CPM"
        sub="per 1,000 valid impressions"
        value={`$${summary.cpmUsd.toFixed(2)}`}
        delta={summary.cpmDeltaPct}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
      />
      <StatTile
        tone="blue"
        label="Clicks"
        value={formatCompactNumber(summary.clicks)}
        delta={summary.clicksDeltaPct}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 9 21 4l-5 17-4-7-7-4Z" />
          </svg>
        }
      />
      <StatTile
        tone="orange"
        label="Top country"
        value={`${summary.topCountryFlag} ${summary.topCountry}`}
        sub={`${Math.round(summary.topCountryShare * 100)}% of impressions`}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" />
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
  icon: ReactNode;
}

function StatTile({ tone, label, value, sub, delta, icon }: StatTileProps) {
  return (
    <div className={`mon-stat-tile mon-tone-${tone}`}>
      <div className="mon-stat-top">
        <span className="mon-stat-icon">{icon}</span>
        {typeof delta === 'number' && (
          <span className={`mon-stat-delta${delta >= 0 ? ' is-up' : ' is-down'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <span className="mon-stat-num">{value}</span>
      <span className="mon-stat-label">{label}</span>
      {sub && <span className="mon-stat-sub">{sub}</span>}
    </div>
  );
}
