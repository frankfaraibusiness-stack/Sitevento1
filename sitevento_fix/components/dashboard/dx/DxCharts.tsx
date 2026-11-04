'use client';

// components/dashboard/dx/DxCharts.tsx
//
// Hand-rolled SVG charts for the main dashboard — no chart library (the
// project ships with none, and these three shapes are small). Colours come
// only from the --dx-* tokens set on the dashboard root, so they follow the
// page background's light/dark tone automatically.
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { DOW_LABELS, fmtNum, hourLabel, type HeatGrid, type SeriesPoint } from '@/lib/dashboardStats';

export type TrendMetric = 'visits' | 'uniques' | 'clicks' | 'blocked';

export const TREND_METRICS: { id: TrendMetric; label: string }[] = [
  { id: 'visits', label: 'Visits' },
  { id: 'uniques', label: 'Unique users' },
  { id: 'clicks', label: 'Clicks' },
  { id: 'blocked', label: 'Blocked' },
];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function linePath(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length < 3 || pts.length > 140) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  // Catmull-Rom → cubic Bézier, y clamped so smoothing never dips below the baseline.
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

interface TrendProps {
  series: SeriesPoint[];
  metric: TrendMetric;
  clicksAvailable: boolean;
}

export function TrendChart({ series, metric, clicksAvailable }: TrendProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const compact = width > 0 && width < 520;
  const height = compact ? 220 : 280;
  const pad = { l: compact ? 34 : 42, r: 12, t: 16, b: 28 };
  const n = series.length;

  const geo = useMemo(() => {
    if (!width || n === 0) return null;
    const innerW = Math.max(10, width - pad.l - pad.r);
    const innerH = height - pad.t - pad.b;
    const primary = series.map((p) => p[metric]);
    const secondary = metric === 'visits' ? series.map((p) => p.uniques) : null;
    const yMax = niceMax(Math.max(0, ...primary, ...(secondary || [])));
    const x = (i: number) => pad.l + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
    const y = (v: number) => pad.t + innerH - (v / yMax) * innerH;
    const pPts = primary.map((v, i) => [x(i), y(v)] as [number, number]);
    const sPts = secondary ? secondary.map((v, i) => [x(i), y(v)] as [number, number]) : null;
    const base = pad.t + innerH;
    const line = linePath(pPts);
    const area = pPts.length ? `${line}L${pPts[pPts.length - 1][0].toFixed(1)},${base}L${pPts[0][0].toFixed(1)},${base}Z` : '';
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: Math.round(yMax * f * 10) / 10, y: y(yMax * f) }));
    const wanted = compact ? 4 : 7;
    const idxs = new Set<number>();
    for (let i = 0; i < Math.min(wanted, n); i++) idxs.add(n === 1 ? 0 : Math.round((i * (n - 1)) / (Math.min(wanted, n) - 1 || 1)));
    return { innerW, innerH, yMax, x, pPts, sPts, base, line, area, ticks, xLabels: Array.from(idxs) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, metric, width, n, compact]);

  const empty = n === 0 || series.every((p) => p[metric] === 0);
  const drawKey = `${series[0]?.t ?? 0}-${n}-${metric}`;

  function onMove(e: ReactPointerEvent<SVGRectElement>) {
    if (!geo || n === 0) return;
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n === 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  const active = hover !== null && geo ? series[hover] : null;
  const tipLeft = hover !== null && geo ? geo.x(hover) : 0;

  return (
    <div className="dx-trend" ref={ref} style={{ height }}>
      {geo && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${TREND_METRICS.find((m) => m.id === metric)?.label} over time`}
        >
          <defs>
            <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--dx-a)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--dx-a)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {geo.ticks.map((t) => (
            <g key={t.y}>
              <line x1={pad.l} x2={width - pad.r} y1={t.y} y2={t.y} className="dx-gridline" />
              <text x={pad.l - 8} y={t.y + 4} textAnchor="end" className="dx-axis">
                {fmtNum(t.v)}
              </text>
            </g>
          ))}

          {geo.xLabels.map((i) => (
            <text
              key={i}
              x={geo.x(i)}
              y={height - 8}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              className="dx-axis"
            >
              {series[i].label}
            </text>
          ))}

          {!empty && <path d={geo.area} fill={`url(#g${gid})`} />}
          {geo.sPts && !empty && <path d={linePath(geo.sPts)} className="dx-line-2" fill="none" />}
          <path
            key={drawKey}
            d={geo.line}
            className={empty ? 'dx-line is-flat' : 'dx-line'}
            fill="none"
            pathLength={1}
          />

          {active && hover !== null && (
            <g>
              <line x1={tipLeft} x2={tipLeft} y1={pad.t} y2={geo.base} className="dx-cross" />
              <circle cx={tipLeft} cy={geo.pPts[hover][1]} r={5} className="dx-dot" />
              {geo.sPts && <circle cx={tipLeft} cy={geo.sPts[hover][1]} r={4} className="dx-dot-2" />}
            </g>
          )}

          <rect
            x={pad.l}
            y={pad.t}
            width={geo.innerW}
            height={geo.innerH}
            fill="transparent"
            style={{ touchAction: 'pan-y' }}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}

      {empty && geo && (
        <p className="dx-trend-empty">
          {metric === 'clicks' && !clicksAvailable ? 'Clicks are charted by day — pick a longer period.' : 'No activity in this period yet.'}
        </p>
      )}

      {active && geo && (
        <div
          className="dx-tip"
          style={{ left: Math.min(Math.max(tipLeft, 86), Math.max(86, width - 86)) }}
          role="status"
        >
          <strong>{active.long}</strong>
          <span>
            <i className="dx-sw" /> {fmtNum(active.visits)} visits
          </span>
          <span>
            <i className="dx-sw is-2" /> {fmtNum(active.uniques)} unique
          </span>
          {clicksAvailable && <span>{fmtNum(active.clicks)} clicks</span>}
          {active.blocked > 0 && <span className="is-bad">{fmtNum(active.blocked)} blocked</span>}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 0);
  const n = values.length;
  const pts = values.map((v, i) => {
    const x = n <= 1 ? 50 : (i * 100) / (n - 1);
    const y = 26 - (max > 0 ? (v / max) * 22 : 0);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className={className || 'dx-spark'} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={pts.join('')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function HeatMap({ grid }: { grid: HeatGrid }) {
  return (
    <div className="dx-heat" role="img" aria-label="Visits by day of week and hour">
      <div className="dx-heat-hours" aria-hidden="true">
        <span />
        {[0, 6, 12, 18].map((h) => (
          <span key={h} style={{ gridColumn: `${h + 2} / span 6` }}>
            {hourLabel(h)}
          </span>
        ))}
      </div>
      {grid.cells.map((row, dow) => (
        <div className="dx-heat-row" key={DOW_LABELS[dow]}>
          <span className="dx-heat-dow">{DOW_LABELS[dow]}</span>
          {row.map((n, h) => (
            <i
              key={h}
              className={n > 0 ? 'dx-heat-cell' : 'dx-heat-cell is-zero'}
              style={{ ['--i' as string]: grid.max ? Math.max(0.12, n / grid.max) : 0 }}
              title={`${DOW_LABELS[dow]} ${hourLabel(h)} · ${n} visit${n === 1 ? '' : 's'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
