// components/dashboard/OverviewStats.tsx — replaces the .dash-grid stat cards.
interface OverviewStatsProps {
  totalVisits: number;
  uniqueVisitors: number;
  leadsCount: number;
  blockedCount: number;
}

export function OverviewStats({ totalVisits, uniqueVisitors, leadsCount, blockedCount }: OverviewStatsProps) {
  return (
    <div className="dash-grid">
      <div className="dash-card">
        <span className="dc-label">Total visits</span>
        <span className="dc-num">{totalVisits}</span>
        <span className="dc-sub">All time</span>
      </div>
      <div className="dash-card">
        <span className="dc-label">Unique visitors</span>
        <span className="dc-num">{uniqueVisitors}</span>
        <span className="dc-sub">All time</span>
      </div>
      <div className="dash-card">
        <span className="dc-label">Emails captured</span>
        <span className="dc-num">{leadsCount}</span>
        <span className="dc-sub">All time</span>
      </div>
      <div className="dash-card">
        <span className="dc-label">Blocked visitors</span>
        <span className="dc-num">{blockedCount}</span>
        <span className="dc-sub">Currently blocked</span>
      </div>
    </div>
  );
}
