'use client';

// components/monetization/MonetizationTrendChart.tsx
//
// Impressions/clicks-over-time area chart for the selected period.
// Hand-rolled as inline SVG rather than a charting library: this repo
// has no chart package in package.json (no recharts, no chart.js) and
// this pass is explicitly frontend-only, so reaching for a new
// dependency for mock data would be the wrong tradeoff — swapping
// this for a library later, once real data exists, is a contained
// change (same props: a list of {label, impressions, clicks} points).
//
// Impressions render as a filled lime area (primary metric, reads
// first); clicks render as a thin orange line on the same canvas,
// scaled to its own max since clicks are a much smaller number and
// would otherwise look flat against impressions.
import { useId, useMemo } from 'react';
import type { DayPoint } from '@/lib/monetization-stats';

interface MonetizationTrendChartProps {
  series: DayPoint[];
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;

export function MonetizationTrendChart({ series }: MonetizationTrendChartProps) {
  const gradientId = useId();

  const { areaPath, linePath, clickPath, ticks } = useMemo(() => buildPaths(series), [series]);

  // Show at most ~6 x-axis labels regardless of how many points there
  // are, so a 30- or 90-point series doesn't collide into mush.
  const labelStep = Math.max(1, Math.ceil(series.length / 6));

  return (
    <div className="mon-chart-card">
      <div className="mon-chart-head">
        <h3 className="mon-chart-title">Impressions &amp; clicks</h3>
        <div className="mon-chart-legend">
          <span className="mon-legend-dot mon-legend-impressions" />
          Impressions
          <span className="mon-legend-dot mon-legend-clicks" />
          Clicks
        </div>
      </div>
      <svg
        className="mon-trend-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Impressions and clicks over the selected period"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--lime)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <line key={i} x1={PAD_X} x2={WIDTH - PAD_X} y1={t.y} y2={t.y} className="mon-trend-gridline" />
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" className="mon-trend-line-impressions" />
        <path d={clickPath} fill="none" className="mon-trend-line-clicks" />
      </svg>
      <div className="mon-trend-x-axis">
        {series.map((p, i) =>
          i % labelStep === 0 ? (
            <span key={i} className="mon-trend-x-label">
              {p.label}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

function buildPaths(series: DayPoint[]) {
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxImpressions = Math.max(...series.map((p) => p.impressions), 1);
  const maxClicks = Math.max(...series.map((p) => p.clicks), 1);

  const step = series.length > 1 ? innerW / (series.length - 1) : 0;

  const impressionPoints = series.map((p, i) => ({
    x: PAD_X + step * i,
    y: PAD_TOP + innerH - (p.impressions / maxImpressions) * innerH,
  }));
  const clickPoints = series.map((p, i) => ({
    x: PAD_X + step * i,
    y: PAD_TOP + innerH - (p.clicks / maxClicks) * innerH,
  }));

  const linePath = impressionPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  const clickPath = clickPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

  const baseline = PAD_TOP + innerH;
  const areaPath = `${linePath} L${(PAD_X + step * (series.length - 1)).toFixed(1)},${baseline} L${PAD_X},${baseline} Z`;

  const ticks = [0, 0.33, 0.66, 1].map((f) => ({ y: PAD_TOP + innerH * f }));

  return { areaPath, linePath, clickPath, ticks };
}
