'use client';

// components/monetization/MonetizationAdTypeChart.tsx
//
// Horizontal bar comparison of which ad FORMATS are performing —
// impressions as bar length, CTR called out per row. There's no real
// ad pool yet (lib/monetization.ts's AD_TYPES is the catalog of
// formats a site owner can opt into, not live inventory), so this
// shows the shape of the eventual breakdown with mock numbers from
// lib/monetization-stats.ts. Plain divs + CSS widths rather than SVG
// since horizontal bars don't need it.
import type { AdTypeBreakdown } from '@/lib/monetization-stats';

interface MonetizationAdTypeChartProps {
  data: AdTypeBreakdown[];
}

export function MonetizationAdTypeChart({ data }: MonetizationAdTypeChartProps) {
  const max = Math.max(...data.map((d) => d.impressions), 1);

  return (
    <div className="mon-chart-card">
      <div className="mon-chart-head">
        <h3 className="mon-chart-title">Performance by ad type</h3>
      </div>
      <div className="mon-bar-list">
        {data.map((d) => (
          <div key={d.id} className="mon-bar-row">
            <span className="mon-bar-label">{d.label}</span>
            <div className="mon-bar-track">
              <div className="mon-bar-fill" style={{ width: `${(d.impressions / max) * 100}%` }} />
            </div>
            <span className="mon-bar-value">
              {d.impressions.toLocaleString()} <span className="mon-bar-ctr">· {(d.ctr * 100).toFixed(1)}% CTR</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
