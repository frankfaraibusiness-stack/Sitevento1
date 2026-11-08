'use client';

// components/monetization/MonetizationCountryChart.tsx
//
// Ranked-list breakdown of traffic by country. A literal map is
// overkill for a five-row breakdown; a ranked bar list reads just as
// clearly and matches MonetizationAdTypeChart's treatment so the two
// charts feel like one family.
import type { CountryRow } from '@/lib/monetization-stats';

interface MonetizationCountryChartProps {
  data: CountryRow[];
}

export function MonetizationCountryChart({ data }: MonetizationCountryChartProps) {
  return (
    <div className="mon-chart-card">
      <div className="mon-chart-head">
        <h3 className="mon-chart-title">Impressions by country</h3>
      </div>
      {data.length === 0 ? (
        <p className="mon-chart-empty">No country data for this period yet.</p>
      ) : (
        <div className="mon-bar-list">
          {data.slice(0, 6).map((row) => (
            <div key={row.code} className="mon-bar-row mon-bar-tone-country">
              <span className="mon-bar-label mon-bar-label-country">
                <span aria-hidden="true">{row.flag}</span> {row.name}
              </span>
              <div className="mon-bar-track">
                <div className="mon-bar-fill" style={{ width: `${Math.max(3, row.share * 100)}%` }} />
              </div>
              <span className="mon-bar-value">{Math.round(row.share * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
