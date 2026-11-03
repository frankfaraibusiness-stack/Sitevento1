'use client';

// components/dashboard/OverviewKpiGrid.tsx
//
// KPI card grid matching the HTML mock's .kpi-grid layout. The mock's
// Clicks/CTR/Revenue cards are intentionally NOT reproduced here:
// those map to lib/monetization-stats.ts, which that file's own
// header says is frontend-only mock data ("There's no ad pool and no
// event pipeline yet... nothing is fetched, nothing is persisted").
// Shipping fabricated revenue/click numbers on the real dashboard
// isn't "real stuff," so this grid only shows metrics backed by
// actual Firestore data: visits, unique visitors, leads, blocked —
// the same stats OverviewStats.tsx already derives from
// useActiveSiteData(). Revenue can be added back once a real
// per-site monetization stats pipeline exists.
interface OverviewKpiGridProps {
  totalVisits: number;
  uniqueVisitors: number;
  leadsCount: number;
  blockedCount: number;
}

interface KpiCardDef {
  id: string;
  label: string;
  value: string;
}

export function OverviewKpiGrid({ totalVisits, uniqueVisitors, leadsCount, blockedCount }: OverviewKpiGridProps) {
  const cards: KpiCardDef[] = [
    { id: 'visits', label: 'Total visits', value: totalVisits.toLocaleString() },
    { id: 'unique', label: 'Unique visitors', value: uniqueVisitors.toLocaleString() },
    { id: 'leads', label: 'Emails captured', value: leadsCount.toLocaleString() },
    { id: 'blocked', label: 'Blocked visitors', value: blockedCount.toLocaleString() },
  ];

  return (
    <div className="dashv2-kpi-grid">
      {cards.map((card) => (
        <div key={card.id} className="dashv2-kpi-card">
          <div className="dashv2-kpi-head">
            <span className="dashv2-kpi-label">{card.label}</span>
          </div>
          <span className="dashv2-kpi-value">{card.value}</span>
        </div>
      ))}
    </div>
  );
}
