'use client';

// components/monetization/MonetizationCountryChart.tsx
//
// Ranked-list breakdown of traffic by country — a literal map felt
// like overkill (and extra weight) for mock data with only five rows;
// a ranked bar list reads just as clearly and matches the bar-list
// treatment already used in MonetizationAdTypeChart.tsx, so the two
// charts feel like one family rather than two different idioms.
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
      <div className="mon-bar-list">
        {data.map((row) => (
          <div key={row.code} className="mon-bar-row">
            <span className="mon-bar-label mon-bar-label-country">
              <span aria-hidden="true">{row.flag}</span> {row.name}
            </span>
            <div className="mon-bar-track">
              <div className="mon-bar-fill mon-bar-fill-country" style={{ width: `${row.share * 100}%` }} />
            </div>
            <span className="mon-bar-value">{Math.round(row.share * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
