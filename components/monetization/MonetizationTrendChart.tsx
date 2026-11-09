'use client';

// components/monetization/MonetizationTrendChart.tsx
//
// Impressions/clicks-over-time chart for the selected period. Hand-
// rolled as inline SVG (no chart dependency in package.json). Follows
// the single-axis rule: impressions render as a filled area against
// the real axis; clicks render as a normalized (0-1 of its own max)
// line on the same canvas so the two series never fight over one
// y-scale, with a direct note explaining the second line is index-
// scaled rather than silently implying a shared axis.
//
// Adds a hover crosshair + tooltip (dataviz interaction convention):
// hovering anywhere over the plot snaps to the nearest day and shows
// its exact impressions/clicks in a small floating card.
import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DayPoint } from '@/lib/monetization-stats';

interface MonetizationTrendChartProps {
  series: DayPoint[];
}

const WIDTH = 640;
const HEIGHT = 240;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;

export function MonetizationTrendChart({ series }: MonetizationTrendChartProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { areaPath, linePath, clickPath, ticks, points } = useMemo(() => buildPaths(series), [series]);

  const labelStep = Math.max(1, Math.ceil(series.length / 6));

  function handlePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const step = points.length > 1 ? (WIDTH - PAD_X * 2) / (points.length - 1) : 0;
    const idx = step > 0 ? Math.round((relX - PAD_X) / step) : 0;
    setHoverIndex(Math.max(0, Math.min(points.length - 1, idx)));
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredDay = hoverIndex !== null ? series[hoverIndex] : null;

  return (
    <div className="mon-chart-card mon-chart-card-primary">
      <div className="mon-chart-head">
        <h3 className="mon-chart-title">Impressions &amp; clicks</h3>
        <div className="mon-chart-legend">
          <span className="mon-legend-item">
            <span className="mon-legend-dot mon-legend-impressions" />
            Impressions
          </span>
          <span className="mon-legend-item">
            <span className="mon-legend-dot mon-legend-clicks" />
            Clicks (indexed)
          </span>
        </div>
      </div>
      <div className="mon-trend-wrap">
        <svg
          className="mon-trend-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Impressions and clicks over the selected period"
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lime-ink)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--lime-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((t, i) => (
            <line key={i} x1={PAD_X} x2={WIDTH - PAD_X} y1={t.y} y2={t.y} className="mon-trend-gridline" />
          ))}

          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path d={linePath} fill="none" className="mon-trend-line-impressions" />
          <path d={clickPath} fill="none" className="mon-trend-line-clicks" />

          {hovered && (
            <>
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
                className="mon-trend-crosshair"
              />
              <circle cx={hovered.x} cy={hovered.impY} r={4.5} className="mon-trend-dot mon-trend-dot-impressions" />
              <circle cx={hovered.x} cy={hovered.clickY} r={4} className="mon-trend-dot mon-trend-dot-clicks" />
            </>
          )}
        </svg>

        {hovered && hoveredDay && (
          <div
            className="mon-trend-tooltip"
            style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
          >
            <span className="mon-trend-tooltip-label">{hoveredDay.label}</span>
            <span className="mon-trend-tooltip-row">
              <span className="mon-legend-dot mon-legend-impressions" />
              {hoveredDay.impressions.toLocaleString()} impressions
            </span>
            <span className="mon-trend-tooltip-row">
              <span className="mon-legend-dot mon-legend-clicks" />
              {hoveredDay.clicks.toLocaleString()} clicks
            </span>
          </div>
        )}
      </div>
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

  const points = series.map((p, i) => {
    const x = PAD_X + step * i;
    const impY = PAD_TOP + innerH - (p.impressions / maxImpressions) * innerH;
    const clickY = PAD_TOP + innerH - (p.clicks / maxClicks) * innerH;
    return { x, impY, clickY };
  });

  const linePath = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.impY.toFixed(1)}`).join(' ');
  const clickPath = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.clickY.toFixed(1)}`).join(' ');

  const baseline = PAD_TOP + innerH;
  const areaPath = `${linePath} L${points[points.length - 1]?.x.toFixed(1) ?? 0},${baseline} L${PAD_X},${baseline} Z`;

  const ticks = [0, 0.33, 0.66, 1].map((f) => ({ y: PAD_TOP + innerH * f }));

  return { areaPath, linePath, clickPath, ticks, points };
}
