'use client';

// components/console/ConsoleTrendChart.tsx
//
// Hand-rolled SVG line/area chart for the Console overview dashboard —
// same technique as components/dashboard/dx/DxCharts.tsx's TrendChart
// (no chart library in this project), simplified to one or two series
// with a hover tooltip. Colours come from --console-* tokens so they
// follow styles/console/console.css.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ConsoleSeriesPoint } from '@/hooks/useConsoleStats';

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
  if (pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
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

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'k';
  return String(Math.round(n));
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

interface SeriesDef {
  key: keyof ConsoleSeriesPoint;
  label: string;
  colorVar: string;
}

interface ConsoleTrendChartProps {
  data: ConsoleSeriesPoint[];
  series: SeriesDef[];
  height?: number;
}

export function ConsoleTrendChart({ data, series, height: heightProp }: ConsoleTrendChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const compact = width > 0 && width < 520;
  const height = heightProp ?? (compact ? 220 : 280);
  const pad = { l: compact ? 34 : 46, r: 12, t: 16, b: 28 };

  const geo = useMemo(() => {
    if (!width || n === 0) return null;
    const innerW = Math.max(10, width - pad.l - pad.r);
    const innerH = height - pad.t - pad.b;
    const allValues = series.flatMap((s) => data.map((p) => Number(p[s.key]) || 0));
    const yMax = niceMax(Math.max(1, ...allValues));
    const x = (i: number) => pad.l + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
    const y = (v: number) => pad.t + innerH - (v / yMax) * innerH;
    const base = pad.t + innerH;
    const seriesGeo = series.map((s) => {
      const pts = data.map((p, i) => [x(i), y(Number(p[s.key]) || 0)] as [number, number]);
      const line = linePath(pts);
      const area = pts.length ? `${line}L${pts[pts.length - 1][0].toFixed(1)},${base}L${pts[0][0].toFixed(1)},${base}Z` : '';
      return { ...s, pts, line, area };
    });
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: Math.round(yMax * f), y: y(yMax * f) }));
    const wanted = compact ? 4 : 7;
    const idxs = new Set<number>();
    for (let i = 0; i < Math.min(wanted, n); i++) idxs.add(n === 1 ? 0 : Math.round((i * (n - 1)) / (Math.min(wanted, n) - 1 || 1)));
    return { innerW, innerH, x, y, base, ticks, xLabels: Array.from(idxs), seriesGeo };
  }, [data, series, width, n, height, compact]);

  function onMove(e: ReactPointerEvent<SVGRectElement>) {
    if (!geo || n === 0) return;
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n === 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  const activePoint = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null && geo ? geo.x(hover) : 0;
  const tipOnRight = tipLeft > (width || 0) * 0.6;

  return (
    <div className="console-chart" ref={ref} style={{ height }}>
      {geo && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
          {geo.ticks.map((t) => (
            <g key={t.y}>
              <line x1={pad.l} x2={width - pad.r} y1={t.y} y2={t.y} className="console-chart-gridline" />
              <text x={pad.l - 8} y={t.y + 4} textAnchor="end" className="console-chart-axis">
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
              className="console-chart-axis"
            >
              {fmtDateShort(data[i].date)}
            </text>
          ))}

          {geo.seriesGeo.map((s) => (
            <path key={`area-${s.key}`} d={s.area} fill={`var(${s.colorVar})`} opacity={0.12} />
          ))}
          {geo.seriesGeo.map((s) => (
            <path key={`line-${s.key}`} d={s.line} fill="none" stroke={`var(${s.colorVar})`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {hover !== null && (
            <line x1={tipLeft} x2={tipLeft} y1={pad.t} y2={geo.base} className="console-chart-hover-line" />
          )}
          {hover !== null &&
            geo.seriesGeo.map((s) => (
              <circle key={`dot-${s.key}`} cx={s.pts[hover]?.[0]} cy={s.pts[hover]?.[1]} r={4} fill={`var(${s.colorVar})`} stroke="var(--console-card-bg)" strokeWidth={2} />
            ))}

          <rect x={pad.l} y={pad.t} width={geo.innerW} height={geo.innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}

      {activePoint && (
        <div className="console-chart-tooltip" style={{ left: tipOnRight ? undefined : tipLeft, right: tipOnRight ? (width || 0) - tipLeft : undefined }}>
          <div className="console-chart-tooltip-date">{fmtDateShort(activePoint.date)}</div>
          {series.map((s) => (
            <div key={s.key} className="console-chart-tooltip-row">
              <span className="console-chart-tooltip-dot" style={{ background: `var(${s.colorVar})` }} />
              {s.label}: <strong>{fmtNum(Number(activePoint[s.key]) || 0)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
