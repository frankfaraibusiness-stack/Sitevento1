// components/dashboard/AnalyticsCharts.tsx
//
// Small, dependency-free chart primitives for the Analytics tab
// (VisitLogPanel). Hand-rolled inline SVG rather than pulling in
// Chart.js — matches the existing Sparkline-in-OverviewStats.tsx
// approach already used elsewhere in this dashboard, keeps bundle size
// down, and needs no canvas/resize-observer lifecycle.
'use client';

import type { DailyPoint, RankedItem } from '@/lib/analytics';

const TONES = ['green', 'purple', 'blue', 'orange'] as const;
export type Tone = (typeof TONES)[number];

// ---------------------------------------------------------------------
// TrendChart — filled line chart of visits (and, faintly, unique
// visitors) over the selected window. Pure SVG, scales to its
// container via viewBox, no JS measurement needed.
// ---------------------------------------------------------------------
export function TrendChart({ data }: { data: DailyPoint[] }) {
  const w = 600;
  const h = 200;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxVisits = Math.max(1, ...data.map((d) => d.visits));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  function xFor(i: number) {
    return padL + i * stepX;
  }
  function yFor(val: number) {
    return padT + innerH - (val / maxVisits) * innerH;
  }

  const visitsPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(d.visits)}`).join(' ');
  const uniquesPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(d.uniques)}`).join(' ');
  const areaPath = `${visitsPath} L${xFor(data.length - 1)},${padT + innerH} L${xFor(0)},${padT + innerH} Z`;

  // Show every Nth label so dense ranges (30 days) don't overlap.
  const labelEvery = data.length > 10 ? Math.ceil(data.length / 7) : 1;
  const allZero = maxVisits <= 1 && data.every((d) => d.visits === 0);

  return (
    <div className="ac-trend-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="ac-trend-svg" preserveAspectRatio="none" role="img" aria-label="Visits over time">
        <defs>
          <linearGradient id="acTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dash-green)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--dash-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={w - padR}
            y1={padT + innerH * (1 - f)}
            y2={padT + innerH * (1 - f)}
            className="ac-grid-line"
          />
        ))}
        {!allZero && <path d={areaPath} fill="url(#acTrendFill)" />}
        <path d={visitsPath} className="ac-line ac-line-visits" fill="none" />
        <path d={uniquesPath} className="ac-line ac-line-uniques" fill="none" />
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.date} x={xFor(i)} y={h - 6} className="ac-axis-label" textAnchor="middle">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
      {allZero && <div className="ac-trend-empty">No visits yet in this window.</div>}
    </div>
  );
}

// ---------------------------------------------------------------------
// BarList — ranked rows (top pages / referrers / devices) with a
// proportional background bar, count, and share percentage.
// ---------------------------------------------------------------------
export function BarList({ items, tone = 'blue' }: { items: RankedItem[]; tone?: Tone }) {
  if (items.length === 0) {
    return <div className="ac-barlist-empty">No data yet.</div>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className={`ac-barlist ac-tone-${tone}`}>
      {items.map((item) => (
        <li key={item.label} className="ac-barlist-row">
          <span className="ac-bar-track">
            <span className="ac-bar-fill" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
            <span className="ac-bar-label" title={item.label}>
              {item.label}
            </span>
          </span>
          <span className="ac-bar-count">
            {item.count}
            <span className="ac-bar-pct">{item.pct}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
