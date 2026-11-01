'use client';

// components/dashboard/VisitsChartCard.tsx
//
// Chart card matching the HTML mock's .chart-card. The mock plots
// "Visits & clicks" — clicks isn't real data (see OverviewKpiGrid.tsx's
// header comment on lib/monetization-stats.ts being mock-only), so
// this chart plots real visits only, aggregated by day from the
// actual Visit[] list via useActiveSiteData(). No SVG path-drawing
// yet (left for the CSS/visual step) — this component owns the real
// data aggregation only.
import { useMemo } from 'react';
import type { Visit } from '@/lib/types';

export interface ChartPoint {
  label: string;
  visits: number;
}

interface VisitsChartCardProps {
  title?: string;
  visits: Visit[];
  days?: number;
}

function visitTimestampMs(ts: Visit['ts']): number | null {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  const d = ts.toDate();
  return d ? d.getTime() : null;
}

// Buckets real visits into the last `days` calendar days (local time),
// oldest first, so the chart always has exactly `days` points even for
// days with zero visits.
export function useDailyVisitSeries(visits: Visit[], days = 7): ChartPoint[] {
  return useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; start: number; end: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = d.getTime();
      const end = start + 24 * 60 * 60 * 1000;
      buckets.push({
        key: d.toDateString(),
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        start,
        end,
      });
    }

    const counts = new Map(buckets.map((b) => [b.key, 0]));
    for (const v of visits) {
      const ms = visitTimestampMs(v.ts);
      if (ms == null) continue;
      const bucket = buckets.find((b) => ms >= b.start && ms < b.end);
      if (bucket) counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
    }

    return buckets.map((b) => ({ label: b.label, visits: counts.get(b.key) ?? 0 }));
  }, [visits, days]);
}

export function VisitsChartCard({ title = 'Visits · last 7 days', visits, days = 7 }: VisitsChartCardProps) {
  const points = useDailyVisitSeries(visits, days);
  const hasData = points.some((p) => p.visits > 0);

  return (
    <div className="dashv2-chart-card">
      <div className="dashv2-chart-head">
        <span className="dashv2-chart-title">{title}</span>
        <div className="dashv2-chart-legend">
          <span className="dashv2-legend-item">
            <span className="dashv2-legend-dot dashv2-legend-visits" aria-hidden="true" />
            Visits
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="dashv2-chart-empty">Not enough data yet</div>
      ) : (
        // Real data is attached via data-* for now; the actual <svg>
        // path drawing from `points` is a visual concern for the
        // CSS/design step, not backend wiring.
        <div
          className="dashv2-chart-canvas"
          data-points={JSON.stringify(points)}
        />
      )}
    </div>
  );
}
