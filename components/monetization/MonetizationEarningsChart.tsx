'use client';

// components/monetization/MonetizationEarningsChart.tsx
//
// SVG earnings-trend chart matching the supplied mockup's #chart
// element exactly (viewBox 0 0 700 220, gridlines, smoothed path,
// gradient fill under the curve) — but rendered from real per-day
// earnings (DayPoint-derived USD values), not a sine-wave generator.
// Pure presentational: all data comes from props.
import { useMemo } from 'react';

interface MonetizationEarningsChartProps {
  values: number[]; // per-bucket earnings in USD, chronological
  axisLabels: string[];
  positive: boolean; // false -> red line/gradient (ads off / no earnings)
}

export function MonetizationEarningsChart({ values, axisLabels, positive }: MonetizationEarningsChartProps) {
  const path = useMemo(() => buildSmoothPath(values), [values]);
  const color = positive ? 'var(--mon2-brand)' : 'var(--mon2-bad)';

  return (
    <>
      <svg className="mon2-chart" viewBox="0 0 700 220" role="img" aria-label="Earnings over the selected period">
        <defs>
          <linearGradient id="mon2-chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.3" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 90, 150, 210].map((y) => (
          <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.1" />
        ))}
        {path && (
          <>
            <path d={`${path} L700 220 L0 220Z`} fill="url(#mon2-chart-grad)" />
            <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
          </>
        )}
      </svg>
      <div className="mon2-axis mon2-mut">
        {axisLabels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </>
  );
}

function buildSmoothPath(values: number[]): string {
  if (values.length === 0) return '';
  const n = values.length;
  const max = Math.max(...values, 0.0001);
  const points: [number, number][] = values.map((v, i) => [
    n > 1 ? (i / (n - 1)) * 700 : 350,
    200 - (v / max) * 170,
  ]);

  return points
    .map((pt, i) => {
      if (i === 0) return `M${pt[0]} ${pt[1]}`;
      const prev = points[i - 1];
      const mx = (prev[0] + pt[0]) / 2;
      return `C${mx} ${prev[1]} ${mx} ${pt[1]} ${pt[0]} ${pt[1]}`;
    })
    .join(' ');
}
