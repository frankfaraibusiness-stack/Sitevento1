'use client';

// components/monetization/MonetizationAdTypeChart.tsx
//
// Horizontal bar comparison of which ad FORMATS are performing —
// impressions as bar length, CTR called out per row as a direct
// label (no legend needed: each row names itself). Rounded bar ends,
// a 2px surface gap so adjacent bars never visually merge, and a
// fixed categorical tone per format id so the same format always
// reads as the same color across sessions.
import type { AdTypeBreakdown } from '@/lib/monetization-stats';

interface MonetizationAdTypeChartProps {
  data: AdTypeBreakdown[];
}

const TONE_BY_ID: Record<string, string> = {
  banner: 'green',
  'sticky-footer': 'blue',
  interstitial: 'purple',
  popup: 'orange',
  overlay: 'pink',
};

export function MonetizationAdTypeChart({ data }: MonetizationAdTypeChartProps) {
  const max = Math.max(...data.map((d) => d.impressions), 1);

  return (
    <div className="mon-chart-card">
      <div className="mon-chart-head">
        <h3 className="mon-chart-title">Performance by ad type</h3>
      </div>
      {data.length === 0 ? (
        <p className="mon-chart-empty">No format data for this period yet.</p>
      ) : (
        <div className="mon-bar-list">
          {data.map((d) => (
            <div key={d.id} className={`mon-bar-row mon-bar-tone-${TONE_BY_ID[d.id] || 'green'}`}>
              <span className="mon-bar-label">{d.label}</span>
              <div className="mon-bar-track">
                <div className="mon-bar-fill" style={{ width: `${Math.max(3, (d.impressions / max) * 100)}%` }} />
              </div>
              <span className="mon-bar-value">
                {d.impressions.toLocaleString()} <span className="mon-bar-ctr">· {(d.ctr * 100).toFixed(1)}% CTR</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
